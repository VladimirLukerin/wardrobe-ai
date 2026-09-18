import AsyncStorage from '@react-native-async-storage/async-storage';

const WARDROBE_IMAGE_SYNC_METADATA_KEY = '@wardrobe-ai/wardrobe/image-sync-metadata';

export type WardrobeImageKind = 'original' | 'processed';

export type WardrobeImageSyncEntry = {
  localFingerprint?: string;
  serverUpdatedAt?: string;
};

export type WardrobeItemImageSyncState = {
  original?: WardrobeImageSyncEntry;
  processed?: WardrobeImageSyncEntry;
};

export type WardrobeImageSyncMetadata = {
  items: Record<string, WardrobeItemImageSyncState>;
};

const EMPTY_METADATA: WardrobeImageSyncMetadata = {
  items: {},
};

export async function loadWardrobeImageSyncMetadata(): Promise<WardrobeImageSyncMetadata> {
  try {
    const raw = await AsyncStorage.getItem(WARDROBE_IMAGE_SYNC_METADATA_KEY);

    if (!raw) {
      return EMPTY_METADATA;
    }

    const parsed = JSON.parse(raw) as Partial<WardrobeImageSyncMetadata>;

    return {
      items: parsed.items && typeof parsed.items === 'object' ? parsed.items : {},
    };
  } catch {
    return EMPTY_METADATA;
  }
}

export async function saveWardrobeImageSyncMetadata(
  metadata: WardrobeImageSyncMetadata,
): Promise<void> {
  try {
    await AsyncStorage.setItem(WARDROBE_IMAGE_SYNC_METADATA_KEY, JSON.stringify(metadata));
  } catch {
    // Keep in-memory state even if persistence fails.
  }
}

export async function updateWardrobeImageSyncEntry({
  itemId,
  kind,
  localFingerprint,
  serverUpdatedAt,
}: {
  itemId: string;
  kind: WardrobeImageKind;
  localFingerprint: string;
  serverUpdatedAt: string;
}): Promise<WardrobeImageSyncMetadata> {
  const metadata = await loadWardrobeImageSyncMetadata();
  const currentItem = metadata.items[itemId] ?? {};

  const nextMetadata: WardrobeImageSyncMetadata = {
    items: {
      ...metadata.items,
      [itemId]: {
        ...currentItem,
        [kind]: {
          localFingerprint,
          serverUpdatedAt,
        },
      },
    },
  };

  await saveWardrobeImageSyncMetadata(nextMetadata);

  return nextMetadata;
}
