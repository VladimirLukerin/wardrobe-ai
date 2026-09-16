import type { SavedOutfit } from '@/constants/saved-outfit';
import type { WearEvent } from '@/constants/wear-event';
import type { WardrobeItem } from '@/contexts/wardrobe-context';
import {
  getOutfitCategoryGroup,
  type OutfitCategoryGroup,
} from '@/utils/wardrobe-category-groups';
import { getLocalDayDifference } from '@/utils/wear-date';

const LONG_UNWORN_DAYS = 14;
const MAX_LIST_ITEMS = 5;

export const CATEGORY_GROUP_LABELS: Record<OutfitCategoryGroup, string> = {
  TOP: 'Верх',
  BOTTOM: 'Низ',
  OUTERWEAR: 'Верхний слой',
  SHOES: 'Обувь',
  ACCESSORY: 'Аксессуары',
  OTHER: 'Другое',
};

export const CATEGORY_GROUP_ORDER: OutfitCategoryGroup[] = [
  'TOP',
  'BOTTOM',
  'OUTERWEAR',
  'SHOES',
  'ACCESSORY',
  'OTHER',
];

export type WardrobeItemStatEntry = {
  item: WardrobeItem;
  wearCount: number;
  lastWornAt: string | null;
};

export type CategoryCountEntry = {
  group: OutfitCategoryGroup;
  label: string;
  count: number;
};

export type WardrobeStatistics = {
  totalItems: number;
  favoriteCount: number;
  wornUniqueCount: number;
  savedOutfitCount: number;
  manualOutfitCount: number;
  aiOutfitCount: number;
  usageProgress: number | null;
  topWornItems: WardrobeItemStatEntry[];
  longUnwornItems: WardrobeItemStatEntry[];
  neverWornItems: WardrobeItem[];
  favoriteItems: WardrobeItem[];
  categoryCounts: CategoryCountEntry[];
};

type WearMaps = {
  wearCountByItemId: Map<string, number>;
  lastWornByItemId: Map<string, string>;
};

function buildWearMaps(wearEvents: WearEvent[], validItemIds: Set<string>): WearMaps {
  const wearCountByItemId = new Map<string, number>();
  const lastWornByItemId = new Map<string, string>();

  for (const event of wearEvents) {
    for (const itemId of event.itemIds) {
      if (!validItemIds.has(itemId)) {
        continue;
      }

      wearCountByItemId.set(itemId, (wearCountByItemId.get(itemId) ?? 0) + 1);

      const previous = lastWornByItemId.get(itemId);

      if (!previous || new Date(event.wornAt).getTime() > new Date(previous).getTime()) {
        lastWornByItemId.set(itemId, event.wornAt);
      }
    }
  }

  return { wearCountByItemId, lastWornByItemId };
}

function toStatEntry(
  item: WardrobeItem,
  wearCountByItemId: Map<string, number>,
  lastWornByItemId: Map<string, string>,
): WardrobeItemStatEntry {
  return {
    item,
    wearCount: wearCountByItemId.get(item.id) ?? 0,
    lastWornAt: lastWornByItemId.get(item.id) ?? null,
  };
}

function buildCategoryCounts(items: WardrobeItem[]): CategoryCountEntry[] {
  const counts = new Map<OutfitCategoryGroup, number>();

  for (const item of items) {
    const group = getOutfitCategoryGroup(item.category);
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }

  return CATEGORY_GROUP_ORDER.map((group) => ({
    group,
    label: CATEGORY_GROUP_LABELS[group],
    count: counts.get(group) ?? 0,
  })).filter((entry) => entry.count > 0);
}

export function buildWardrobeStatistics({
  items,
  wearEvents,
  savedOutfits,
}: {
  items: WardrobeItem[];
  wearEvents: WearEvent[];
  savedOutfits: SavedOutfit[];
}): WardrobeStatistics {
  const validItemIds = new Set(items.map((item) => item.id));
  const { wearCountByItemId, lastWornByItemId } = buildWearMaps(wearEvents, validItemIds);

  const statEntries = items.map((item) => toStatEntry(item, wearCountByItemId, lastWornByItemId));

  const wornUniqueCount = statEntries.filter((entry) => entry.wearCount > 0).length;
  const totalItems = items.length;
  const favoriteCount = items.filter((item) => item.isFavorite === true).length;

  const manualOutfitCount = savedOutfits.filter((outfit) => outfit.source === 'manual').length;
  const aiOutfitCount = savedOutfits.length - manualOutfitCount;

  const topWornItems = [...statEntries]
    .filter((entry) => entry.wearCount > 0)
    .sort((left, right) => {
      if (right.wearCount !== left.wearCount) {
        return right.wearCount - left.wearCount;
      }

      const leftTime = left.lastWornAt ? new Date(left.lastWornAt).getTime() : 0;
      const rightTime = right.lastWornAt ? new Date(right.lastWornAt).getTime() : 0;

      return rightTime - leftTime;
    })
    .slice(0, MAX_LIST_ITEMS);

  const longUnwornItems = [...statEntries]
    .filter((entry) => {
      if (entry.wearCount === 0 || !entry.lastWornAt) {
        return false;
      }

      return getLocalDayDifference(entry.lastWornAt) > LONG_UNWORN_DAYS;
    })
    .sort((left, right) => {
      const leftDays = left.lastWornAt ? getLocalDayDifference(left.lastWornAt) : 0;
      const rightDays = right.lastWornAt ? getLocalDayDifference(right.lastWornAt) : 0;

      return rightDays - leftDays;
    })
    .slice(0, MAX_LIST_ITEMS);

  const neverWornItems = statEntries
    .filter((entry) => entry.wearCount === 0)
    .map((entry) => entry.item)
    .slice(0, MAX_LIST_ITEMS);

  const favoriteItems = items.filter((item) => item.isFavorite === true).slice(0, MAX_LIST_ITEMS);

  return {
    totalItems,
    favoriteCount,
    wornUniqueCount,
    savedOutfitCount: savedOutfits.length,
    manualOutfitCount,
    aiOutfitCount,
    usageProgress: totalItems > 0 ? wornUniqueCount / totalItems : null,
    topWornItems,
    longUnwornItems,
    neverWornItems,
    favoriteItems,
    categoryCounts: buildCategoryCounts(items),
  };
}

export function formatWearCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} раз`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${count} раза`;
  }

  return `${count} раз`;
}

export function formatLastWornDaysAgo(lastWornAt: string): string {
  const days = getLocalDayDifference(lastWornAt);

  if (days <= 0) {
    return 'Последний раз сегодня';
  }

  if (days === 1) {
    return 'Последний раз вчера';
  }

  const mod10 = days % 10;
  const mod100 = days % 100;
  let suffix = 'дней';

  if (mod10 === 1 && mod100 !== 11) {
    suffix = 'день';
  } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    suffix = 'дня';
  }

  return `Последний раз ${days} ${suffix} назад`;
}
