import crypto from 'crypto';

import {
  generateOtpCode,
  hashOtpCode,
  OTP_MAX_REQUESTS_PER_WINDOW,
  OTP_MAX_REQUESTS_WINDOW_SECONDS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
} from './otp-code';
import {
  countRecentChallengesForEmail,
  countRecentChallengesForUser,
  createEmailVerificationChallenge,
  deleteEmailVerificationChallenge,
  getLatestChallengeForUserEmail,
  type EmailVerificationPurpose,
} from '../db/email-verification-challenges-repository';
import { getEmailSender } from '../email/get-email-sender';

export type EmailVerificationSendResult =
  | {
      ok: true;
      challengeId: string;
      expiresInSeconds: number;
      resendAfterSeconds: number;
    }
  | {
      ok: false;
      kind: 'rate_limited' | 'cooldown' | 'send_failed';
      message: string;
      resendAfterSeconds?: number;
    };

type RequestEmailVerificationCodeParams = {
  userId: string;
  email: string;
  purpose: EmailVerificationPurpose;
  logPrefix: string;
  now?: number;
};

export async function requestEmailVerificationCode({
  userId,
  email,
  purpose,
  logPrefix,
  now = Date.now(),
}: RequestEmailVerificationCodeParams): Promise<EmailVerificationSendResult> {
  const windowStart = new Date(now - OTP_MAX_REQUESTS_WINDOW_SECONDS * 1000).toISOString();
  const recentEmailCount = countRecentChallengesForEmail({
    email,
    purpose,
    sinceIso: windowStart,
  });

  if (recentEmailCount >= OTP_MAX_REQUESTS_PER_WINDOW) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`${logPrefix} rate limited (email window)`);
    }

    return {
      ok: false,
      kind: 'rate_limited',
      message: 'Слишком много запросов кода. Попробуйте позже.',
    };
  }

  const recentUserCount = countRecentChallengesForUser({
    userId,
    purpose,
    sinceIso: windowStart,
  });

  if (recentUserCount >= OTP_MAX_REQUESTS_PER_WINDOW) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`${logPrefix} rate limited (user window)`);
    }

    return {
      ok: false,
      kind: 'rate_limited',
      message: 'Слишком много запросов кода. Попробуйте позже.',
    };
  }

  const latestChallenge = getLatestChallengeForUserEmail({
    userId,
    email,
    purpose,
  });

  if (latestChallenge) {
    const lastSentAt = new Date(latestChallenge.last_sent_at).getTime();
    const elapsedSeconds = Math.floor((now - lastSentAt) / 1000);

    if (elapsedSeconds < OTP_RESEND_COOLDOWN_SECONDS) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`${logPrefix} cooldown`);
      }

      return {
        ok: false,
        kind: 'cooldown',
        message: 'Подождите перед повторной отправкой кода.',
        resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds,
      };
    }
  }

  const code = generateOtpCode();
  const challengeId = crypto.randomUUID();
  const expiresAt = new Date(now + OTP_TTL_SECONDS * 1000).toISOString();
  const codeHash = hashOtpCode({
    challengeId,
    email,
    purpose,
    code,
  });

  const challenge = createEmailVerificationChallenge({
    id: challengeId,
    userId,
    email,
    purpose,
    codeHash,
    expiresAt,
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log(`${logPrefix} challenge created`);
  }

  try {
    const emailSender = getEmailSender();
    await emailSender.sendVerificationCode({
      email,
      code,
      expiresInMinutes: OTP_TTL_SECONDS / 60,
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`${logPrefix} code sent`);
    }
  } catch (error) {
    deleteEmailVerificationChallenge(challenge.id);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`${logPrefix} send failed`);
    }

    console.error(`${logPrefix} failed to send verification code:`, error);

    return {
      ok: false,
      kind: 'send_failed',
      message: 'Не удалось отправить код подтверждения.',
    };
  }

  return {
    ok: true,
    challengeId: challenge.id,
    expiresInSeconds: OTP_TTL_SECONDS,
    resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
  };
}
