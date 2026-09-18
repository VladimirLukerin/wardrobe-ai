import crypto from 'crypto';
import type { Request, Response } from 'express';

export const PASSWORD_LOGIN_EMAIL_MAX_FAILED = 10;
export const PASSWORD_LOGIN_IP_MAX_ATTEMPTS = 30;
export const PASSWORD_LOGIN_WINDOW_MS = 15 * 60 * 1000;

type Bucket = {
  count: number;
  windowStartedAt: number;
};

type PasswordLoginRateLimitClock = () => number;

const emailFailureBuckets = new Map<string, Bucket>();
const ipAttemptBuckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

let clock: PasswordLoginRateLimitClock = Date.now;

export type PasswordLoginRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

function hashIdentifier(prefix: string, value: string): string {
  return crypto.createHash('sha256').update(`${prefix}:${value}`).digest('hex');
}

export function hashEmailForPasswordLoginRateLimit(normalizedEmail: string): string {
  return hashIdentifier('password-login-email', normalizedEmail);
}

export function hashIpForPasswordLoginRateLimit(ip: string): string {
  return hashIdentifier('password-login-ip', ip);
}

export function getPasswordLoginClientIp(req: Request): string {
  return req.socket.remoteAddress ?? 'unknown';
}

function isBucketExpired(bucket: Bucket, now: number): boolean {
  return now - bucket.windowStartedAt >= PASSWORD_LOGIN_WINDOW_MS;
}

function cleanupMap(map: Map<string, Bucket>, now: number): void {
  for (const [key, bucket] of map) {
    if (isBucketExpired(bucket, now)) {
      map.delete(key);
    }
  }
}

function cleanupExpiredBuckets(now: number): void {
  cleanupMap(emailFailureBuckets, now);
  cleanupMap(ipAttemptBuckets, now);

  const totalSize = emailFailureBuckets.size + ipAttemptBuckets.size;

  if (totalSize <= MAX_BUCKETS) {
    return;
  }

  const overflow = totalSize - MAX_BUCKETS;
  const keysToDelete = [...emailFailureBuckets.keys(), ...ipAttemptBuckets.keys()].slice(0, overflow);

  for (const key of keysToDelete) {
    emailFailureBuckets.delete(key);
    ipAttemptBuckets.delete(key);
  }
}

function getRetryAfterSeconds(bucket: Bucket, now: number): number {
  const retryAfterMs = bucket.windowStartedAt + PASSWORD_LOGIN_WINDOW_MS - now;
  return Math.max(1, Math.ceil(retryAfterMs / 1000));
}

function isBlocked(map: Map<string, Bucket>, key: string, max: number, now: number): PasswordLoginRateLimitResult {
  cleanupExpiredBuckets(now);

  const bucket = map.get(key);

  if (!bucket || isBucketExpired(bucket, now)) {
    return { allowed: true };
  }

  if (bucket.count >= max) {
    return {
      allowed: false,
      retryAfterSeconds: getRetryAfterSeconds(bucket, now),
    };
  }

  return { allowed: true };
}

function incrementBucket(map: Map<string, Bucket>, key: string, now: number): void {
  cleanupExpiredBuckets(now);

  let bucket = map.get(key);

  if (!bucket || isBucketExpired(bucket, now)) {
    bucket = { count: 0, windowStartedAt: now };
    map.set(key, bucket);
  }

  bucket.count += 1;
}

export function checkPasswordLoginRateLimit(
  normalizedEmail: string,
  ip: string,
  now = clock(),
): PasswordLoginRateLimitResult {
  const ipResult = isBlocked(
    ipAttemptBuckets,
    hashIpForPasswordLoginRateLimit(ip),
    PASSWORD_LOGIN_IP_MAX_ATTEMPTS,
    now,
  );

  if (!ipResult.allowed) {
    return ipResult;
  }

  return isBlocked(
    emailFailureBuckets,
    hashEmailForPasswordLoginRateLimit(normalizedEmail),
    PASSWORD_LOGIN_EMAIL_MAX_FAILED,
    now,
  );
}

export function recordPasswordLoginAttempt(ip: string, now = clock()): void {
  incrementBucket(ipAttemptBuckets, hashIpForPasswordLoginRateLimit(ip), now);
}

export function recordPasswordLoginFailure(normalizedEmail: string, ip: string, now = clock()): void {
  recordPasswordLoginAttempt(ip, now);
  incrementPasswordLoginEmailFailure(normalizedEmail, now);
}

export function incrementPasswordLoginEmailFailure(normalizedEmail: string, now = clock()): void {
  incrementBucket(emailFailureBuckets, hashEmailForPasswordLoginRateLimit(normalizedEmail), now);
}

export function resetPasswordLoginEmailFailures(normalizedEmail: string, now = clock()): void {
  cleanupExpiredBuckets(now);
  emailFailureBuckets.delete(hashEmailForPasswordLoginRateLimit(normalizedEmail));
}

export function respondPasswordLoginRateLimited(
  res: Response,
  retryAfterSeconds: number,
): void {
  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.status(429).json({
    error: 'Слишком много попыток входа. Попробуйте позже.',
    code: 'auth_rate_limited',
    retryAfterSeconds,
  });
}

export function setPasswordLoginRateLimitClockForTests(nextClock: PasswordLoginRateLimitClock): void {
  clock = nextClock;
}

export function resetPasswordLoginRateLimitsForTests(): void {
  emailFailureBuckets.clear();
  ipAttemptBuckets.clear();
  clock = Date.now;
}

export function getPasswordLoginRateLimitBucketCountForTests(): number {
  return emailFailureBuckets.size + ipAttemptBuckets.size;
}
