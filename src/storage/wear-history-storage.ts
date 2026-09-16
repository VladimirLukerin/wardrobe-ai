import AsyncStorage from '@react-native-async-storage/async-storage';

import type { WearEvent } from '@/constants/wear-event';

const WEAR_HISTORY_KEY = '@wardrobe-ai/wear-history';

function parseWearEvent(raw: unknown): WearEvent | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const data = raw as Partial<WearEvent>;

  if (typeof data.id !== 'string' || data.id.trim().length === 0) {
    return null;
  }

  if (typeof data.outfitId !== 'string' || data.outfitId.trim().length === 0) {
    return null;
  }

  if (!Array.isArray(data.itemIds) || data.itemIds.some((itemId) => typeof itemId !== 'string')) {
    return null;
  }

  if (typeof data.wornAt !== 'string' || data.wornAt.trim().length === 0) {
    return null;
  }

  return {
    id: data.id,
    outfitId: data.outfitId,
    itemIds: data.itemIds,
    wornAt: data.wornAt,
  };
}

export async function loadWearHistory(): Promise<WearEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(WEAR_HISTORY_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => parseWearEvent(entry))
      .filter((entry): entry is WearEvent => entry !== null);
  } catch {
    return [];
  }
}

export async function saveWearHistory(events: WearEvent[]): Promise<void> {
  try {
    await AsyncStorage.setItem(WEAR_HISTORY_KEY, JSON.stringify(events));
  } catch {
    // Keep in-memory state even if persistence fails.
  }
}
