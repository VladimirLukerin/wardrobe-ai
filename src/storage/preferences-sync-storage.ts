import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFERENCES_SYNC_METADATA_KEY = '@wardrobe-ai/profile/preferences-sync-metadata';

export type PreferencesSyncMetadata = {
  localUpdatedAt: string | null;
  serverUpdatedAt: string | null;
  lastServerSyncAt: string | null;
};

const EMPTY_METADATA: PreferencesSyncMetadata = {
  localUpdatedAt: null,
  serverUpdatedAt: null,
  lastServerSyncAt: null,
};

export async function loadPreferencesSyncMetadata(): Promise<PreferencesSyncMetadata> {
  try {
    const raw = await AsyncStorage.getItem(PREFERENCES_SYNC_METADATA_KEY);

    if (!raw) {
      return EMPTY_METADATA;
    }

    const parsed = JSON.parse(raw) as Partial<PreferencesSyncMetadata>;

    return {
      localUpdatedAt:
        typeof parsed.localUpdatedAt === 'string' ? parsed.localUpdatedAt : null,
      serverUpdatedAt:
        typeof parsed.serverUpdatedAt === 'string' ? parsed.serverUpdatedAt : null,
      lastServerSyncAt:
        typeof parsed.lastServerSyncAt === 'string' ? parsed.lastServerSyncAt : null,
    };
  } catch {
    return EMPTY_METADATA;
  }
}

export async function savePreferencesSyncMetadata(
  metadata: PreferencesSyncMetadata,
): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFERENCES_SYNC_METADATA_KEY, JSON.stringify(metadata));
  } catch {
    // Keep in-memory state even if persistence fails.
  }
}

export async function markLocalPreferencesUpdated(): Promise<string> {
  const now = new Date().toISOString();
  const current = await loadPreferencesSyncMetadata();

  await savePreferencesSyncMetadata({
    ...current,
    localUpdatedAt: now,
  });

  return now;
}
