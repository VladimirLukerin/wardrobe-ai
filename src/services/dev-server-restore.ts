import { getAuthToken } from '@/storage/auth-token-storage';
import { clearDevLocalWardrobeData } from '@/storage/dev-local-data-clear';
import { loadSavedOutfits } from '@/storage/outfits-storage';
import { loadWearHistory } from '@/storage/wear-history-storage';
import { loadWardrobeItems } from '@/storage/wardrobe-storage';
import type { SyncRunOptions } from '@/utils/sync-run-options';
import { localImageFileExists } from '@/utils/wardrobe-local-image-path';

type DevServerRestoreHandlers = {
  resetWardrobeForDevServerRestore: () => Promise<void>;
  resetOutfitsForDevServerRestore: () => Promise<void>;
  resetWearHistoryForDevServerRestore: () => Promise<void>;
  runWardrobeSync: (options?: SyncRunOptions) => Promise<void>;
  runOutfitsSync: (options?: SyncRunOptions) => Promise<void>;
  runWearHistorySync: (options?: SyncRunOptions) => Promise<void>;
};

function countRestoredImages(items: Awaited<ReturnType<typeof loadWardrobeItems>>): number {
  return items.filter(
    (item) =>
      (item.processedImageUri && localImageFileExists(item.processedImageUri)) ||
      (item.originalImageUri && localImageFileExists(item.originalImageUri)),
  ).length;
}

export async function restoreDevTestDataFromServer(
  handlers: DevServerRestoreHandlers,
): Promise<void> {
  if (!__DEV__) {
    throw new Error('DEV server restore is only available in development builds.');
  }

  const token = await getAuthToken();

  if (!token) {
    throw new Error('Auth token is missing.');
  }

  await clearDevLocalWardrobeData();
  await handlers.resetWardrobeForDevServerRestore();
  await handlers.resetOutfitsForDevServerRestore();
  await handlers.resetWearHistoryForDevServerRestore();

  if (__DEV__) {
    console.log('[DEV SERVER RESTORE] local cleared');
  }

  const restoreOptions: SyncRunOptions = {
    force: true,
    restoreOnly: true,
  };

  await handlers.runWardrobeSync(restoreOptions);

  const wardrobeItems = await loadWardrobeItems();

  if (__DEV__) {
    console.log(`[DEV SERVER RESTORE] wardrobe pulled=${wardrobeItems.length}`);
  }

  await handlers.runOutfitsSync(restoreOptions);

  const savedOutfits = await loadSavedOutfits();

  if (__DEV__) {
    console.log(`[DEV SERVER RESTORE] outfits pulled=${savedOutfits.length}`);
  }

  await handlers.runWearHistorySync(restoreOptions);

  const wearEvents = await loadWearHistory();
  const imagesRestored = countRestoredImages(wardrobeItems);

  if (__DEV__) {
    console.log(`[DEV SERVER RESTORE] wear pulled=${wearEvents.length}`);
    console.log(`[DEV SERVER RESTORE] images restored=${imagesRestored}`);
    console.log(
      `[SEED VERIFY] wardrobe=${wardrobeItems.length} outfits=${savedOutfits.length} wear=${wearEvents.length}`,
    );
    console.log(
      `[STATS AUDIT] DB wear=${wearEvents.length} outfits=${savedOutfits.length} (local after restore)`,
    );
    console.log('[DEV SERVER RESTORE] complete');
  }
}
