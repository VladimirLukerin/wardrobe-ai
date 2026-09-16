import crypto from 'crypto';
import type { Request, Response } from 'express';
import { Router } from 'express';

import { normalizeEmail } from '../auth/normalize-email';
import {
  generateOtpCode,
  hashOtpCode,
  isEmailVerificationConfigured,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_REQUESTS_PER_WINDOW,
  OTP_MAX_REQUESTS_WINDOW_SECONDS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
  verifyOtpCode,
} from '../auth/otp-code';
import {
  consumeEmailVerificationChallenge,
  countRecentChallengesForEmail,
  countRecentChallengesForUser,
  createEmailVerificationChallenge,
  findEmailVerificationChallengeById,
  getLatestChallengeForUserEmail,
  incrementChallengeAttemptCount,
} from '../db/email-verification-challenges-repository';
import { createSessionForUser } from '../db/sessions-repository';
import { findUserById, findUserByVerifiedEmail, toUserResponse } from '../db/users-repository';
import { getEmailSender } from '../email/get-email-sender';

const emailLoginRouter = Router();

function buildNeutralChallengeResponse(challengeId: string) {
  return {
    challengeId,
    expiresInSeconds: OTP_TTL_SECONDS,
    resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
  };
}

function ensureEmailVerificationEnabled(res: Response): boolean {
  if (!isEmailVerificationConfigured()) {
    res.status(503).json({ error: 'Email verification is temporarily unavailable.' });
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

emailLoginRouter.post('/email/request-code', async (req: Request, res: Response) => {
  if (!ensureEmailVerificationEnabled(res)) {
    return;
  }

  const normalized = normalizeEmail(req.body?.email);

  if (!normalized.ok) {
    res.status(400).json({ error: 'Введите корректный email.' });
    return;
  }

  const now = Date.now();
  const windowStart = new Date(now - OTP_MAX_REQUESTS_WINDOW_SECONDS * 1000).toISOString();
  const recentEmailCount = countRecentChallengesForEmail({
    email: normalized.email,
    purpose: 'login',
    sinceIso: windowStart,
  });

  if (recentEmailCount >= OTP_MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({ error: 'Слишком много запросов кода. Попробуйте позже.' });
    return;
  }

  const targetUser = findUserByVerifiedEmail(normalized.email);

  if (!targetUser) {
    console.log('[EMAIL LOGIN] request accepted without verified account');
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

  const latestChallenge = getLatestChallengeForUserEmail({
    userId: targetUser.id,
    email: normalized.email,
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
    const codeHash = hashOtpCode({
      challengeId,
      email: normalized.email,
      purpose: 'login',
      code,
    });

    const challenge = createEmailVerificationChallenge({
      id: challengeId,
      userId: targetUser.id,
      email: normalized.email,
      purpose: 'login',
      codeHash,
      expiresAt,
    });

    const emailSender = getEmailSender();
    await emailSender.sendVerificationCode({
      email: normalized.email,
      code,
      expiresInMinutes: OTP_TTL_SECONDS / 60,
    });

    console.log('[EMAIL LOGIN] verification code sent');

    res.status(201).json(buildNeutralChallengeResponse(challenge.id));
  } catch (error) {
    console.error('Failed to request email login code:', error);
    res.status(500).json({ error: 'Не удалось отправить код подтверждения.' });
  }
});

emailLoginRouter.post('/email/verify', (req: Request, res: Response) => {
  if (!ensureEmailVerificationEnabled(res)) {
    return;
  }

  const challengeId =
    typeof req.body?.challengeId === 'string' ? req.body.challengeId.trim() : '';
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';

  if (!challengeId || !/^\d{6}$/.test(code)) {
    res.status(400).json({ error: 'Введите 6-значный код.' });
    return;
  }

  const challenge = findEmailVerificationChallengeById(challengeId);

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

  const isValid = verifyOtpCode({
    challengeId: challenge.id,
    email: challenge.email,
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

  if (!targetUser || targetUser.email_verified !== 1 || targetUser.email !== challenge.email) {
    rejectInvalidLoginCode(res);
    return;
  }

  try {
    const { token } = createSessionForUser(targetUser.id);
    consumeEmailVerificationChallenge(challenge.id);

    res.json({
      user: toUserResponse(targetUser),
      token,
    });
  } catch (error) {
    console.error('Failed to verify email login code:', error);
    res.status(500).json({ error: 'Не удалось выполнить вход.' });
  }
});

export { emailLoginRouter };
