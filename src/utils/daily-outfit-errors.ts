import { AccountApiError } from '@/services/account';

export const DAILY_STYLIST_DISABLED_MESSAGE = 'Daily stylist is disabled.';

export function isDailyStylistDisabledError(error: unknown): boolean {
  return (
    error instanceof AccountApiError &&
    error.status === 403 &&
    error.message === DAILY_STYLIST_DISABLED_MESSAGE
  );
}

export function isUnexpectedDailyMutationError(error: unknown): boolean {
  return !isDailyStylistDisabledError(error);
}
