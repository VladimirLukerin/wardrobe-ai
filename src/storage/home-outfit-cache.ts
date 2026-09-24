import AsyncStorage from '@react-native-async-storage/async-storage';

import { HOME_CACHE_TTL_MS } from '@/constants/home-cache';
import type { OutfitSuggestion } from '@/services/outfit-suggestions';

const HOME_OUTFIT_CACHE_KEY = '@wardrobe-ai/cache/home-outfit';

export type CachedHomeOutfitEntry = {
  outfit: OutfitSuggestion;
  inputSignature: string;
  recommendationKey?: string;
  fetchedAt: number;
};

function parseOutfitSuggestion(raw: unknown): OutfitSuggestion | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const outfit = raw as Partial<OutfitSuggestion>;

  if (
    typeof outfit.id !== 'string' ||
    typeof outfit.title !== 'string' ||
    !Array.isArray(outfit.itemIds) ||
    outfit.itemIds.some((itemId) => typeof itemId !== 'string') ||
    typeof outfit.description !== 'string'
  ) {
    return null;
  }

  return {
    id: outfit.id,
    title: outfit.title,
    itemIds: outfit.itemIds,
    description: outfit.description,
  };
}

function parseCachedHomeOutfitEntry(raw: unknown): CachedHomeOutfitEntry | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const entry = raw as Partial<CachedHomeOutfitEntry>;
  const outfit = parseOutfitSuggestion(entry.outfit);

  if (
    !outfit ||
    typeof entry.inputSignature !== 'string' ||
    entry.inputSignature.length === 0 ||
    typeof entry.fetchedAt !== 'number'
  ) {
    return null;
  }

  return {
    outfit,
    inputSignature: entry.inputSignature,
    recommendationKey:
      typeof entry.recommendationKey === 'string' && entry.recommendationKey.length > 0
        ? entry.recommendationKey
        : undefined,
    fetchedAt: entry.fetchedAt,
  };
}

export function isHomeOutfitCacheFresh(fetchedAt: number, now: number = Date.now()): boolean {
  return now - fetchedAt < HOME_CACHE_TTL_MS;
}

export async function loadHomeOutfitCache(): Promise<CachedHomeOutfitEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(HOME_OUTFIT_CACHE_KEY);

    if (!raw) {
      return null;
    }

    return parseCachedHomeOutfitEntry(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveHomeOutfitCache(entry: CachedHomeOutfitEntry): Promise<void> {
  try {
    await AsyncStorage.setItem(HOME_OUTFIT_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Keep in-memory state even if persistence fails.
  }
}
