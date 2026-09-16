import AsyncStorage from '@react-native-async-storage/async-storage';

import { ACCOUNT_CACHE_STORAGE_KEY } from '@/storage/account-cache-storage';
import { loadSavedOutfits } from '@/storage/outfits-storage';
import { loadPreferencesSyncMetadata } from '@/storage/preferences-sync-storage';
import { loadWearHistory } from '@/storage/wear-history-storage';
import { loadWardrobeItems } from '@/storage/wardrobe-storage';
import { loadOutfitsSyncMetadata } from '@/storage/outfits-sync-storage';
import { loadWearHistorySyncMetadata } from '@/storage/wear-history-sync-storage';
import { loadWardrobeSyncMetadata } from '@/storage/wardrobe-sync-storage';

export const USER_SCOPED_STORAGE_KEYS = [
  '@wardrobe-ai/profile/body-parameters',
  '@wardrobe-ai/profile/stylist-preferences',
  '@wardrobe-ai/profile/account',
  ACCOUNT_CACHE_STORAGE_KEY,
  '@wardrobe-ai/profile/preferences-sync-metadata',
  '@wardrobe-ai/wardrobe/items',
  '@wardrobe-ai/wardrobe/sync-metadata',
  '@wardrobe-ai/wardrobe/image-sync-metadata',
  '@wardrobe-ai/outfits/saved',
  '@wardrobe-ai/outfits/sync-metadata',
  '@wardrobe-ai/wear-history',
  '@wardrobe-ai/wear-history/sync-metadata',
  '@wardrobe-ai/cache/home-outfit',
  '@wardrobe-ai/cache/weather',
] as const;

export type LocalAccountAssessment = {
  wardrobeCount: number;
  outfitsCount: number;
  wearEventsCount: number;
  hasMeaningfulLocalData: boolean;
  hasPendingSyncMetadata: boolean;
};

export async function prepareLocalStateForAccountSwitch(): Promise<void> {
  await AsyncStorage.multiRemove([...USER_SCOPED_STORAGE_KEYS]);
}

export async function assessLocalAccountState(): Promise<LocalAccountAssessment> {
  const [wardrobe, outfits, wearEvents, wardrobeMeta, outfitsMeta, wearMeta, prefsMeta] =
    await Promise.all([
      loadWardrobeItems(),
      loadSavedOutfits(),
      loadWearHistory(),
      loadWardrobeSyncMetadata(),
      loadOutfitsSyncMetadata(),
      loadWearHistorySyncMetadata(),
      loadPreferencesSyncMetadata(),
    ]);

  const hasMeaningfulLocalData =
    wardrobe.length > 0 || outfits.length > 0 || wearEvents.length > 0;

  const hasPendingSyncMetadata =
    Object.keys(wardrobeMeta.deletedItems).length > 0 ||
    Object.keys(outfitsMeta.deletedOutfits).length > 0 ||
    Object.keys(wearMeta.deletedEvents).length > 0 ||
    Boolean(prefsMeta.localUpdatedAt && prefsMeta.serverUpdatedAt &&
      prefsMeta.localUpdatedAt !== prefsMeta.serverUpdatedAt) ||
    Object.entries(wardrobeMeta.itemUpdatedAtById).some(
      ([itemId, localUpdatedAt]) =>
        wardrobeMeta.serverUpdatedAtById[itemId] !== localUpdatedAt,
    ) ||
    Object.entries(outfitsMeta.outfitUpdatedAtById).some(
      ([outfitId, localUpdatedAt]) =>
        outfitsMeta.serverUpdatedAtById[outfitId] !== localUpdatedAt,
    ) ||
    Object.entries(wearMeta.eventUpdatedAtById).some(
      ([eventId, localUpdatedAt]) =>
        wearMeta.serverUpdatedAtById[eventId] !== localUpdatedAt,
    );

  return {
    wardrobeCount: wardrobe.length,
    outfitsCount: outfits.length,
    wearEventsCount: wearEvents.length,
    hasMeaningfulLocalData,
    hasPendingSyncMetadata,
  };
}
