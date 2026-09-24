import AsyncStorage from '@react-native-async-storage/async-storage';

const WEAR_HISTORY_SYNC_METADATA_KEY = '@wardrobe-ai/wear-history/sync-metadata';

export type WearEventDeletedTombstone = {
  deletedAt: string;
};

export type WearHistorySyncMetadata = {
  eventUpdatedAtById: Record<string, string>;
  serverUpdatedAtById: Record<string, string>;
  deletedEvents: Record<string, WearEventDeletedTombstone>;
  lastServerSyncAt: string | null;
};

const EMPTY_METADATA: WearHistorySyncMetadata = {
  eventUpdatedAtById: {},
  serverUpdatedAtById: {},
  deletedEvents: {},
  lastServerSyncAt: null,
};

export async function loadWearHistorySyncMetadata(): Promise<WearHistorySyncMetadata> {
  try {
    const raw = await AsyncStorage.getItem(WEAR_HISTORY_SYNC_METADATA_KEY);

    if (!raw) {
      return EMPTY_METADATA;
    }

    const parsed = JSON.parse(raw) as Partial<WearHistorySyncMetadata>;

    return {
      eventUpdatedAtById:
        parsed.eventUpdatedAtById && typeof parsed.eventUpdatedAtById === 'object'
          ? parsed.eventUpdatedAtById
          : {},
      serverUpdatedAtById:
        parsed.serverUpdatedAtById && typeof parsed.serverUpdatedAtById === 'object'
          ? parsed.serverUpdatedAtById
          : {},
      deletedEvents:
        parsed.deletedEvents && typeof parsed.deletedEvents === 'object'
          ? parsed.deletedEvents
          : {},
      lastServerSyncAt:
        typeof parsed.lastServerSyncAt === 'string' ? parsed.lastServerSyncAt : null,
    };
  } catch {
    return EMPTY_METADATA;
  }
}

export async function saveWearHistorySyncMetadata(
  metadata: WearHistorySyncMetadata,
): Promise<void> {
  try {
    await AsyncStorage.setItem(WEAR_HISTORY_SYNC_METADATA_KEY, JSON.stringify(metadata));
  } catch {
    // Keep in-memory state even if persistence fails.
  }
}

export async function markWearEventUpdated(
  eventId: string,
  updatedAt?: string,
): Promise<string> {
  const timestamp = updatedAt ?? new Date().toISOString();
  const metadata = await loadWearHistorySyncMetadata();

  await saveWearHistorySyncMetadata({
    ...metadata,
    eventUpdatedAtById: {
      ...metadata.eventUpdatedAtById,
      [eventId]: timestamp,
    },
  });

  return timestamp;
}

export async function markWearEventDeleted(eventId: string): Promise<string> {
  const now = new Date().toISOString();
  const metadata = await loadWearHistorySyncMetadata();
  const nextEventUpdatedAtById = { ...metadata.eventUpdatedAtById };
  delete nextEventUpdatedAtById[eventId];

  await saveWearHistorySyncMetadata({
    ...metadata,
    eventUpdatedAtById: nextEventUpdatedAtById,
    deletedEvents: {
      ...metadata.deletedEvents,
      [eventId]: { deletedAt: now },
    },
  });

  return now;
}
