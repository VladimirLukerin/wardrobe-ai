import { AccountApiError } from '@/services/account';

export const AI_RATE_LIMIT_USER_MESSAGE =
  'Слишком много запросов. Попробуйте немного позже.';

export const AI_RATE_LIMIT_RETRY_HINT = 'Попробуйте снова через несколько минут.';

export function isAiRateLimitedError(error: unknown): boolean {
  return (
    error instanceof AccountApiError &&
    error.status === 429 &&
    error.code === 'rate_limited'
  );
}

export function getAiRateLimitUserMessage(error?: unknown): string {
  if (isAiRateLimitedError(error)) {
    return AI_RATE_LIMIT_USER_MESSAGE;
  }

  return AI_RATE_LIMIT_USER_MESSAGE;
}
