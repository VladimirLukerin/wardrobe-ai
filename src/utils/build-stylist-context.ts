import type { FitPreference, WeatherSensitivity } from '@/constants/body-parameters';
import type { SavedOutfit } from '@/constants/saved-outfit';
import type { StylistPreferences } from '@/constants/stylist-preferences';
import type { WearEvent } from '@/constants/wear-event';
import type { WardrobeItem } from '@/contexts/wardrobe-context';
import type { SuggestOutfitsLocation } from '@/services/outfit-suggestions';
import {
  buildWardrobeSuggestionPayload,
  type WardrobeSuggestionItemPayload,
  type WearHistoryLookup,
} from '@/utils/build-wardrobe-suggestion-payload';
import { getOutfitItemIdsSignature } from '@/utils/outfit-item-ids-signature';

const TOP_FREQUENTLY_WORN = 10;
const RECENT_MANUAL_OUTFITS = 5;
const RECENT_SAVED_AI_OUTFITS = 5;
const RECENT_OUTFIT_SIGNATURES = 8;

export type FrequentlyWornItem = {
  id: string;
  wearCount: number;
  lastWornAt: string | null;
};

export type CompactOutfitRef = {
  itemIds: string[];
  title?: string;
};

export type BehavioralContextPayload = {
  favoriteItemIds: string[];
  frequentlyWorn: FrequentlyWornItem[];
  recentManualOutfits: CompactOutfitRef[];
  recentSavedAiOutfits: CompactOutfitRef[];
  recentOutfitSignatures: string[];
};

export type StylistUserParameters = {
  fitPreference: FitPreference | null;
  weatherSensitivity: WeatherSensitivity | null;
};

export type StylistContextPayload = {
  wardrobe: WardrobeSuggestionItemPayload[];
  stylistPreferences: StylistPreferences;
  userParameters: StylistUserParameters;
  behavioralContext: BehavioralContextPayload;
  location: SuggestOutfitsLocation | null;
};

export type BuildStylistContextInput = {
  wardrobe: WardrobeItem[];
  savedOutfits: SavedOutfit[];
  wearEvents: WearEvent[];
  wearHistory: WearHistoryLookup;
  stylistPreferences: StylistPreferences;
  userParameters: StylistUserParameters;
  location: SuggestOutfitsLocation | null;
};

function filterOutfitToExistingItems(itemIds: string[], wardrobeIds: Set<string>): string[] {
  return itemIds.filter((itemId) => wardrobeIds.has(itemId));
}

function buildRecentOutfitSignatures(
  savedOutfits: SavedOutfit[],
  wearEvents: WearEvent[],
  wardrobeIds: Set<string>,
  avoidRepeatedOutfits: boolean,
): string[] {
  if (!avoidRepeatedOutfits) {
    return [];
  }

  const signatures = new Set<string>();

  for (const event of wearEvents) {
    const filtered = filterOutfitToExistingItems(event.itemIds, wardrobeIds);

    if (filtered.length >= 2) {
      signatures.add(getOutfitItemIdsSignature(filtered));
    }
  }

  for (const outfit of savedOutfits) {
    const filtered = filterOutfitToExistingItems(outfit.itemIds, wardrobeIds);

    if (filtered.length >= 2) {
      signatures.add(getOutfitItemIdsSignature(filtered));
    }
  }

  return [...signatures].slice(0, RECENT_OUTFIT_SIGNATURES);
}

