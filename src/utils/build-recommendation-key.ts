import { randomUUID } from 'expo-crypto';

import type { CachedHomeOutfitEntry } from '@/storage/home-outfit-cache';

export function buildDailyRecommendationKey(localDate: string, dailyOutfitId: string): string {
  return `daily:${localDate}:${dailyOutfitId}`;
}

export function createHomeSuggestRecommendationKey(): string {
  return `home:${randomUUID()}`;
}

export function resolveCachedRecommendationKey(
  entry: CachedHomeOutfitEntry,
  localDate: string,
): string | null {
  if (entry.recommendationKey) {
    return entry.recommendationKey;
  }

  if (entry.inputSignature === `daily:${localDate}` && entry.outfit.id.trim().length > 0) {
    return buildDailyRecommendationKey(localDate, entry.outfit.id);
  }

  return null;
}
