import type { OutfitsSyncMetadata } from '@/storage/outfits-sync-storage';
import type { PreferencesSyncMetadata } from '@/storage/preferences-sync-storage';
import type { WardrobeSyncMetadata } from '@/storage/wardrobe-sync-storage';
import type { WearHistorySyncMetadata } from '@/storage/wear-history-sync-storage';

export const SYNC_TTL_MS = 12 * 60 * 1000;

export function isSyncFresh(lastSyncedAt: string | null): boolean {
  if (!lastSyncedAt) {
    return false;
  }

  const syncedAt = new Date(lastSyncedAt).getTime();

  if (Number.isNaN(syncedAt)) {
    return false;
  }

  return Date.now() - syncedAt < SYNC_TTL_MS;
}

export function hasWardrobePendingChanges(metadata: WardrobeSyncMetadata): boolean {
  return (
    Object.keys(metadata.deletedItems).length > 0 ||
    Object.entries(metadata.itemUpdatedAtById).some(
      ([itemId, localUpdatedAt]) => metadata.serverUpdatedAtById[itemId] !== localUpdatedAt,
    )
  );
}

export function hasOutfitsPendingChanges(metadata: OutfitsSyncMetadata): boolean {
  return (
    Object.keys(metadata.deletedOutfits).length > 0 ||
    Object.entries(metadata.outfitUpdatedAtById).some(
      ([outfitId, localUpdatedAt]) => metadata.serverUpdatedAtById[outfitId] !== localUpdatedAt,
    )
  );
}

export function hasWearHistoryPendingChanges(metadata: WearHistorySyncMetadata): boolean {
  return (
    Object.keys(metadata.deletedEvents).length > 0 ||
    Object.entries(metadata.eventUpdatedAtById).some(
      ([eventId, localUpdatedAt]) => metadata.serverUpdatedAtById[eventId] !== localUpdatedAt,
    )
  );
}

export function hasPreferencesPendingChanges(metadata: PreferencesSyncMetadata): boolean {
  if (!metadata.localUpdatedAt) {
    return false;
  }

  return metadata.localUpdatedAt !== metadata.serverUpdatedAt;
}

export function shouldSkipWardrobeServerSync(
  metadata: WardrobeSyncMetadata,
  localItemCount: number,
  isRestoringAccount: boolean,
): boolean {
  if (isRestoringAccount) {
    return false;
  }

  if (localItemCount === 0) {
    return false;
  }

  const serverItemCount = Object.keys(metadata.serverUpdatedAtById).length;

  if (serverItemCount > localItemCount) {
    return false;
  }

  if (!isSyncFresh(metadata.lastServerSyncAt)) {
    return false;
  }

  if (hasWardrobePendingChanges(metadata)) {
    return false;
  }

  return true;
}

export function getPreferencesLastSyncedAt(metadata: PreferencesSyncMetadata): string | null {
  if (metadata.lastServerSyncAt) {
    return metadata.lastServerSyncAt;
  }

  if (
    metadata.serverUpdatedAt &&
    metadata.localUpdatedAt === metadata.serverUpdatedAt
  ) {
    return metadata.serverUpdatedAt;
  }

  return null;
}
