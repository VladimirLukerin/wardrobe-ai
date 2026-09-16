import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SavedOutfit } from '@/constants/saved-outfit';

const SAVED_OUTFITS_KEY = '@wardrobe-ai/outfits/saved';

function parseSavedOutfit(raw: unknown): SavedOutfit | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const data = raw as Partial<SavedOutfit>;

  if (typeof data.id !== 'string' || data.id.trim().length === 0) {
    return null;
  }

  if (typeof data.title !== 'string') {
    return null;
  }

  if (!Array.isArray(data.itemIds) || data.itemIds.some((itemId) => typeof itemId !== 'string')) {
    return null;
  }

  if (typeof data.description !== 'string') {
    return null;
  }

  if (typeof data.createdAt !== 'string' || data.createdAt.trim().length === 0) {
    return null;
  }

  return {
    id: data.id,
    title: data.title.trim() || 'Образ',
    itemIds: data.itemIds,
    description: data.description.trim(),
    createdAt: data.createdAt,
    source: data.source === 'manual' ? 'manual' : data.source === 'ai' ? 'ai' : undefined,
  };
}

export async function loadSavedOutfits(): Promise<SavedOutfit[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_OUTFITS_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => parseSavedOutfit(entry))
      .filter((entry): entry is SavedOutfit => entry !== null);
  } catch {
    return [];
  }
}

export async function saveSavedOutfits(outfits: SavedOutfit[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SAVED_OUTFITS_KEY, JSON.stringify(outfits));
  } catch {
    // Keep in-memory state even if persistence fails.
  }
}
