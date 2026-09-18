import { saveOutfitsSyncMetadata } from '@/storage/outfits-sync-storage';
import { saveWardrobeImageSyncMetadata } from '@/storage/wardrobe-image-sync-storage';
import { saveWardrobeSyncMetadata } from '@/storage/wardrobe-sync-storage';
import { saveWearHistorySyncMetadata } from '@/storage/wear-history-sync-storage';

export async function clearDevSyncTimestampsAndCache(): Promise<void> {
  await Promise.all([
    saveWardrobeSyncMetadata({
      itemUpdatedAtById: {},
      serverUpdatedAtById: {},
      deletedItems: {},
      lastServerSyncAt: null,
    }),
    saveWardrobeImageSyncMetadata({ items: {} }),
    saveOutfitsSyncMetadata({
      outfitUpdatedAtById: {},
      serverUpdatedAtById: {},
      deletedOutfits: {},
      lastServerSyncAt: null,
    }),
    saveWearHistorySyncMetadata({
      eventUpdatedAtById: {},
      serverUpdatedAtById: {},
      deletedEvents: {},
      lastServerSyncAt: null,
    }),
  ]);
}
