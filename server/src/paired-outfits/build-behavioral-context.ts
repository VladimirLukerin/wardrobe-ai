import type { SavedOutfitResponse } from '../db/saved-outfits-repository';
import type { WearEventResponse } from '../db/wear-events-repository';
import type { BehavioralContextPayload, CompactOutfitRef } from '../suggest-outfits';
import type { PairedWardrobeItemPayload } from './build-person-context';

const TOP_FREQUENTLY_WORN = 10;
const RECENT_MANUAL_OUTFITS = 5;
const RECENT_SAVED_AI_OUTFITS = 5;
const RECENT_OUTFIT_SIGNATURES = 8;

function getOutfitItemIdsSignature(itemIds: string[]): string {
  return [...new Set(itemIds)].sort().join('|');
}

function filterOutfitToExistingItems(itemIds: string[], wardrobeIds: Set<string>): string[] {
  return itemIds.filter((itemId) => wardrobeIds.has(itemId));
}

function toCompactOutfit(
  outfit: SavedOutfitResponse,
  wardrobeIds: Set<string>,
): CompactOutfitRef | null {
  const itemIds = filterOutfitToExistingItems(outfit.itemIds, wardrobeIds);

  if (itemIds.length === 0) {
    return null;
  }

  return {
    itemIds,
    title: outfit.title.trim() || undefined,
  };
}

export function buildServerBehavioralContext({
  wardrobe,
  savedOutfits,
  wearEvents,
  avoidRepeatedOutfits,
}: {
  wardrobe: PairedWardrobeItemPayload[];
  savedOutfits: SavedOutfitResponse[];
  wearEvents: WearEventResponse[];
  avoidRepeatedOutfits: boolean;
}): BehavioralContextPayload {
  const wardrobeIds = new Set(wardrobe.map((item) => item.id));

  const favoriteItemIds = wardrobe.filter((item) => item.isFavorite).map((item) => item.id);

  const frequentlyWorn = wardrobe
    .filter((item) => item.wearCount > 0)
    .sort((left, right) => {
      if (right.wearCount !== left.wearCount) {
        return right.wearCount - left.wearCount;
      }

      const leftTime = left.lastWornAt ? new Date(left.lastWornAt).getTime() : 0;
      const rightTime = right.lastWornAt ? new Date(right.lastWornAt).getTime() : 0;

      return rightTime - leftTime;
    })
    .slice(0, TOP_FREQUENTLY_WORN)
    .map((item) => ({
      id: item.id,
      wearCount: item.wearCount,
      lastWornAt: item.lastWornAt,
    }));

  const recentManualOutfits = savedOutfits
    .filter((outfit) => outfit.source === 'manual')
    .slice(0, RECENT_MANUAL_OUTFITS)
    .map((outfit) => toCompactOutfit(outfit, wardrobeIds))
    .filter((outfit): outfit is CompactOutfitRef => outfit !== null);

  const recentSavedAiOutfits = savedOutfits
    .filter((outfit) => outfit.source === 'ai')
    .slice(0, RECENT_SAVED_AI_OUTFITS)
    .map((outfit) => toCompactOutfit(outfit, wardrobeIds))
    .filter((outfit): outfit is CompactOutfitRef => outfit !== null);

  const recentOutfitSignatures: string[] = [];

  if (avoidRepeatedOutfits) {
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

    recentOutfitSignatures.push(...[...signatures].slice(0, RECENT_OUTFIT_SIGNATURES));
  }

  return {
    favoriteItemIds,
    frequentlyWorn,
    recentManualOutfits,
    recentSavedAiOutfits,
    recentOutfitSignatures,
  };
}
