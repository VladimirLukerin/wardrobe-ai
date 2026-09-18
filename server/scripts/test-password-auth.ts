import crypto from 'crypto';

import {
  hashPassword,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  validatePasswordInput,
  verifyPassword,
} from '../src/auth/password';
import {
  checkPasswordLoginRateLimit,
  incrementPasswordLoginEmailFailure,
  PASSWORD_LOGIN_EMAIL_MAX_FAILED,
  PASSWORD_LOGIN_IP_MAX_ATTEMPTS,
  PASSWORD_LOGIN_WINDOW_MS,
  recordPasswordLoginAttempt,
  recordPasswordLoginFailure,
  resetPasswordLoginEmailFailures,
  resetPasswordLoginRateLimitsForTests,
  setPasswordLoginRateLimitClockForTests,
} from '../src/auth/password-login-rate-limit';
import { closeDatabase, getDatabase } from '../src/db/database';
import {
  consumeEmailVerificationChallenge,
  createEmailVerificationChallenge,
  findEmailVerificationChallengeById,
} from '../src/db/email-verification-challenges-repository';
import {
  getPasswordCredential,
  hasPasswordCredential,
  setPasswordCredential,
} from '../src/db/password-credentials-repository';
import {
  createSessionForUser,
  deleteSessionsForUser,
  findSessionByTokenHash,
} from '../src/db/sessions-repository';
import { hashSessionToken } from '../src/db/token-hash';
import { hashOtpCode } from '../src/auth/otp-code';
import {
  createAnonymousUser,
  findUserByVerifiedEmail,
  linkVerifiedEmailToUser,
  toUserResponse,
} from '../src/db/users-repository';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function testPasswordHashAndVerify(): Promise<void> {
  const password = 'my-secret-password';
  const material = await hashPassword(password);
  const credential = {
    password_hash: material.passwordHash,
    password_salt: material.passwordSalt,
  };

  assert(await verifyPassword(password, credential), 'Same password should verify');
  assert(!(await verifyPassword('wrong-password', credential)), 'Wrong password should fail');

  const secondMaterial = await hashPassword(password);
  assert(
    secondMaterial.passwordHash !== material.passwordHash ||
      secondMaterial.passwordSalt !== material.passwordSalt,
    'Different salts should produce different stored hashes',
  );

  const unicodeMaterial = await hashPassword('пароль123');
  assert(
    await verifyPassword('пароль123', {
      password_hash: unicodeMaterial.passwordHash,
      password_salt: unicodeMaterial.passwordSalt,
    }),
    'Unicode password should work',
  );

  console.log('OK password hash and verify');
}

function testPasswordValidation(): void {
  assert(MIN_PASSWORD_LENGTH === 8, 'Expected min password length 8');
  assert(MAX_PASSWORD_LENGTH === 128, 'Expected max password length 128');

  assert(!validatePasswordInput('1234567').ok, 'Too short password should fail');
  assert(validatePasswordInput('12345678').ok, 'Min length password should pass');
  assert(validatePasswordInput(' abcdef ').ok, 'Untrimmed password should pass');
  assert(!validatePasswordInput('x'.repeat(MAX_PASSWORD_LENGTH + 1)).ok, 'Too long password should fail');

  console.log('OK password validation');
}

async function testLoginSemantics(): Promise<void> {
  getDatabase();
  process.env.AUTH_OTP_SECRET = process.env.AUTH_OTP_SECRET ?? 'test-otp-secret';

  const user = createAnonymousUser('Password User');
  linkVerifiedEmailToUser(user.id, 'login-user@example.com');

  const verified = findUserByVerifiedEmail('login-user@example.com');
  assert(verified !== null, 'Verified user should exist');

  const material = await hashPassword('correct-password');
  setPasswordCredential({
    userId: verified.id,
    passwordHash: material.passwordHash,
    passwordSalt: material.passwordSalt,
  });

  assert(hasPasswordCredential(verified.id), 'Password credential should exist');
  assert(toUserResponse(verified).hasPassword, 'User response should expose hasPassword');
  assert(
    !(await verifyPassword('wrong-password', getPasswordCredential(verified.id)!)),
    'Wrong password should fail verification',
  );

  const missingCredentialUser = createAnonymousUser('No Password');
  linkVerifiedEmailToUser(missingCredentialUser.id, 'no-password@example.com');
  assert(
    !hasPasswordCredential(missingCredentialUser.id),
    'Verified user without password should not have credential',
  );

  console.log('OK login semantics');
}

