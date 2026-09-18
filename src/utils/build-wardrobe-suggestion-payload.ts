import type { WardrobeItem } from '@/contexts/wardrobe-context';
import { getLocalCalendarDateKey } from '@/utils/wear-date';

export type WardrobeSuggestionItemPayload = {
  id: string;
  name: string;
  category: string;
  color: string;
  pattern: string;
  printDescription: string | null;
  style: string;
  isFavorite: boolean;
  wearCount: number;
  lastWornAt: string | null;
};

export type WearHistoryLookup = {
  getItemWearCount: (itemId: string) => number;
  getItemLastWornAt: (itemId: string) => string | null;
};

export function buildWardrobeSuggestionPayload(
  wardrobe: WardrobeItem[],
  wearHistory: WearHistoryLookup,
): WardrobeSuggestionItemPayload[] {
  return wardrobe.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    color: item.color,
    pattern: item.pattern,
    printDescription: item.printDescription,
    style: item.style,
    isFavorite: item.isFavorite === true,
    wearCount: wearHistory.getItemWearCount(item.id),
    lastWornAt: wearHistory.getItemLastWornAt(item.id),
  }));
}

export function normalizeLastWornAtForSignature(lastWornAt: string | null): string {
  if (!lastWornAt) {
    return 'null';
  }

  return getLocalCalendarDateKey(lastWornAt);
}

export function logOutfitPersonalizationDiagnostics(payload: WardrobeSuggestionItemPayload[]): void {
  if (!__DEV__) {
    return;
  }

  const favorites = payload.filter((item) => item.isFavorite).length;
  const wearHistoryItems = payload.filter((item) => item.wearCount > 0).length;

  console.log(`[OUTFIT PERSONALIZATION] favorites: ${favorites}, wear history items: ${wearHistoryItems}`);
}
