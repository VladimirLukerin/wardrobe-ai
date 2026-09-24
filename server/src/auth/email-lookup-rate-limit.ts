import crypto from 'crypto';
import type { Request, Response } from 'express';

export const EMAIL_LOOKUP_IP_MAX_ATTEMPTS = 30;
export const EMAIL_LOOKUP_EMAIL_MAX_ATTEMPTS = 10;
export const EMAIL_LOOKUP_WINDOW_MS = 15 * 60 * 1000;

type Bucket = {
  count: number;
  windowStartedAt: number;
};

type EmailLookupRateLimitClock = () => number;

const ipBuckets = new Map<string, Bucket>();
const emailBuckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

let clock: EmailLookupRateLimitClock = Date.now;

export type EmailLookupRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

function hashIdentifier(prefix: string, value: string): string {
  return crypto.createHash('sha256').update(`${prefix}:${value}`).digest('hex');
}

export function hashEmailForLookupRateLimit(normalizedEmail: string): string {
  return hashIdentifier('email-lookup-email', normalizedEmail);
}

export function hashIpForLookupRateLimit(ip: string): string {
  return hashIdentifier('email-lookup-ip', ip);
}

export function getEmailLookupClientIp(req: Request): string {
  return req.socket.remoteAddress ?? 'unknown';
}

function isBucketExpired(bucket: Bucket, now: number): boolean {
  return now - bucket.windowStartedAt >= EMAIL_LOOKUP_WINDOW_MS;
}

function cleanupMap(map: Map<string, Bucket>, now: number): void {
  for (const [key, bucket] of map) {
    if (isBucketExpired(bucket, now)) {
      map.delete(key);
    }
  }
}

function cleanupExpiredBuckets(now: number): void {
  cleanupMap(ipBuckets, now);
  cleanupMap(emailBuckets, now);

  const totalSize = ipBuckets.size + emailBuckets.size;

  if (totalSize <= MAX_BUCKETS) {
    return;
  }

  const overflow = totalSize - MAX_BUCKETS;
  const keysToDelete = [...ipBuckets.keys(), ...emailBuckets.keys()].slice(0, overflow);

  for (const key of keysToDelete) {
    ipBuckets.delete(key);
    emailBuckets.delete(key);
  }
}

function getRetryAfterSeconds(bucket: Bucket, now: number): number {
  const retryAfterMs = bucket.windowStartedAt + EMAIL_LOOKUP_WINDOW_MS - now;
  return Math.max(1, Math.ceil(retryAfterMs / 1000));
}

function checkBucket(
  map: Map<string, Bucket>,
  key: string,
  max: number,
  now: number,
): EmailLookupRateLimitResult {
  cleanupExpiredBuckets(now);

  let bucket = map.get(key);

  if (!bucket || isBucketExpired(bucket, now)) {
    bucket = { count: 0, windowStartedAt: now };
    map.set(key, bucket);
  }

  if (bucket.count >= max) {
    return {
      allowed: false,
      retryAfterSeconds: getRetryAfterSeconds(bucket, now),
    };
  }

  bucket.count += 1;
  return { allowed: true };
}

export function checkEmailLookupRateLimit(
  normalizedEmail: string,
  ip: string,
  now = clock(),
): EmailLookupRateLimitResult {
  const ipResult = checkBucket(
    ipBuckets,
    hashIpForLookupRateLimit(ip),
    EMAIL_LOOKUP_IP_MAX_ATTEMPTS,
    now,
  );

  if (!ipResult.allowed) {
    return ipResult;
  }

  return checkBucket(
    emailBuckets,
    hashEmailForLookupRateLimit(normalizedEmail),
    EMAIL_LOOKUP_EMAIL_MAX_ATTEMPTS,
    now,
  );
}

export function respondEmailLookupRateLimited(res: Response, retryAfterSeconds: number): void {
  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.status(429).json({
    error: 'Слишком много запросов. Попробуйте позже.',
    code: 'auth_rate_limited',
    retryAfterSeconds,
  });
}

export function setEmailLookupRateLimitClockForTests(nextClock: EmailLookupRateLimitClock): void {
  clock = nextClock;
}

export function resetEmailLookupRateLimitsForTests(): void {
  ipBuckets.clear();
  emailBuckets.clear();
  clock = Date.now;
}

export function getEmailLookupRateLimitBucketCountForTests(): number {
  return ipBuckets.size + emailBuckets.size;
}