async function testRateLimiter(): Promise<void> {
  resetPasswordLoginRateLimitsForTests();
  let now = 0;
  setPasswordLoginRateLimitClockForTests(() => now);

  const email = 'rate-limit@example.com';
  const ip = '127.0.0.1';

  for (let index = 0; index < PASSWORD_LOGIN_IP_MAX_ATTEMPTS; index += 1) {
    const result = checkPasswordLoginRateLimit(email, ip, now);
    assert(result.allowed, `Expected attempt ${index + 1} to be allowed`);
    recordPasswordLoginAttempt(ip, now);
  }

  const blockedIp = checkPasswordLoginRateLimit(email, ip, now);
  assert(!blockedIp.allowed, 'Expected IP bucket to block further attempts');

  resetPasswordLoginRateLimitsForTests();
  now = 0;
  setPasswordLoginRateLimitClockForTests(() => now);

  for (let index = 0; index < PASSWORD_LOGIN_EMAIL_MAX_FAILED; index += 1) {
    recordPasswordLoginFailure(email, ip, now);
  }

  const blockedEmail = checkPasswordLoginRateLimit(email, ip, now);
  assert(!blockedEmail.allowed, 'Expected email failure bucket to block further attempts');

  resetPasswordLoginRateLimitsForTests();
  now = 0;
  setPasswordLoginRateLimitClockForTests(() => now);

  recordPasswordLoginFailure('user-a@example.com', ip, now);
  recordPasswordLoginFailure('user-b@example.com', ip, now);
  incrementPasswordLoginEmailFailure('user-a@example.com', now);
  resetPasswordLoginEmailFailures('user-a@example.com', now);

  const userAResult = checkPasswordLoginRateLimit('user-a@example.com', ip, now);
  assert(userAResult.allowed, 'Reset should clear email failure bucket');

  resetPasswordLoginRateLimitsForTests();
  setPasswordLoginRateLimitClockForTests(Date.now);

  now = 0;
  setPasswordLoginRateLimitClockForTests(() => now);
  recordPasswordLoginFailure(email, ip, now);
  now = PASSWORD_LOGIN_WINDOW_MS + 1;
  const afterExpiry = checkPasswordLoginRateLimit(email, ip, now);
  assert(afterExpiry.allowed, 'Expired buckets should allow attempts again');

  resetPasswordLoginRateLimitsForTests();
  setPasswordLoginRateLimitClockForTests(Date.now);

  console.log('OK rate limiter');
}

async function testResetFlow(): Promise<void> {
  getDatabase();
  process.env.AUTH_OTP_SECRET = process.env.AUTH_OTP_SECRET ?? 'test-otp-secret';

  const user = createAnonymousUser('Reset User');
  linkVerifiedEmailToUser(user.id, 'reset-user@example.com');

  const material = await hashPassword('old-password');
  setPasswordCredential({
    userId: user.id,
    passwordHash: material.passwordHash,
    passwordSalt: material.passwordSalt,
  });

  const firstSession = createSessionForUser(user.id);
  const secondSession = createSessionForUser(user.id);

  const challengeId = crypto.randomUUID();
  const code = '123456';
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const codeHash = hashOtpCode({
    challengeId,
    email: 'reset-user@example.com',
    purpose: 'password_reset',
    code,
  });

  createEmailVerificationChallenge({
    id: challengeId,
    userId: user.id,
    email: 'reset-user@example.com',
    purpose: 'password_reset',
    codeHash,
    expiresAt,
  });

  const challenge = findEmailVerificationChallengeById(challengeId);
  assert(challenge !== null, 'Challenge should exist');

  const newMaterial = await hashPassword('new-password-123');
  setPasswordCredential({
    userId: user.id,
    passwordHash: newMaterial.passwordHash,
    passwordSalt: newMaterial.passwordSalt,
  });
  consumeEmailVerificationChallenge(challengeId);
  deleteSessionsForUser(user.id);
  const freshSession = createSessionForUser(user.id);

  assert(
    findSessionByTokenHash(hashSessionToken(firstSession.token)) === null,
    'Old sessions should be invalidated after reset',
  );
  assert(
    findSessionByTokenHash(hashSessionToken(secondSession.token)) === null,
    'All old sessions should be invalidated after reset',
  );
  assert(
    findSessionByTokenHash(hashSessionToken(freshSession.token)) !== null,
    'Fresh session should exist after reset',
  );

  const consumed = findEmailVerificationChallengeById(challengeId);
  assert(consumed?.consumed_at !== null, 'Challenge should be consumed');

  const reusedChallenge = findEmailVerificationChallengeById(challengeId);
  assert(reusedChallenge?.consumed_at !== null, 'Challenge cannot be reused');

  const expiredChallengeId = crypto.randomUUID();
  createEmailVerificationChallenge({
    id: expiredChallengeId,
    userId: user.id,
    email: 'reset-user@example.com',
    purpose: 'password_reset',
    codeHash: hashOtpCode({
      challengeId: expiredChallengeId,
      email: 'reset-user@example.com',
      purpose: 'password_reset',
      code: '654321',
    }),
    expiresAt: new Date(Date.now() - 1_000).toISOString(),
  });

  const expired = findEmailVerificationChallengeById(expiredChallengeId);
  assert(
    expired !== null && new Date(expired.expires_at).getTime() <= Date.now(),
    'Expired challenge should have past expires_at',
  );

  assert(
    await verifyPassword('new-password-123', getPasswordCredential(user.id)!),
    'Reset password should verify',
  );

  console.log('OK reset flow');
}

async function main(): Promise<void> {
  await testPasswordHashAndVerify();
  testPasswordValidation();
  await testLoginSemantics();
  await testRateLimiter();
  await testResetFlow();
  console.log('All password auth checks passed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    closeDatabase();
  });
