import crypto from 'crypto';
import type { Request, Response } from 'express';
import { Router } from 'express';

import { normalizeEmail } from '../auth/normalize-email';
import { ensureDevOtpBypassEnabled, withDevBypassFlag } from '../auth/dev-otp-bypass';
import {
  checkPasswordLoginRateLimit,
  getPasswordLoginClientIp,
  incrementPasswordLoginEmailFailure,
  recordPasswordLoginAttempt,
  recordPasswordLoginFailure,
  resetPasswordLoginEmailFailures,
  respondPasswordLoginRateLimited,
} from '../auth/password-login-rate-limit';
import { hashPassword, validatePasswordInput, verifyPassword } from '../auth/password';
import { requestEmailVerificationCode } from '../auth/email-verification-send';
import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_REQUESTS_PER_WINDOW,
  OTP_MAX_REQUESTS_WINDOW_SECONDS,
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
import {
  getPasswordCredential,
  setPasswordCredential,
} from '../db/password-credentials-repository';
import {
  createSessionForUser,
  deleteSessionsForUser,
} from '../db/sessions-repository';
import { findUserById, findUserByVerifiedEmail, toUserResponse } from '../db/users-repository';
import { getEmailSender } from '../email/get-email-sender';

const passwordAuthRouter = Router();

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

function respondInvalidCredentials(res: Response): void {
  res.status(401).json({
    error: 'Неверный email или пароль.',
    code: 'INVALID_CREDENTIALS',
  });
}

function rejectInvalidResetCode(res: Response, attemptsLeft?: number): void {
  res.status(400).json({
    error:
      attemptsLeft === 0
        ? 'Превышено число попыток. Запросите новый код.'
        : 'Неверный код.',
    ...(attemptsLeft !== undefined ? { attemptsLeft } : {}),
  });
}

passwordAuthRouter.post('/password/login', async (req: Request, res: Response) => {
  const normalized = normalizeEmail(req.body?.email);

  if (!normalized.ok) {
    respondInvalidCredentials(res);
    return;
  }

  const passwordValidated = validatePasswordInput(req.body?.password);

  if (!passwordValidated.ok) {
    respondInvalidCredentials(res);
    return;
  }

  const ip = getPasswordLoginClientIp(req);
  const rateLimit = checkPasswordLoginRateLimit(normalized.email, ip);

  if (!rateLimit.allowed) {
    respondPasswordLoginRateLimited(res, rateLimit.retryAfterSeconds);
    return;
  }

  recordPasswordLoginAttempt(ip);

  const targetUser = findUserByVerifiedEmail(normalized.email);
  const credential = targetUser ? getPasswordCredential(targetUser.id) : null;

  if (!targetUser || !credential) {
    recordPasswordLoginFailure(normalized.email, ip);
    respondInvalidCredentials(res);
    return;
  }

  try {
    const isValid = await verifyPassword(passwordValidated.password, credential);

    if (!isValid) {
      incrementPasswordLoginEmailFailure(normalized.email);
      respondInvalidCredentials(res);
      return;
    }

    resetPasswordLoginEmailFailures(normalized.email);
    const { token } = createSessionForUser(targetUser.id);

    res.json({
      user: toUserResponse(targetUser),
      token,
    });
  } catch (error) {
    console.error('Failed to login with password:', error);
    res.status(500).json({ error: 'Не удалось выполнить вход.' });
  }
});

passwordAuthRouter.post('/password/reset/request-code', async (req: Request, res: Response) => {
  if (!ensureEmailVerificationEnabled(res)) {
    return;
  }

  const normalized = normalizeEmail(req.body?.email);

  if (!normalized.ok) {
    res.status(201).json(withDevBypassFlag(buildNeutralChallengeResponse(crypto.randomUUID())));
    return;
  }

  const now = Date.now();
  const windowStart = new Date(now - OTP_MAX_REQUESTS_WINDOW_SECONDS * 1000).toISOString();
  const recentEmailCount = countRecentChallengesForEmail({
    email: normalized.email,
    purpose: 'password_reset',
    sinceIso: windowStart,
  });

  if (recentEmailCount >= OTP_MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({ error: 'Слишком много запросов кода. Попробуйте позже.' });
    return;
  }

  const targetUser = findUserByVerifiedEmail(normalized.email);

  if (!targetUser) {
    console.log('[PASSWORD RESET] request accepted');
    res.status(201).json(withDevBypassFlag(buildNeutralChallengeResponse(crypto.randomUUID())));
    return;
  }

  console.log('[PASSWORD RESET] request accepted');

  const sendResult = await requestEmailVerificationCode({
    userId: targetUser.id,
    email: normalized.email,
    purpose: 'password_reset',
    logPrefix: '[PASSWORD RESET]',
    now,
  });

  if (!sendResult.ok) {
    if (sendResult.kind === 'cooldown') {
      console.log('[PASSWORD RESET] cooldown');
      res.status(429).json({
        error: sendResult.message,
        resendAfterSeconds: sendResult.resendAfterSeconds,
      });
      return;
    }

    if (sendResult.kind === 'rate_limited') {
      console.log('[PASSWORD RESET] rate limited');
    }

    res.status(sendResult.kind === 'send_failed' ? 500 : 429).json({ error: sendResult.message });
    return;
  }

  res.status(201).json(withDevBypassFlag(buildNeutralChallengeResponse(sendResult.challengeId)));
});

passwordAuthRouter.post('/password/reset/verify', async (req: Request, res: Response) => {
  if (!ensureEmailVerificationEnabled(res)) {
    return;
  }

  const challengeId =
    typeof req.body?.challengeId === 'string' ? req.body.challengeId.trim() : '';
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const newPasswordValidated = validatePasswordInput(req.body?.newPassword);

  if (!challengeId || !/^\d{6}$/.test(code) || !newPasswordValidated.ok) {
    res.status(400).json({ error: newPasswordValidated.ok ? 'Введите 6-значный код.' : newPasswordValidated.message });
    return;
  }

  const challenge = findEmailVerificationChallengeById(challengeId);

  if (!challenge || challenge.purpose !== 'password_reset') {
    rejectInvalidResetCode(res);
    return;
  }

  if (challenge.consumed_at) {
    rejectInvalidResetCode(res);
    return;
  }

  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    rejectInvalidResetCode(res);
    return;
  }

  if (challenge.attempt_count >= OTP_MAX_ATTEMPTS) {
    rejectInvalidResetCode(res, 0);
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
    rejectInvalidResetCode(res, attemptsLeft);
    return;
  }

  const targetUser = findUserById(challenge.user_id);

  if (!targetUser || targetUser.email_verified !== 1 || targetUser.email !== challenge.email) {
    rejectInvalidResetCode(res);
    return;
  }

  try {
    const material = await hashPassword(newPasswordValidated.password);

    setPasswordCredential({
      userId: targetUser.id,
      passwordHash: material.passwordHash,
      passwordSalt: material.passwordSalt,
    });

    consumeEmailVerificationChallenge(challenge.id);
    deleteSessionsForUser(targetUser.id);

    const { token } = createSessionForUser(targetUser.id);

    res.json({
      user: toUserResponse(targetUser),
      token,
    });
  } catch (error) {
    console.error('Failed to verify password reset code:', error);
    res.status(500).json({ error: 'Не удалось сбросить пароль.' });
  }
});

export { passwordAuthRouter };
