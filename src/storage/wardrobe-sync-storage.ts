import AsyncStorage from '@react-native-async-storage/async-storage';

const WARDROBE_SYNC_METADATA_KEY = '@wardrobe-ai/wardrobe/sync-metadata';

export type WardrobeDeletedTombstone = {
  deletedAt: string;
};

export type WardrobeSyncMetadata = {
  itemUpdatedAtById: Record<string, string>;
  serverUpdatedAtById: Record<string, string>;
  deletedItems: Record<string, WardrobeDeletedTombstone>;
  lastServerSyncAt: string | null;
};

const EMPTY_METADATA: WardrobeSyncMetadata = {
  itemUpdatedAtById: {},
  serverUpdatedAtById: {},
  deletedItems: {},
  lastServerSyncAt: null,
};

export async function loadWardrobeSyncMetadata(): Promise<WardrobeSyncMetadata> {
  try {
    const raw = await AsyncStorage.getItem(WARDROBE_SYNC_METADATA_KEY);

    if (!raw) {
      return EMPTY_METADATA;
    }

    const parsed = JSON.parse(raw) as Partial<WardrobeSyncMetadata>;

    return {
      itemUpdatedAtById:
        parsed.itemUpdatedAtById && typeof parsed.itemUpdatedAtById === 'object'
          ? parsed.itemUpdatedAtById
          : {},
      serverUpdatedAtById:
        parsed.serverUpdatedAtById && typeof parsed.serverUpdatedAtById === 'object'
          ? parsed.serverUpdatedAtById
          : {},
      deletedItems:
        parsed.deletedItems && typeof parsed.deletedItems === 'object' ? parsed.deletedItems : {},
      lastServerSyncAt:
        typeof parsed.lastServerSyncAt === 'string' ? parsed.lastServerSyncAt : null,
    };
  } catch {
    return EMPTY_METADATA;
  }
}

export async function saveWardrobeSyncMetadata(metadata: WardrobeSyncMetadata): Promise<void> {
  try {
    await AsyncStorage.setItem(WARDROBE_SYNC_METADATA_KEY, JSON.stringify(metadata));
  } catch {
    // Keep in-memory state even if persistence fails.
  }
}

export async function markWardrobeItemUpdated(itemId: string): Promise<string> {
  const now = new Date().toISOString();
  const metadata = await loadWardrobeSyncMetadata();

  await saveWardrobeSyncMetadata({
    ...metadata,
    itemUpdatedAtById: {
      ...metadata.itemUpdatedAtById,
      [itemId]: now,
    },
  });

  return now;
}

export async function markWardrobeItemDeleted(itemId: string): Promise<string> {
  const now = new Date().toISOString();
  const metadata = await loadWardrobeSyncMetadata();
  const nextItemUpdatedAtById = { ...metadata.itemUpdatedAtById };
  delete nextItemUpdatedAtById[itemId];

  await saveWardrobeSyncMetadata({
    ...metadata,
    itemUpdatedAtById: nextItemUpdatedAtById,
    deletedItems: {
      ...metadata.deletedItems,
      [itemId]: { deletedAt: now },
    },
  });

  return now;
}
