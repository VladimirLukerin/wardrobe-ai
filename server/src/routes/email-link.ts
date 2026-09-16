import crypto from 'crypto';
import type { Request, Response } from 'express';
import { Router } from 'express';

import { normalizeEmail } from '../auth/normalize-email';
import { ensureDevOtpBypassEnabled, withDevBypassFlag } from '../auth/dev-otp-bypass';
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
  countRecentChallengesForUser,
  createEmailVerificationChallenge,
  findEmailVerificationChallengeById,
  getLatestChallengeForUserEmail,
  incrementChallengeAttemptCount,
} from '../db/email-verification-challenges-repository';
import {
  findUserById,
  findUserByVerifiedEmail,
  linkVerifiedEmailToUser,
  toUserResponse,
} from '../db/users-repository';
import { getEmailSender } from '../email/get-email-sender';
import { requireAuth } from '../middleware/auth';

const emailLinkRouter = Router();

function sendDomainError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: message, code });
}

function ensureEmailVerificationEnabled(res: Response): boolean {
  if (!isEmailVerificationConfigured()) {
    res.status(503).json({ error: 'Email verification is temporarily unavailable.' });
    return false;
  }

  return true;
}

emailLinkRouter.post('/email/request-code', requireAuth, async (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!ensureEmailVerificationEnabled(res)) {
    return;
  }

  const normalized = normalizeEmail(req.body?.email);

  if (!normalized.ok) {
    res.status(400).json({ error: 'Введите корректный email.' });
    return;
  }

  const currentUser = findUserById(req.authUser.id);

  if (!currentUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (
    currentUser.email === normalized.email &&
    currentUser.email_verified === 1
  ) {
    sendDomainError(res, 409, 'EMAIL_ALREADY_VERIFIED', 'Email уже подключён.');
    return;
  }

  const existingVerifiedUser = findUserByVerifiedEmail(normalized.email);

  if (existingVerifiedUser && existingVerifiedUser.id !== currentUser.id) {
    sendDomainError(res, 409, 'EMAIL_ALREADY_IN_USE', 'Этот email уже привязан к другому аккаунту.');
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

  const latestChallenge = getLatestChallengeForUserEmail({
    userId: currentUser.id,
    email: normalized.email,
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
    const codeHash = hashOtpCode({
      challengeId,
      email: normalized.email,
      purpose: 'link',
      code,
    });

    const challenge = createEmailVerificationChallenge({
      id: challengeId,
      userId: currentUser.id,
      email: normalized.email,
      purpose: 'link',
      codeHash,
      expiresAt,
    });

    const emailSender = getEmailSender();
    await emailSender.sendVerificationCode({
      email: normalized.email,
      code,
      expiresInMinutes: OTP_TTL_SECONDS / 60,
    });

    res.status(201).json(
      withDevBypassFlag({
        challengeId: challenge.id,
        expiresInSeconds: OTP_TTL_SECONDS,
        resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
      }),
    );
  } catch (error) {
    console.error('Failed to request email verification code:', error);
    res.status(500).json({ error: 'Не удалось отправить код подтверждения.' });
  }
});

emailLinkRouter.post('/email/verify', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

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

    res.status(400).json({
      error: attemptsLeft > 0 ? 'Неверный код.' : 'Превышено число попыток. Запросите новый код.',
      attemptsLeft,
    });
    return;
  }

  const existingVerifiedUser = findUserByVerifiedEmail(challenge.email);

  if (existingVerifiedUser && existingVerifiedUser.id !== req.authUser.id) {
    sendDomainError(res, 409, 'EMAIL_ALREADY_IN_USE', 'Этот email уже привязан к другому аккаунту.');
    return;
  }

  try {
    const updatedUser = linkVerifiedEmailToUser(req.authUser.id, challenge.email);

    if (!updatedUser) {
      res.status(500).json({ error: 'Не удалось подтвердить email.' });
      return;
    }

    consumeEmailVerificationChallenge(challenge.id);

    res.json({
      user: toUserResponse(updatedUser),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('UNIQUE constraint failed: users.email')) {
      sendDomainError(res, 409, 'EMAIL_ALREADY_IN_USE', 'Этот email уже привязан к другому аккаунту.');
      return;
    }

    console.error('Failed to verify email link code:', error);
    res.status(500).json({ error: 'Не удалось подтвердить email.' });
  }
});

emailLinkRouter.post('/email/dev-bypass', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!ensureDevOtpBypassEnabled(res)) {
    return;
  }

  if (!ensureEmailVerificationEnabled(res)) {
    return;
  }

  const challengeId =
    typeof req.body?.challengeId === 'string' ? req.body.challengeId.trim() : '';

  if (!challengeId) {
    res.status(400).json({ error: 'Challenge id is required.' });
    return;
  }

  const challenge = findEmailVerificationChallengeById(challengeId);

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

  const existingVerifiedUser = findUserByVerifiedEmail(challenge.email);

  if (existingVerifiedUser && existingVerifiedUser.id !== req.authUser.id) {
    sendDomainError(res, 409, 'EMAIL_ALREADY_IN_USE', 'Этот email уже привязан к другому аккаунту.');
    return;
  }

  try {
    const updatedUser = linkVerifiedEmailToUser(req.authUser.id, challenge.email);

    if (!updatedUser) {
      res.status(500).json({ error: 'Не удалось подтвердить email.' });
      return;
    }

    consumeEmailVerificationChallenge(challenge.id);

    console.log('[EMAIL LINK] dev bypass completed');

    res.json({
      user: toUserResponse(updatedUser),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('UNIQUE constraint failed: users.email')) {
      sendDomainError(res, 409, 'EMAIL_ALREADY_IN_USE', 'Этот email уже привязан к другому аккаунту.');
      return;
    }

    console.error('Failed to dev-bypass email link:', error);
    res.status(500).json({ error: 'Не удалось подтвердить email.' });
  }
});

export { emailLinkRouter };
