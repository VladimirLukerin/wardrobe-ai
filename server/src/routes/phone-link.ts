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
  countRecentChallengesForUser,
  createPhoneVerificationChallenge,
  findPhoneVerificationChallengeById,
  getLatestChallengeForUserPhone,
  incrementChallengeAttemptCount,
} from '../db/phone-verification-challenges-repository';
import {
  findUserById,
  findUserByVerifiedPhone,
  setVerifiedPhone,
  toUserResponse,
} from '../db/users-repository';
import { requireAuth } from '../middleware/auth';
import { getSmsSender } from '../sms/get-sms-sender';

const phoneLinkRouter = Router();

function sendDomainError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: message, code });
}

function ensurePhoneVerificationEnabled(res: Response): boolean {
  if (!isPhoneVerificationConfigured()) {
    res.status(503).json({ error: 'Phone verification is temporarily unavailable.' });
    return false;
  }

  return true;
}

phoneLinkRouter.post('/phone/request-code', requireAuth, async (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!ensurePhoneVerificationEnabled(res)) {
    return;
  }

  const normalized = normalizePhone(req.body?.phone);

  if (!normalized.ok) {
    sendDomainError(res, 400, 'INVALID_PHONE', 'Введите корректный номер телефона.');
    return;
  }

  const currentUser = findUserById(req.authUser.id);

  if (!currentUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (currentUser.phone === normalized.phone && currentUser.phone_verified === 1) {
    sendDomainError(res, 409, 'PHONE_ALREADY_VERIFIED', 'Телефон уже подключён.');
    return;
  }

  const existingVerifiedUser = findUserByVerifiedPhone(normalized.phone);

  if (existingVerifiedUser && existingVerifiedUser.id !== currentUser.id) {
    sendDomainError(res, 409, 'PHONE_ALREADY_IN_USE', 'Этот номер уже привязан к другому аккаунту.');
    return;
  }

  const now = Date.now();
  const windowStart = new Date(now - OTP_MAX_REQUESTS_WINDOW_SECONDS * 1000).toISOString();
  const recentCount = countRecentChallengesForUser({
    userId: currentUser.id,
    sinceIso: windowStart,
  });

  if (recentCount >= OTP_MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({ error: 'Слишком много запросов кода. Попробуйте позже.' });
    return;
  }

  const latestChallenge = getLatestChallengeForUserPhone({
    userId: currentUser.id,
    phone: normalized.phone,
    purpose: 'link',
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
      purpose: 'link',
      code,
    });

    const challenge = createPhoneVerificationChallenge({
      id: challengeId,
      userId: currentUser.id,
      phone: normalized.phone,
      purpose: 'link',
      codeHash,
      expiresAt,
    });

    const smsSender = getSmsSender();
    await smsSender.sendVerificationCode({
      phone: normalized.phone,
      code,
      expiresInMinutes: OTP_TTL_SECONDS / 60,
    });

    res.status(201).json({
      challengeId: challenge.id,
      expiresInSeconds: OTP_TTL_SECONDS,
      resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    });
  } catch (error) {
    console.error('Failed to request phone verification code:', error);
    res.status(500).json({ error: 'Не удалось отправить код подтверждения.' });
  }
});

phoneLinkRouter.post('/phone/verify', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

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

  if (!challenge || challenge.user_id !== req.authUser.id) {
    res.status(404).json({ error: 'Код подтверждения не найден.' });
    return;
  }

  if (challenge.purpose !== 'link') {
    res.status(400).json({ error: 'Неверный код подтверждения.' });
    return;
  }

  if (challenge.consumed_at) {
    res.status(410).json({ error: 'Код уже использован.' });
    return;
  }

  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    res.status(410).json({ error: 'Срок действия кода истёк.' });
    return;
  }

  if (challenge.attempt_count >= OTP_MAX_ATTEMPTS) {
    res.status(410).json({ error: 'Превышено число попыток. Запросите новый код.' });
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

    res.status(400).json({
      error: attemptsLeft > 0 ? 'Неверный код.' : 'Превышено число попыток. Запросите новый код.',
      attemptsLeft,
    });
    return;
  }

  const existingVerifiedUser = findUserByVerifiedPhone(challenge.phone);

  if (existingVerifiedUser && existingVerifiedUser.id !== req.authUser.id) {
    sendDomainError(res, 409, 'PHONE_ALREADY_IN_USE', 'Этот номер уже привязан к другому аккаунту.');
    return;
  }

  try {
    const updatedUser = setVerifiedPhone(req.authUser.id, challenge.phone);

    if (!updatedUser) {
      res.status(500).json({ error: 'Не удалось подтвердить телефон.' });
      return;
    }

    consumePhoneVerificationChallenge(challenge.id);

    res.json({
      user: toUserResponse(updatedUser),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('UNIQUE constraint failed: users.phone')) {
      sendDomainError(res, 409, 'PHONE_ALREADY_IN_USE', 'Этот номер уже привязан к другому аккаунту.');
      return;
    }

    console.error('Failed to verify phone link code:', error);
    res.status(500).json({ error: 'Не удалось подтвердить телефон.' });
  }
});

export { phoneLinkRouter };
