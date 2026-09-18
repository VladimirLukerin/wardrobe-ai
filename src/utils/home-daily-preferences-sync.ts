import type { PreferencesSyncStatus } from '@/contexts/preferences-sync-context';

export function canMutateServerDailyOutfit(
  isServerAccount: boolean,
  preferencesSyncStatus: PreferencesSyncStatus,
): boolean {
  if (!isServerAccount) {
    return false;
  }

  return preferencesSyncStatus === 'synced';
}

export function shouldAttemptDailyCreateOrRegenerate(
  dailyStylistEnabled: boolean,
  isServerAccount: boolean,
  preferencesSyncStatus: PreferencesSyncStatus,
): boolean {
  return (
    dailyStylistEnabled &&
    canMutateServerDailyOutfit(isServerAccount, preferencesSyncStatus)
  );
}
