import type { Response } from 'express';

export type AiRateLimitType = 'photo' | 'suggest' | 'daily' | 'paired';

type RateLimitConfig = {
  max: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  windowStartedAt: number;
};

type AiRateLimitClock = () => number;

const DEFAULT_LIMITS: Record<AiRateLimitType, RateLimitConfig> = {
  photo: { max: 12, windowMs: 15 * 60 * 1000 },
  suggest: { max: 20, windowMs: 15 * 60 * 1000 },
  daily: { max: 10, windowMs: 60 * 60 * 1000 },
  paired: { max: 10, windowMs: 60 * 60 * 1000 },
};

const ENV_MAX_KEYS: Record<AiRateLimitType, string> = {
  photo: 'AI_RATE_LIMIT_PHOTO_MAX',
  suggest: 'AI_RATE_LIMIT_SUGGEST_MAX',
  daily: 'AI_RATE_LIMIT_DAILY_MAX',
  paired: 'AI_RATE_LIMIT_PAIRED_MAX',
};

const MAX_BUCKETS = 10_000;

const buckets = new Map<string, Bucket>();

let clock: AiRateLimitClock = Date.now;

export type AiRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

function parseMaxFromEnv(type: AiRateLimitType): number | null {
  const raw = process.env[ENV_MAX_KEYS[type]];

  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getAiRateLimitConfig(type: AiRateLimitType): RateLimitConfig {
  const defaults = DEFAULT_LIMITS[type];
  const maxOverride = parseMaxFromEnv(type);

  return {
    max: maxOverride ?? defaults.max,
    windowMs: defaults.windowMs,
  };
}

function bucketKey(type: AiRateLimitType, userId: string): string {
  return `${type}:${userId}`;
}

function isBucketExpired(bucket: Bucket, config: RateLimitConfig, now: number): boolean {
  return now - bucket.windowStartedAt >= config.windowMs;
}

function cleanupExpiredBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    const type = key.slice(0, key.indexOf(':')) as AiRateLimitType;
    const config = getAiRateLimitConfig(type);

    if (isBucketExpired(bucket, config, now)) {
      buckets.delete(key);
    }
  }

  if (buckets.size <= MAX_BUCKETS) {
    return;
  }

  const overflow = buckets.size - MAX_BUCKETS;
  const keysToDelete = [...buckets.keys()].slice(0, overflow);

  for (const key of keysToDelete) {
    buckets.delete(key);
  }
}

export function checkAiRateLimit(
  userId: string,
  type: AiRateLimitType,
  now = clock(),
): AiRateLimitResult {
  cleanupExpiredBuckets(now);

  const config = getAiRateLimitConfig(type);
  const key = bucketKey(type, userId);
  let bucket = buckets.get(key);

  if (!bucket || isBucketExpired(bucket, config, now)) {
    bucket = { count: 0, windowStartedAt: now };
    buckets.set(key, bucket);
  }

  if (bucket.count >= config.max) {
    const retryAfterMs = bucket.windowStartedAt + config.windowMs - now;

    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true };
}

export function respondAiRateLimited(res: Response, retryAfterSeconds: number): void {
  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.status(429).json({
    error: 'Слишком много AI-запросов. Попробуйте чуть позже.',
    code: 'rate_limited',
    retryAfterSeconds,
  });
}

export function logAiRateLimit(type: AiRateLimitType, userId: string): void {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[AI RATE LIMIT] type=${type} user=${userId.slice(0, 8)}`);
  }
}

export function enforceAiRateLimit(
  res: Response,
  userId: string,
  type: AiRateLimitType,
  now = clock(),
): boolean {
  const result = checkAiRateLimit(userId, type, now);

  if (result.allowed) {
    return true;
  }

  logAiRateLimit(type, userId);
  respondAiRateLimited(res, result.retryAfterSeconds);
  return false;
}

export function getAiRateLimitBucketCountForTests(): number {
  return buckets.size;
}

export function resetAiRateLimitsForTests(nextClock: AiRateLimitClock = Date.now): void {
  buckets.clear();
  clock = nextClock;
}

export function restoreAiRateLimitClockForTests(): void {
  clock = Date.now;
}
