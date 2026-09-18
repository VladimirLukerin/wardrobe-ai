import crypto from 'crypto';

import { requestEmailVerificationCode } from '../src/auth/email-verification-send';
import { OTP_MAX_REQUESTS_PER_WINDOW, OTP_MAX_REQUESTS_WINDOW_SECONDS } from '../src/auth/otp-code';
import { closeDatabase, getDatabase } from '../src/db/database';
import {
  countRecentChallengesForUser,
  createEmailVerificationChallenge,
  deleteEmailVerificationChallenge,
  findEmailVerificationChallengeById,
} from '../src/db/email-verification-challenges-repository';
import { hashOtpCode } from '../src/auth/otp-code';
import { setEmailSenderForTests } from '../src/email/get-email-sender';
import type { EmailSender } from '../src/email/email-sender';
import { createAnonymousUser, linkVerifiedEmailToUser } from '../src/db/users-repository';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function createChallenge({
  userId,
  email,
  purpose,
}: {
  userId: string;
  email: string;
  purpose: 'login' | 'password_reset';
}): string {
  const challengeId = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = new Date(now + 10 * 60 * 1000).toISOString();
  const codeHash = hashOtpCode({
    challengeId,
    email,
    purpose,
    code: '123456',
  });

  createEmailVerificationChallenge({
    id: challengeId,
    userId,
    email,
    purpose,
    codeHash,
    expiresAt,
  });

  return challengeId;
}

function testPurposeBudgetsAreIndependent(): void {
  getDatabase();
  process.env.AUTH_OTP_SECRET = process.env.AUTH_OTP_SECRET ?? 'test-otp-secret';

  const user = createAnonymousUser('OTP Budget User');
  const email = `otp-budget-${crypto.randomUUID()}@example.com`;
  linkVerifiedEmailToUser(user.id, email);
  const now = Date.now();
  const sinceIso = new Date(now - OTP_MAX_REQUESTS_WINDOW_SECONDS * 1000).toISOString();

  for (let index = 0; index < 4; index += 1) {
    createChallenge({ userId: user.id, email, purpose: 'login' });
  }

  createChallenge({ userId: user.id, email, purpose: 'password_reset' });

  const loginCount = countRecentChallengesForUser({
    userId: user.id,
    purpose: 'login',
    sinceIso,
  });
  const resetCount = countRecentChallengesForUser({
    userId: user.id,
    purpose: 'password_reset',
    sinceIso,
  });

  assert(loginCount === 4, `Expected 4 login challenges, got ${loginCount}`);
  assert(resetCount === 1, `Expected 1 password_reset challenge, got ${resetCount}`);
  assert(
    resetCount < OTP_MAX_REQUESTS_PER_WINDOW,
    'Password reset budget should not include login challenges',
  );

  console.log('OK purpose-specific OTP budgets');
}

async function testFailedSendDoesNotLeaveBlockingChallenge(): Promise<void> {
  getDatabase();
  process.env.AUTH_OTP_SECRET = process.env.AUTH_OTP_SECRET ?? 'test-otp-secret';

  const failingSender: EmailSender = {
    sendVerificationCode: async () => {
      throw new Error('Simulated send failure');
    },
  };

  setEmailSenderForTests(failingSender);

  const user = createAnonymousUser('Send Failure User');
  const email = `send-failure-${crypto.randomUUID()}@example.com`;
  linkVerifiedEmailToUser(user.id, email);

  const firstAttempt = await requestEmailVerificationCode({
    userId: user.id,
    email,
    purpose: 'password_reset',
    logPrefix: '[TEST PASSWORD RESET]',
  });

  assert(!firstAttempt.ok, 'Expected send failure result');
  assert(firstAttempt.ok === false && firstAttempt.kind === 'send_failed', 'Expected send_failed kind');

  const sinceIso = new Date(Date.now() - OTP_MAX_REQUESTS_WINDOW_SECONDS * 1000).toISOString();
  const resetCount = countRecentChallengesForUser({
    userId: user.id,
    purpose: 'password_reset',
    sinceIso,
  });

  assert(resetCount === 0, 'Failed send should not leave a challenge that consumes budget');

  setEmailSenderForTests(null);

  const secondAttempt = await requestEmailVerificationCode({
    userId: user.id,
    email,
    purpose: 'password_reset',
    logPrefix: '[TEST PASSWORD RESET]',
  });

  assert(secondAttempt.ok, 'Expected immediate retry after failed send to succeed');

  if (secondAttempt.ok) {
    const created = findEmailVerificationChallengeById(secondAttempt.challengeId);
    assert(created !== null, 'Expected retry to create a challenge');

    deleteEmailVerificationChallenge(secondAttempt.challengeId);
  }

  console.log('OK failed email send cleanup');
}

async function main(): Promise<void> {
  try {
    testPurposeBudgetsAreIndependent();
    await testFailedSendDoesNotLeaveBlockingChallenge();
    console.log('All OTP request budget tests passed.');
  } finally {
    setEmailSenderForTests(null);
    closeDatabase();
  }
}

void main();
