import AsyncStorage from '@react-native-async-storage/async-storage';

const OUTFITS_SYNC_METADATA_KEY = '@wardrobe-ai/outfits/sync-metadata';

export type OutfitDeletedTombstone = {
  deletedAt: string;
};

export type OutfitsSyncMetadata = {
  outfitUpdatedAtById: Record<string, string>;
  serverUpdatedAtById: Record<string, string>;
  deletedOutfits: Record<string, OutfitDeletedTombstone>;
  lastServerSyncAt: string | null;
};

const EMPTY_METADATA: OutfitsSyncMetadata = {
  outfitUpdatedAtById: {},
  serverUpdatedAtById: {},
  deletedOutfits: {},
  lastServerSyncAt: null,
};

export async function loadOutfitsSyncMetadata(): Promise<OutfitsSyncMetadata> {
  try {
    const raw = await AsyncStorage.getItem(OUTFITS_SYNC_METADATA_KEY);

    if (!raw) {
      return EMPTY_METADATA;
    }

    const parsed = JSON.parse(raw) as Partial<OutfitsSyncMetadata>;

    return {
      outfitUpdatedAtById:
        parsed.outfitUpdatedAtById && typeof parsed.outfitUpdatedAtById === 'object'
          ? parsed.outfitUpdatedAtById
          : {},
      serverUpdatedAtById:
        parsed.serverUpdatedAtById && typeof parsed.serverUpdatedAtById === 'object'
          ? parsed.serverUpdatedAtById
          : {},
      deletedOutfits:
        parsed.deletedOutfits && typeof parsed.deletedOutfits === 'object'
          ? parsed.deletedOutfits
          : {},
      lastServerSyncAt:
        typeof parsed.lastServerSyncAt === 'string' ? parsed.lastServerSyncAt : null,
    };
  } catch {
    return EMPTY_METADATA;
  }
}

export async function saveOutfitsSyncMetadata(metadata: OutfitsSyncMetadata): Promise<void> {
  try {
    await AsyncStorage.setItem(OUTFITS_SYNC_METADATA_KEY, JSON.stringify(metadata));
  } catch {
    // Keep in-memory state even if persistence fails.
  }
}

export async function markOutfitUpdated(outfitId: string): Promise<string> {
  const now = new Date().toISOString();
  const metadata = await loadOutfitsSyncMetadata();

  await saveOutfitsSyncMetadata({
    ...metadata,
    outfitUpdatedAtById: {
      ...metadata.outfitUpdatedAtById,
      [outfitId]: now,
    },
  });

  return now;
}

export async function markOutfitDeleted(outfitId: string): Promise<string> {
  const now = new Date().toISOString();
  const metadata = await loadOutfitsSyncMetadata();
  const nextOutfitUpdatedAtById = { ...metadata.outfitUpdatedAtById };
  delete nextOutfitUpdatedAtById[outfitId];

  await saveOutfitsSyncMetadata({
    ...metadata,
    outfitUpdatedAtById: nextOutfitUpdatedAtById,
    deletedOutfits: {
      ...metadata.deletedOutfits,
      [outfitId]: { deletedAt: now },
    },
  });

  return now;
}
