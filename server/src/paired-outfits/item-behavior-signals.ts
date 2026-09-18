export type UsageTier = 'frequent' | 'regular' | 'rare' | 'never';

export type ItemBehaviorSignals = {
  wearCount: number;
  daysSinceLastWorn: number | null;
  neverWorn: boolean;
  isFavorite: boolean;
  savedOutfitUseCount: number;
  usageTier: UsageTier;
};

export type ItemWearStats = {
  wearCount: number;
  lastWornAt: string | null;
};

export function computeUsageTier(
  wearCount: number,
  wornCounts: number[],
): UsageTier {
  if (wearCount <= 0) {
    return 'never';
  }

  const positiveCounts = wornCounts.filter((count) => count > 0);

  if (positiveCounts.length === 0) {
    return 'never';
  }

  if (positiveCounts.length === 1) {
    return 'frequent';
  }

  const sorted = [...positiveCounts].sort((left, right) => left - right);
  const rank = sorted.filter((count) => count <= wearCount).length / sorted.length;

  if (rank >= 0.67) {
    return 'frequent';
  }

  if (rank >= 0.34) {
    return 'regular';
  }

  return 'rare';
}

export function computeDaysSinceLastWorn(lastWornAt: string | null, now: Date = new Date()): number | null {
  if (!lastWornAt) {
    return null;
  }

  const wornAt = new Date(lastWornAt);

  if (Number.isNaN(wornAt.getTime())) {
    return null;
  }

  const diffMs = now.getTime() - wornAt.getTime();

  if (diffMs < 0) {
    return 0;
  }

  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function buildSavedOutfitUseCounts(
  itemIds: string[],
  savedOutfitItemIds: string[][],
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const itemId of itemIds) {
    counts.set(itemId, 0);
  }

  for (const outfitItemIds of savedOutfitItemIds) {
    for (const itemId of outfitItemIds) {
      if (!counts.has(itemId)) {
        continue;
      }

      counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
    }
  }

  return counts;
}

export function buildItemBehaviorSignals({
  itemId,
  isFavorite,
  wearStats,
  savedOutfitUseCount,
  allWearCounts,
  now = new Date(),
}: {
  itemId: string;
  isFavorite: boolean;
  wearStats: ItemWearStats;
  savedOutfitUseCount: number;
  allWearCounts: number[];
  now?: Date;
}): ItemBehaviorSignals {
  void itemId;

  const wearCount = wearStats.wearCount;
  const neverWorn = wearCount === 0;

  return {
    wearCount,
    daysSinceLastWorn: computeDaysSinceLastWorn(wearStats.lastWornAt, now),
    neverWorn,
    isFavorite,
    savedOutfitUseCount,
    usageTier: computeUsageTier(wearCount, allWearCounts),
  };
}
