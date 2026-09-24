import type { SavedOutfit } from '@/constants/saved-outfit';
import { getWardrobeItemImageVersion } from '@/constants/wardrobe-item';
import { fetchOutfitsSnapshot } from '@/services/outfits-api';
import { fetchWearHistorySnapshot } from '@/services/wear-history-api';
import { fetchWardrobeSnapshot } from '@/services/wardrobe-api';
import { getAuthToken } from '@/storage/auth-token-storage';
import { clearDevSyncTimestampsAndCache } from '@/storage/dev-sync-cache-clear';
import { loadSavedOutfits } from '@/storage/outfits-storage';
import { loadWearHistory } from '@/storage/wear-history-storage';
import { loadWardrobeItems } from '@/storage/wardrobe-storage';
import type { SyncRunOptions } from '@/utils/sync-run-options';

type DevRefreshSyncHandlers = {
  runWardrobeSync: (options?: SyncRunOptions) => Promise<void>;
  runOutfitsSync: (options?: SyncRunOptions) => Promise<void>;
  runWearHistorySync: (options?: SyncRunOptions) => Promise<void>;
};

function countOutfitsWithMissingItems(
  outfits: SavedOutfit[],
  wardrobeItemIds: Set<string>,
): number {
  return outfits.filter(
    (outfit) => outfit.itemIds.every((itemId) => !wardrobeItemIds.has(itemId)),
  ).length;
}

async function waitForStableStoredCount(
  loader: () => Promise<unknown[]>,
  expectedMin = 0,
): Promise<number> {
  let previousCount = (await loader()).length;
  const deadline = Date.now() + 500;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));

    const nextCount = (await loader()).length;

    if (nextCount >= expectedMin && nextCount === previousCount) {
      return nextCount;
    }

    previousCount = nextCount;
  }

  return previousCount;
}

export async function refreshDevTestData(handlers: DevRefreshSyncHandlers): Promise<void> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error('Auth token is missing.');
  }

  await clearDevSyncTimestampsAndCache();

  const wardrobeBefore = await loadWardrobeItems();
  const wardrobeVersionsBefore = new Map(
    wardrobeBefore.map((item) => [item.id, getWardrobeItemImageVersion(item)]),
  );

  await handlers.runWardrobeSync({ force: true });

  if (__DEV__) {
    const wardrobeAfter = await loadWardrobeItems();
    const hasImageVersionChanges = wardrobeAfter.some((item) => {
      const previousVersion = wardrobeVersionsBefore.get(item.id);

      return previousVersion !== getWardrobeItemImageVersion(item);
    });

    if (hasImageVersionChanges) {
      const { Image } = await import('expo-image');
      await Image.clearMemoryCache();
    }
  }

  const [wardrobeServer, wardrobeLocalCount] = await Promise.all([
    fetchWardrobeSnapshot(token),
    waitForStableStoredCount(loadWardrobeItems, 0),
  ]);
  const wardrobeLocal = await loadWardrobeItems();

  if (__DEV__) {
    console.log(
      `[DEV REFRESH] wardrobe server=${wardrobeServer.items.length} local=${wardrobeLocalCount}`,
    );
  }

  await handlers.runOutfitsSync({ force: true });

  const [outfitsServer, outfitsLocalCount] = await Promise.all([
    fetchOutfitsSnapshot(token),
    waitForStableStoredCount(loadSavedOutfits, 0),
  ]);
  const outfitsLocal = await loadSavedOutfits();
  const wardrobeIds = new Set(wardrobeLocal.map((item) => item.id));
  const hiddenOutfits = countOutfitsWithMissingItems(outfitsLocal, wardrobeIds);

  if (__DEV__) {
    console.log(
      `[DEV REFRESH] outfits server=${outfitsServer.outfits.length} local=${outfitsLocalCount}`,
    );

    if (hiddenOutfits > 0) {
      console.log(
        `[DEV REFRESH] outfits hidden in UI due to missing itemIds=${hiddenOutfits}/${outfitsLocal.length}`,
      );
    }
  }

  await handlers.runWearHistorySync({ force: true });

  const [wearServer, wearLocalCount] = await Promise.all([
    fetchWearHistorySnapshot(token),
    waitForStableStoredCount(loadWearHistory, 0),
  ]);

  if (__DEV__) {
    console.log(
      `[DEV REFRESH] wear server=${wearServer.events.length} local=${wearLocalCount}`,
    );
    console.log('[DEV REFRESH] complete');
  }
}
