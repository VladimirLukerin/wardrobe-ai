import { getPreferencesResponse } from '../db/user-preferences-repository';
import { getActiveSavedOutfitsForUser } from '../db/saved-outfits-repository';
import { getActiveWardrobeItemsForUser } from '../db/wardrobe-items-repository';
import { getWearHistorySnapshot } from '../db/wear-events-repository';
import type { WearEventResponse } from '../db/wear-events-repository';
import type {
  BehavioralContextPayload,
  StylistPreferencesPayload,
  UserParametersPayload,
  WardrobeItemPayload,
} from '../suggest-outfits';
import { buildServerBehavioralContext } from './build-behavioral-context';
import {
  buildItemBehaviorSignals,
  buildSavedOutfitUseCounts,
  type ItemBehaviorSignals,
  type ItemWearStats,
} from './item-behavior-signals';

const DEFAULT_STYLIST_PREFERENCES: StylistPreferencesPayload = {
  considerWeather: true,
  styleExperiment: 'balanced',
  wardrobeMode: 'owned-only',
  avoidRepeatedOutfits: true,
};

export type PairedWardrobeItemPayload = WardrobeItemPayload & ItemBehaviorSignals;

export type PersonPairedOutfitContext = {
  userId: string;
  displayName: string | null;
  wardrobe: PairedWardrobeItemPayload[];
  stylistPreferences: StylistPreferencesPayload;
  userParameters: UserParametersPayload;
  behavioralContext: BehavioralContextPayload;
};

function buildWearStatsByItem(
  itemIds: string[],
  wearEvents: WearEventResponse[],
): Map<string, ItemWearStats> {
  const stats = new Map<string, ItemWearStats>();

  for (const itemId of itemIds) {
    stats.set(itemId, { wearCount: 0, lastWornAt: null });
  }

  for (const event of wearEvents) {
    for (const itemId of event.itemIds) {
      if (!stats.has(itemId)) {
        continue;
      }

      const current = stats.get(itemId)!;
      current.wearCount += 1;

      if (!current.lastWornAt || new Date(event.wornAt) > new Date(current.lastWornAt)) {
        current.lastWornAt = event.wornAt;
      }
    }
  }

  return stats;
}

export function buildPersonPairedOutfitContext(userId: string): PersonPairedOutfitContext {
  const wardrobeRows = getActiveWardrobeItemsForUser(userId);
  const savedOutfits = getActiveSavedOutfitsForUser(userId);
  const wearEvents = getWearHistorySnapshot(userId).events;
  const preferences = getPreferencesResponse(userId);
  const itemIds = wardrobeRows.map((item) => item.id);
  const wearStatsByItem = buildWearStatsByItem(itemIds, wearEvents);
  const savedOutfitUseCounts = buildSavedOutfitUseCounts(
    itemIds,
    savedOutfits.map((outfit) => outfit.itemIds),
  );
  const allWearCounts = itemIds.map((itemId) => wearStatsByItem.get(itemId)?.wearCount ?? 0);
  const now = new Date();

  const wardrobe: PairedWardrobeItemPayload[] = wardrobeRows.map((item) => {
    const wearStats = wearStatsByItem.get(item.id) ?? { wearCount: 0, lastWornAt: null };
    const behavior = buildItemBehaviorSignals({
      itemId: item.id,
      isFavorite: item.isFavorite,
      wearStats,
      savedOutfitUseCount: savedOutfitUseCounts.get(item.id) ?? 0,
      allWearCounts,
      now,
    });

    return {
      id: item.id,
      name: item.name,
      category: item.category,
      color: item.color,
      pattern: item.pattern,
      printDescription: item.printDescription,
      style: item.style,
      lastWornAt: wearStats.lastWornAt,
      ...behavior,
    };
  });

  const stylistPreferences = preferences.stylistPreferences ?? DEFAULT_STYLIST_PREFERENCES;
  const userParameters: UserParametersPayload = {
    fitPreference: preferences.bodyParameters?.fitPreference ?? null,
    weatherSensitivity: preferences.bodyParameters?.weatherSensitivity ?? null,
  };

  const behavioralContext = buildServerBehavioralContext({
    wardrobe,
    savedOutfits,
    wearEvents,
    avoidRepeatedOutfits: stylistPreferences.avoidRepeatedOutfits,
  });

  return {
    userId,
    displayName: preferences.displayName,
    wardrobe,
    stylistPreferences,
    userParameters,
    behavioralContext,
  };
}
