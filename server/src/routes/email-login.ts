import crypto from 'crypto';
import type { Request, Response } from 'express';
import { Router } from 'express';

import { ensureDevOtpBypassEnabled, withDevBypassFlag } from '../auth/dev-otp-bypass';
import { requestEmailVerificationCode } from '../auth/email-verification-send';
import { normalizeEmail } from '../auth/normalize-email';
import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
  isEmailVerificationConfigured,
  verifyOtpCode,
} from '../auth/otp-code';
import {
  consumeEmailVerificationChallenge,
  countRecentChallengesForEmail,
  findEmailVerificationChallengeById,
  incrementChallengeAttemptCount,
} from '../db/email-verification-challenges-repository';
import { createSessionForUser } from '../db/sessions-repository';
import { findUserById, findUserByVerifiedEmail, toUserResponse } from '../db/users-repository';

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

  const targetUser = findUserByVerifiedEmail(normalized.email);

  if (!targetUser) {
    console.log('[EMAIL LOGIN] request accepted without verified account');
    res.status(201).json(withDevBypassFlag(buildNeutralChallengeResponse(crypto.randomUUID())));
    return;
  }

  const sendResult = await requestEmailVerificationCode({
    userId: targetUser.id,
    email: normalized.email,
    purpose: 'login',
    logPrefix: '[EMAIL LOGIN]',
  });

  if (!sendResult.ok) {
    if (sendResult.kind === 'cooldown') {
      res.status(429).json({
        error: sendResult.message,
        resendAfterSeconds: sendResult.resendAfterSeconds,
      });
      return;
    }

    res.status(sendResult.kind === 'send_failed' ? 500 : 429).json({ error: sendResult.message });
    return;
  }

  res.status(201).json(withDevBypassFlag(buildNeutralChallengeResponse(sendResult.challengeId)));
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

emailLoginRouter.post('/email/dev-bypass', (req: Request, res: Response) => {
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

  const targetUser = findUserById(challenge.user_id);

  if (!targetUser || targetUser.email_verified !== 1 || targetUser.email !== challenge.email) {
    rejectInvalidLoginCode(res);
    return;
  }

  try {
    const { token } = createSessionForUser(targetUser.id);
    consumeEmailVerificationChallenge(challenge.id);

    console.log('[EMAIL LOGIN] dev bypass completed');

    res.json({
      user: toUserResponse(targetUser),
      token,
    });
  } catch (error) {
    console.error('Failed to dev-bypass email login:', error);
    res.status(500).json({ error: 'Не удалось выполнить вход.' });
  }
});

export { emailLoginRouter };
