import crypto from 'crypto';
import type { Request, Response } from 'express';

export const ADMIN_LOGIN_EMAIL_MAX_FAILED = 10;
export const ADMIN_LOGIN_IP_MAX_ATTEMPTS = 40;
export const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;

type Bucket = {
  count: number;
  windowStartedAt: number;
};

type AdminLoginRateLimitClock = () => number;

const emailFailureBuckets = new Map<string, Bucket>();
const ipAttemptBuckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

let clock: AdminLoginRateLimitClock = Date.now;

export type AdminLoginRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

function hashIdentifier(prefix: string, value: string): string {
  return crypto.createHash('sha256').update(`${prefix}:${value}`).digest('hex');
}

export function hashEmailForAdminLoginRateLimit(normalizedEmail: string): string {
  return hashIdentifier('admin-login-email', normalizedEmail);
}

export function hashIpForAdminLoginRateLimit(ip: string): string {
  return hashIdentifier('admin-login-ip', ip);
}

export function getAdminLoginClientIp(req: Request): string {
  return req.socket.remoteAddress ?? 'unknown';
}

function isBucketExpired(bucket: Bucket, now: number): boolean {
  return now - bucket.windowStartedAt >= ADMIN_LOGIN_WINDOW_MS;
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
  const retryAfterMs = bucket.windowStartedAt + ADMIN_LOGIN_WINDOW_MS - now;
  return Math.max(1, Math.ceil(retryAfterMs / 1000));
}

function isBlocked(map: Map<string, Bucket>, key: string, max: number, now: number): AdminLoginRateLimitResult {
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

export function checkAdminLoginRateLimit(
  normalizedEmail: string,
  ip: string,
  now = clock(),
): AdminLoginRateLimitResult {
  const ipResult = isBlocked(
    ipAttemptBuckets,
    hashIpForAdminLoginRateLimit(ip),
    ADMIN_LOGIN_IP_MAX_ATTEMPTS,
    now,
  );

  if (!ipResult.allowed) {
    return ipResult;
  }

  return isBlocked(
    emailFailureBuckets,
    hashEmailForAdminLoginRateLimit(normalizedEmail),
    ADMIN_LOGIN_EMAIL_MAX_FAILED,
    now,
  );
}

export function recordAdminLoginAttempt(ip: string, now = clock()): void {
  incrementBucket(ipAttemptBuckets, hashIpForAdminLoginRateLimit(ip), now);
}

export function recordAdminLoginFailure(normalizedEmail: string, ip: string, now = clock()): void {
  recordAdminLoginAttempt(ip, now);
  incrementBucket(emailFailureBuckets, hashEmailForAdminLoginRateLimit(normalizedEmail), now);
}

export function resetAdminLoginEmailFailures(normalizedEmail: string, now = clock()): void {
  cleanupExpiredBuckets(now);
  emailFailureBuckets.delete(hashEmailForAdminLoginRateLimit(normalizedEmail));
}

export function respondAdminLoginRateLimited(res: Response, retryAfterSeconds: number): void {
  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.status(429).json({
    error: 'Слишком много попыток входа. Попробуйте позже.',
    code: 'admin_auth_rate_limited',
    retryAfterSeconds,
  });
}

export function setAdminLoginRateLimitClockForTests(nextClock: AdminLoginRateLimitClock): void {
  clock = nextClock;
}

export function resetAdminLoginRateLimitsForTests(): void {
  emailFailureBuckets.clear();
  ipAttemptBuckets.clear();
  clock = Date.now;
}
