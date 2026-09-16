import crypto from 'crypto';
import type { Request, Response } from 'express';
import { Router } from 'express';

import { normalizePhone } from '../auth/normalize-phone';
import {
  generateOtpCode,
  hashPhoneOtpCode,
  isPhoneVerificationConfigured,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_REQUESTS_PER_WINDOW,
  OTP_MAX_REQUESTS_WINDOW_SECONDS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
  verifyPhoneOtpCode,
} from '../auth/otp-code';
import {
  consumePhoneVerificationChallenge,
  countRecentChallengesForPhone,
  countRecentChallengesForUser,
  createPhoneVerificationChallenge,
  findPhoneVerificationChallengeById,
  getLatestChallengeForUserPhone,
  incrementChallengeAttemptCount,
} from '../db/phone-verification-challenges-repository';
import { createSessionForUser } from '../db/sessions-repository';
import { findUserById, findUserByVerifiedPhone, toUserResponse } from '../db/users-repository';
import { getSmsSender } from '../sms/get-sms-sender';

const phoneLoginRouter = Router();

function buildNeutralChallengeResponse(challengeId: string) {
  return {
    challengeId,
    expiresInSeconds: OTP_TTL_SECONDS,
    resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
  };
}

function ensurePhoneVerificationEnabled(res: Response): boolean {
  if (!isPhoneVerificationConfigured()) {
    res.status(503).json({ error: 'Phone verification is temporarily unavailable.' });
    return false;
  }

  return true;
}

function rejectInvalidLoginCode(res: Response, attemptsLeft?: number): void {
  res.status(400).json({
    error: attemptsLeft === 0
      ? 'Превышено число попыток. Запросите новый код.'
      : 'Неверный код.',
    ...(attemptsLeft !== undefined ? { attemptsLeft } : {}),
  });
}

phoneLoginRouter.post('/phone/request-code', async (req: Request, res: Response) => {
  if (!ensurePhoneVerificationEnabled(res)) {
    return;
  }

  const normalized = normalizePhone(req.body?.phone);

  if (!normalized.ok) {
    res.status(400).json({ error: 'Введите корректный номер телефона.' });
    return;
  }

  const now = Date.now();
  const windowStart = new Date(now - OTP_MAX_REQUESTS_WINDOW_SECONDS * 1000).toISOString();
  const recentPhoneCount = countRecentChallengesForPhone({
    phone: normalized.phone,
    purpose: 'login',
    sinceIso: windowStart,
  });

  if (recentPhoneCount >= OTP_MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({ error: 'Слишком много запросов кода. Попробуйте позже.' });
    return;
  }

  const targetUser = findUserByVerifiedPhone(normalized.phone);

  if (!targetUser) {
    console.log('[PHONE LOGIN] request accepted without verified account');
    res.status(201).json(buildNeutralChallengeResponse(crypto.randomUUID()));
    return;
  }

  const recentUserCount = countRecentChallengesForUser({
    userId: targetUser.id,
    sinceIso: windowStart,
  });

  if (recentUserCount >= OTP_MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({ error: 'Слишком много запросов кода. Попробуйте позже.' });
    return;
  }

  const latestChallenge = getLatestChallengeForUserPhone({
    userId: targetUser.id,
    phone: normalized.phone,
    purpose: 'login',
  });

  if (latestChallenge) {
    const lastSentAt = new Date(latestChallenge.last_sent_at).getTime();
    const elapsedSeconds = Math.floor((now - lastSentAt) / 1000);

    if (elapsedSeconds < OTP_RESEND_COOLDOWN_SECONDS) {
      res.status(429).json({
        error: 'Подождите перед повторной отправкой кода.',
        resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds,
      });
      return;
    }
  }

  try {
    const code = generateOtpCode();
    const challengeId = crypto.randomUUID();
    const expiresAt = new Date(now + OTP_TTL_SECONDS * 1000).toISOString();
    const codeHash = hashPhoneOtpCode({
      challengeId,
      phone: normalized.phone,
      purpose: 'login',
      code,
    });

    const challenge = createPhoneVerificationChallenge({
      id: challengeId,
      userId: targetUser.id,
      phone: normalized.phone,
      purpose: 'login',
      codeHash,
      expiresAt,
    });

    const smsSender = getSmsSender();
    await smsSender.sendVerificationCode({
      phone: normalized.phone,
      code,
      expiresInMinutes: OTP_TTL_SECONDS / 60,
    });

    console.log('[PHONE LOGIN] verification code sent');

    res.status(201).json(buildNeutralChallengeResponse(challenge.id));
  } catch (error) {
    console.error('Failed to request phone login code:', error);
    res.status(500).json({ error: 'Не удалось отправить код подтверждения.' });
  }
});

phoneLoginRouter.post('/phone/verify', (req: Request, res: Response) => {
  if (!ensurePhoneVerificationEnabled(res)) {
    return;
  }

  const challengeId =
    typeof req.body?.challengeId === 'string' ? req.body.challengeId.trim() : '';
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';

  if (!challengeId || !/^\d{6}$/.test(code)) {
    res.status(400).json({ error: 'Введите 6-значный код.' });
    return;
  }

  const challenge = findPhoneVerificationChallengeById(challengeId);

  if (!challenge || challenge.purpose !== 'login') {
    rejectInvalidLoginCode(res);
    return;
  }

  if (challenge.consumed_at) {
    rejectInvalidLoginCode(res);
    return;
  }

  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    rejectInvalidLoginCode(res);
    return;
  }

  if (challenge.attempt_count >= OTP_MAX_ATTEMPTS) {
    rejectInvalidLoginCode(res, 0);
    return;
  }

  const isValid = verifyPhoneOtpCode({
    challengeId: challenge.id,
    phone: challenge.phone,
    purpose: challenge.purpose,
    code,
    codeHash: challenge.code_hash,
  });

  if (!isValid) {
    const updated = incrementChallengeAttemptCount(challenge.id);
    const attemptsLeft = Math.max(0, OTP_MAX_ATTEMPTS - (updated?.attempt_count ?? OTP_MAX_ATTEMPTS));
    rejectInvalidLoginCode(res, attemptsLeft);
    return;
  }

  const targetUser = findUserById(challenge.user_id);

  if (!targetUser || targetUser.phone_verified !== 1 || targetUser.phone !== challenge.phone) {
    rejectInvalidLoginCode(res);
    return;
  }

  try {
    const { token } = createSessionForUser(targetUser.id);
    consumePhoneVerificationChallenge(challenge.id);

    res.json({
      user: toUserResponse(targetUser),
      token,
    });
  } catch (error) {
    console.error('Failed to verify phone login code:', error);
    res.status(500).json({ error: 'Не удалось выполнить вход.' });
  }
});

export { phoneLoginRouter };
