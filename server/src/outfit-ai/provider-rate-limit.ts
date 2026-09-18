import type { Response } from 'express';
import { APIError, RateLimitError } from 'openai';

export const AI_PROVIDER_RATE_LIMIT_MESSAGE =
  'Сервис AI временно перегружен. Попробуйте немного позже.';

export const AI_PROVIDER_RATE_LIMIT_CODE = 'ai_provider_rate_limited';

const DEFAULT_RETRY_AFTER_SECONDS = 30;

export class AiProviderRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(AI_PROVIDER_RATE_LIMIT_MESSAGE);
    this.name = 'AiProviderRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function readHeader(headers: unknown, name: string): string | null {
  if (!headers || typeof headers !== 'object') {
    return null;
  }

  const record = headers as Record<string, unknown>;

  if (typeof record.get === 'function') {
    const value = (record.get as (key: string) => unknown)(name);

    return typeof value === 'string' ? value : null;
  }

  const direct = record[name] ?? record[name.toLowerCase()];

  return typeof direct === 'string' ? direct : null;
}

export function parseRetryAfterSecondsFromProviderError(error: unknown): number {
  if (!(error instanceof APIError)) {
    return DEFAULT_RETRY_AFTER_SECONDS;
  }

  const retryAfterMs = readHeader(error.headers, 'retry-after-ms');

  if (retryAfterMs) {
    const parsedMs = Number.parseInt(retryAfterMs, 10);

    if (Number.isFinite(parsedMs) && parsedMs > 0) {
      return Math.max(1, Math.ceil(parsedMs / 1000));
    }
  }

  const retryAfter = readHeader(error.headers, 'retry-after');

  if (retryAfter) {
    const parsedSeconds = Number.parseInt(retryAfter, 10);

    if (Number.isFinite(parsedSeconds) && parsedSeconds > 0) {
      return parsedSeconds;
    }
  }

  return DEFAULT_RETRY_AFTER_SECONDS;
}

export function isOpenAiProviderRateLimitError(error: unknown): boolean {
  if (error instanceof RateLimitError) {
    return true;
  }

  if (error instanceof APIError) {
    return error.status === 429 || error.code === 'rate_limit_exceeded';
  }

  return false;
}

export function toAiProviderRateLimitError(error: unknown): AiProviderRateLimitError {
  return new AiProviderRateLimitError(parseRetryAfterSecondsFromProviderError(error));
}

export function respondAiProviderRateLimited(res: Response, retryAfterSeconds: number): void {
  const safeRetryAfterSeconds = Math.max(1, Math.floor(retryAfterSeconds));

  res.setHeader('Retry-After', String(safeRetryAfterSeconds));
  res.status(429).json({
    error: AI_PROVIDER_RATE_LIMIT_MESSAGE,
    code: AI_PROVIDER_RATE_LIMIT_CODE,
    retryAfterSeconds: safeRetryAfterSeconds,
  });
}
