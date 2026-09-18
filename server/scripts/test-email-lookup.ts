import crypto from 'crypto';

import {
  checkEmailLookupRateLimit,
  EMAIL_LOOKUP_EMAIL_MAX_ATTEMPTS,
  EMAIL_LOOKUP_IP_MAX_ATTEMPTS,
  EMAIL_LOOKUP_WINDOW_MS,
  hashEmailForLookupRateLimit,
  hashIpForLookupRateLimit,
  resetEmailLookupRateLimitsForTests,
  setEmailLookupRateLimitClockForTests,
} from '../src/auth/email-lookup-rate-limit';
import { normalizeEmail } from '../src/auth/normalize-email';
import { closeDatabase, getDatabase } from '../src/db/database';
import {
  hasPasswordCredential,
  setPasswordCredential,
} from '../src/db/password-credentials-repository';
import { hashPassword } from '../src/auth/password';
import {
  createAnonymousUser,
  findUserByVerifiedEmail,
  linkVerifiedEmailToUser,
} from '../src/db/users-repository';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function testLookupExistingWithPassword(): Promise<void> {
  getDatabase();
  const suffix = crypto.randomUUID();

  const user = createAnonymousUser('Lookup Password User');
  linkVerifiedEmailToUser(user.id, `lookup-password-${suffix}@example.com`);

  const material = await hashPassword('lookup-password');
  setPasswordCredential({
    userId: user.id,
    passwordHash: material.passwordHash,
    passwordSalt: material.passwordSalt,
  });

  const target = findUserByVerifiedEmail(`lookup-password-${suffix}@example.com`);
  assert(target !== null, 'Expected verified user');
  assert(hasPasswordCredential(target.id), 'Expected password credential');

  console.log('OK lookup existing email with password');
}

async function testLookupExistingWithoutPassword(): Promise<void> {
  getDatabase();
  const suffix = crypto.randomUUID();

  const user = createAnonymousUser('Lookup No Password');
  linkVerifiedEmailToUser(user.id, `lookup-no-password-${suffix}@example.com`);

  const target = findUserByVerifiedEmail(`lookup-no-password-${suffix}@example.com`);
  assert(target !== null, 'Expected verified user');
  assert(!hasPasswordCredential(target.id), 'Expected no password credential');

  console.log('OK lookup existing email without password');
}

function testLookupUnknownEmail(): void {
  getDatabase();

  const target = findUserByVerifiedEmail('unknown-lookup@example.com');
  assert(target === null, 'Unknown email should not match a user');

  console.log('OK lookup unknown email');
}

function testInvalidEmailNormalization(): void {
  const invalid = normalizeEmail('not-an-email');
  assert(!invalid.ok, 'Invalid email should fail normalization');

  console.log('OK invalid email normalization');
}

function testRateLimitThresholdAndExpiry(): void {
  resetEmailLookupRateLimitsForTests();

  let now = 0;
  setEmailLookupRateLimitClockForTests(() => now);

  const email = 'rate-limit@example.com';
  const ip = '127.0.0.1';

  for (let attempt = 0; attempt < EMAIL_LOOKUP_IP_MAX_ATTEMPTS; attempt += 1) {
    const result = checkEmailLookupRateLimit(`ip-limit-${attempt}@example.com`, ip, now);
    assert(result.allowed, `Expected IP attempt ${attempt + 1} to be allowed`);
  }

  const blocked = checkEmailLookupRateLimit('ip-limit-blocked@example.com', ip, now);
  assert(!blocked.allowed, 'Expected IP rate limit to block');
  assert(
    blocked.allowed === false && blocked.retryAfterSeconds > 0,
    'Expected retry-after seconds on IP block',
  );

  now += EMAIL_LOOKUP_WINDOW_MS;
  resetEmailLookupRateLimitsForTests();
  setEmailLookupRateLimitClockForTests(() => now);

  const afterWindow = checkEmailLookupRateLimit(email, ip, now);
  assert(afterWindow.allowed, 'Expected rate limit window to reset');

  console.log('OK lookup rate limit threshold and expiry');
}

function testIndependentIpAndEmailLimits(): void {
  resetEmailLookupRateLimitsForTests();
  setEmailLookupRateLimitClockForTests(() => 0);

  const email = 'same-email-bucket@example.com';

  for (let attempt = 0; attempt < EMAIL_LOOKUP_EMAIL_MAX_ATTEMPTS; attempt += 1) {
    const result = checkEmailLookupRateLimit(email, `10.0.0.${attempt}`, 0);
    assert(result.allowed, `Expected email bucket attempt ${attempt + 1} to be allowed`);
  }

  const blockedEmailBucket = checkEmailLookupRateLimit(email, '10.0.0.99', 0);
  assert(!blockedEmailBucket.allowed, 'Expected per-email bucket to block');

  const differentEmail = checkEmailLookupRateLimit('different-user@example.com', '10.0.0.99', 0);
  assert(differentEmail.allowed, 'Expected different email bucket to remain independent');

  console.log('OK lookup independent IP and email rate limits');
}

function testHashedKeysNotRawEmail(): void {
  const normalizedEmail = 'secret@example.com';
  const hashed = hashEmailForLookupRateLimit(normalizedEmail);

  assert(hashed !== normalizedEmail, 'Rate limit key must not use raw email');
  assert(!hashed.includes('@'), 'Rate limit key must not contain email characters');

  const ipHash = hashIpForLookupRateLimit('127.0.0.1');
  assert(ipHash !== '127.0.0.1', 'Rate limit key must not use raw IP');

  console.log('OK lookup hashed rate-limit keys');
}

async function main(): Promise<void> {
  try {
    await testLookupExistingWithPassword();
    await testLookupExistingWithoutPassword();
    testLookupUnknownEmail();
    testInvalidEmailNormalization();
    testRateLimitThresholdAndExpiry();
    testIndependentIpAndEmailLimits();
    testHashedKeysNotRawEmail();
    console.log('All email lookup tests passed.');
  } finally {
    resetEmailLookupRateLimitsForTests();
    setEmailLookupRateLimitClockForTests(Date.now);
    closeDatabase();
  }
}

void main();
