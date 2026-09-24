import { AccountApiError } from '@/services/account';

export const AI_RATE_LIMIT_USER_MESSAGE =
  'Слишком много запросов. Попробуйте немного позже.';

export const AI_RATE_LIMIT_RETRY_HINT = 'Попробуйте снова через несколько минут.';

export const AI_PROVIDER_RATE_LIMIT_USER_MESSAGE =
  'AI временно перегружен. Попробуйте немного позже.';

export const AI_PROVIDER_RATE_LIMIT_RETRY_HINT =
  'Попробуйте снова через несколько секунд.';

export function isAppAiRateLimitedError(error: unknown): boolean {
  return (
    error instanceof AccountApiError &&
    error.status === 429 &&
    error.code === 'rate_limited'
  );
}

export function isAiProviderRateLimitedError(error: unknown): boolean {
  return (
    error instanceof AccountApiError &&
    error.status === 429 &&
    error.code === 'ai_provider_rate_limited'
  );
}

/** @deprecated Prefer isAppAiRateLimitedError or isAnyAiRateLimitError. */
export function isAiRateLimitedError(error: unknown): boolean {
  return isAppAiRateLimitedError(error);
}

export function isAnyAiRateLimitError(error: unknown): boolean {
  return isAppAiRateLimitedError(error) || isAiProviderRateLimitedError(error);
}

export function getAiRateLimitUserMessage(error?: unknown): string {
  if (isAiProviderRateLimitedError(error)) {
    return AI_PROVIDER_RATE_LIMIT_USER_MESSAGE;
  }

  if (isAppAiRateLimitedError(error)) {
    return AI_RATE_LIMIT_USER_MESSAGE;
  }

  return AI_RATE_LIMIT_USER_MESSAGE;
}