export function buildBehavioralContext({
  wardrobe,
  savedOutfits,
  wearEvents,
  wearHistory,
  avoidRepeatedOutfits,
}: {
  wardrobe: WardrobeItem[];
  savedOutfits: SavedOutfit[];
  wearEvents: WearEvent[];
  wearHistory: WearHistoryLookup;
  avoidRepeatedOutfits: boolean;
}): BehavioralContextPayload {
  const wardrobeIds = new Set(wardrobe.map((item) => item.id));

  const favoriteItemIds = wardrobe
    .filter((item) => item.isFavorite === true)
    .map((item) => item.id);

  const frequentlyWorn = wardrobe
    .map((item) => ({
      id: item.id,
      wearCount: wearHistory.getItemWearCount(item.id),
      lastWornAt: wearHistory.getItemLastWornAt(item.id),
    }))
    .filter((entry) => entry.wearCount > 0)
    .sort((left, right) => {
      if (right.wearCount !== left.wearCount) {
        return right.wearCount - left.wearCount;
      }

      const leftTime = left.lastWornAt ? new Date(left.lastWornAt).getTime() : 0;
      const rightTime = right.lastWornAt ? new Date(right.lastWornAt).getTime() : 0;

      return rightTime - leftTime;
    })
    .slice(0, TOP_FREQUENTLY_WORN);

  const toCompactOutfit = (outfit: SavedOutfit): CompactOutfitRef | null => {
    const itemIds = filterOutfitToExistingItems(outfit.itemIds, wardrobeIds);

    if (itemIds.length === 0) {
      return null;
    }

    return {
      itemIds,
      title: outfit.title.trim() || undefined,
    };
  };

  const recentManualOutfits = savedOutfits
    .filter((outfit) => outfit.source === 'manual')
    .slice(0, RECENT_MANUAL_OUTFITS)
    .map(toCompactOutfit)
    .filter((entry): entry is CompactOutfitRef => entry !== null);

  const recentSavedAiOutfits = savedOutfits
    .filter((outfit) => outfit.source !== 'manual')
    .slice(0, RECENT_SAVED_AI_OUTFITS)
    .map(toCompactOutfit)
    .filter((entry): entry is CompactOutfitRef => entry !== null);

  const recentOutfitSignatures = buildRecentOutfitSignatures(
    savedOutfits,
    wearEvents,
    wardrobeIds,
    avoidRepeatedOutfits,
  );

  return {
    favoriteItemIds,
    frequentlyWorn,
    recentManualOutfits,
    recentSavedAiOutfits,
    recentOutfitSignatures,
  };
}

export function buildStylistContext({
  wardrobe,
  savedOutfits,
  wearEvents,
  wearHistory,
  stylistPreferences,
  userParameters,
  location,
}: BuildStylistContextInput): StylistContextPayload {
  return {
    wardrobe: buildWardrobeSuggestionPayload(wardrobe, wearHistory),
    stylistPreferences,
    userParameters,
    behavioralContext: buildBehavioralContext({
      wardrobe,
      savedOutfits,
      wearEvents,
      wearHistory,
      avoidRepeatedOutfits: stylistPreferences.avoidRepeatedOutfits,
    }),
    location,
  };
}

export function buildBehavioralContextSignature(context: BehavioralContextPayload): string {
  const manualPart = context.recentManualOutfits
    .map((outfit) => getOutfitItemIdsSignature(outfit.itemIds))
    .join(',');
  const aiPart = context.recentSavedAiOutfits
    .map((outfit) => getOutfitItemIdsSignature(outfit.itemIds))
    .join(',');
  const signaturesPart = context.recentOutfitSignatures.join(',');

  return [
    context.favoriteItemIds.sort().join(','),
    context.frequentlyWorn.map((entry) => `${entry.id}:${entry.wearCount}`).join(','),
    manualPart,
    aiPart,
    signaturesPart,
  ].join('|');
}

export function logStylistContextDiagnostics(context: StylistContextPayload): void {
  if (!__DEV__) {
    return;
  }

  const { behavioralContext } = context;

  console.log(
    `[OUTFIT PERSONALIZATION] favorites: ${behavioralContext.favoriteItemIds.length}, ` +
      `wear history items: ${behavioralContext.frequentlyWorn.length}, ` +
      `manual outfits: ${behavioralContext.recentManualOutfits.length}, ` +
      `saved ai outfits: ${behavioralContext.recentSavedAiOutfits.length}`,
  );
}
