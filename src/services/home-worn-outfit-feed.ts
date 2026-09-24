import { getFamilyMemberLabel, type FamilyMember } from '@/constants/family';
import type { SavedOutfit } from '@/constants/saved-outfit';
import type { WearEvent } from '@/constants/wear-event';
import type { WardrobeItem } from '@/contexts/wardrobe-context';
import { AccountApiError } from '@/services/account';
import {
  fetchFamilyMemberOutfits,
  fetchFamilyMemberWardrobe,
  fetchFamilyMemberWearHistory,
  type FamilyWardrobeItem,
} from '@/services/family-api';
import { getAuthToken } from '@/storage/auth-token-storage';
import {
  clearFamilyOutfitsSnapshotCache,
  getFamilyOutfitsSnapshotCache,
  setFamilyOutfitsSnapshotCache,
} from '@/storage/family-outfits-snapshot-cache';
import {
  clearFamilyWearHistorySnapshotCache,
  getFamilyWearHistorySnapshotCache,
  isFamilyWearHistorySnapshotFresh,
  setFamilyWearHistorySnapshotCache,
} from '@/storage/family-wear-history-snapshot-cache';
import {
  getFamilyWardrobeSnapshotCache,
  setFamilyWardrobeSnapshotCache,
} from '@/storage/family-wardrobe-snapshot-cache';
import { pruneRemovedFamilyMemberCaches } from '@/utils/clear-family-member-caches';
import {
  buildWornOutfitFeed,
  type FamilyWearFeedMemberInput,
  type WornOutfitFeedEntry,
} from '@/utils/build-worn-outfit-feed';
import { resolveWardrobeItemsFromIds } from '@/utils/resolve-wardrobe-items';
import { isRetryableNetworkError } from '@/utils/network-error';

const PASSIVE_REFRESH_MIN_INTERVAL_MS = 3_000;

export type WornOutfitFeedDisplayEntry =
  | (WornOutfitFeedEntry & {
      source: 'self';
      items: WardrobeItem[];
    })
  | (WornOutfitFeedEntry & {
      source: 'family';
      memberPublicId: string;
      items: FamilyWardrobeItem[];
    });

type BuildDisplayEntriesParams = {
  feedEntries: WornOutfitFeedEntry[];
  wardrobeById: Map<string, WardrobeItem>;
  familyWardrobeByMember: Map<string, Map<string, FamilyWardrobeItem>>;
};

function buildDisplayEntries({
  feedEntries,
  wardrobeById,
  familyWardrobeByMember,
}: BuildDisplayEntriesParams): WornOutfitFeedDisplayEntry[] {
  const displayEntries: WornOutfitFeedDisplayEntry[] = [];

  for (const entry of feedEntries) {
    if (entry.source === 'self') {
      const items = resolveWardrobeItemsFromIds(entry.itemIds, wardrobeById);

      if (items.length === 0) {
        continue;
      }

      displayEntries.push({
        ...entry,
        source: 'self',
        items,
      });
      continue;
    }

    const memberWardrobe = familyWardrobeByMember.get(entry.memberPublicId ?? '');

    if (!memberWardrobe || !entry.memberPublicId) {
      continue;
    }

    const seenItemIds = new Set<string>();
    const items = entry.itemIds.flatMap((itemId) => {
      if (seenItemIds.has(itemId)) {
        return [];
      }

      seenItemIds.add(itemId);

      const item = memberWardrobe.get(itemId);

      return item ? [item] : [];
    });

    if (items.length === 0) {
      continue;
    }

    displayEntries.push({
      ...entry,
      source: 'family',
      memberPublicId: entry.memberPublicId,
      items,
    });
  }

  return displayEntries;
}

async function loadFamilyMemberFeedInput(
  token: string,
  member: FamilyMember,
  forceRefresh: boolean,
): Promise<FamilyWearFeedMemberInput | null> {
  let wearHistorySnapshot = forceRefresh
    ? undefined
    : getFamilyWearHistorySnapshotCache(member.publicId);
  let outfitsSnapshot = forceRefresh ? undefined : getFamilyOutfitsSnapshotCache(member.publicId);

  try {
    if (!wearHistorySnapshot) {
      wearHistorySnapshot = await fetchFamilyMemberWearHistory(token, member.publicId);
      setFamilyWearHistorySnapshotCache(member.publicId, wearHistorySnapshot);
    }

    if (!outfitsSnapshot) {
      outfitsSnapshot = await fetchFamilyMemberOutfits(token, member.publicId);
      setFamilyOutfitsSnapshotCache(member.publicId, outfitsSnapshot);
    }
  } catch (error) {
    if (error instanceof AccountApiError && (error.status === 403 || error.status === 404)) {
      clearFamilyWearHistorySnapshotCache(member.publicId);
      clearFamilyOutfitsSnapshotCache(member.publicId);
      return null;
    }

    wearHistorySnapshot =
      wearHistorySnapshot ??
      getFamilyWearHistorySnapshotCache(member.publicId, Date.now(), true);
    outfitsSnapshot =
      outfitsSnapshot ?? getFamilyOutfitsSnapshotCache(member.publicId);

    if (!wearHistorySnapshot) {
      if (isRetryableNetworkError(error)) {
        return null;
      }

      throw error;
    }
  }

  const outfitTitlesById = new Map(
    (outfitsSnapshot?.outfits ?? []).map((outfit) => [outfit.id, outfit.title]),
  );

  return {
    memberPublicId: member.publicId,
    displayName: getFamilyMemberLabel(member),
    events: wearHistorySnapshot.events,
    outfitTitlesById,
  };
}

async function loadFamilyWardrobeMaps(
  token: string,
  feedEntries: WornOutfitFeedEntry[],
  forceRefresh: boolean,
): Promise<Map<string, Map<string, FamilyWardrobeItem>>> {
  const neededItemIdsByMember = new Map<string, Set<string>>();

  for (const entry of feedEntries) {
    if (entry.source !== 'family' || !entry.memberPublicId) {
      continue;
    }

    const itemIds = neededItemIdsByMember.get(entry.memberPublicId) ?? new Set<string>();

    for (const itemId of entry.itemIds) {
      itemIds.add(itemId);
    }

    neededItemIdsByMember.set(entry.memberPublicId, itemIds);
  }

  const familyWardrobeByMember = new Map<string, Map<string, FamilyWardrobeItem>>();
  const memberPublicIds = [...neededItemIdsByMember.keys()];

  await Promise.all(
    memberPublicIds.map(async (memberPublicId) => {
      const neededItemIds = neededItemIdsByMember.get(memberPublicId);

      if (!neededItemIds || neededItemIds.size === 0) {
        return;
      }

      let wardrobeSnapshot = forceRefresh
        ? undefined
        : getFamilyWardrobeSnapshotCache(memberPublicId);
      const hasAllItems =
        wardrobeSnapshot &&
        [...neededItemIds].every((itemId) =>
          wardrobeSnapshot!.items.some((item) => item.id === itemId),
        );

      if (!wardrobeSnapshot || !hasAllItems) {
        try {
          wardrobeSnapshot = await fetchFamilyMemberWardrobe(token, memberPublicId);
          setFamilyWardrobeSnapshotCache(memberPublicId, wardrobeSnapshot);
        } catch (error) {
          if (error instanceof AccountApiError && (error.status === 403 || error.status === 404)) {
            return;
          }

          wardrobeSnapshot = getFamilyWardrobeSnapshotCache(memberPublicId);

          if (!wardrobeSnapshot) {
            return;
          }
        }
      }

      const wardrobeById = new Map<string, FamilyWardrobeItem>();

      for (const item of wardrobeSnapshot.items) {
        if (neededItemIds.has(item.id)) {
          wardrobeById.set(item.id, item);
        }
      }

      familyWardrobeByMember.set(memberPublicId, wardrobeById);
    }),
  );

  return familyWardrobeByMember;
}

export async function buildHomeWornOutfitFeedDisplayEntries({
  wearEvents,
  savedOutfits,
  wardrobeItems,
  familyMembers,
  token,
  forceRefresh = false,
}: {
  wearEvents: WearEvent[];
  savedOutfits: SavedOutfit[];
  wardrobeItems: WardrobeItem[];
  familyMembers: FamilyMember[];
  token: string | null;
  forceRefresh?: boolean;
}): Promise<WornOutfitFeedDisplayEntry[]> {
  const wardrobeById = new Map(wardrobeItems.map((item) => [item.id, item]));

  let familyInputs: FamilyWearFeedMemberInput[] = [];

  if (token && familyMembers.length > 0) {
    const settled = await Promise.allSettled(
      familyMembers.map((member) => loadFamilyMemberFeedInput(token, member, forceRefresh)),
    );

    familyInputs = settled.flatMap((result) =>
      result.status === 'fulfilled' && result.value ? [result.value] : [],
    );
  }

  const feedEntries = buildWornOutfitFeed(
    {
      events: wearEvents,
      savedOutfits,
    },
    familyInputs,
  );

  const familyWardrobeByMember = token
    ? await loadFamilyWardrobeMaps(token, feedEntries, forceRefresh)
    : new Map<string, Map<string, FamilyWardrobeItem>>();

  return buildDisplayEntries({
    feedEntries,
    wardrobeById,
    familyWardrobeByMember,
  });
}

export function shouldRefreshHomeWornOutfitFeed(
  familyMembers: FamilyMember[],
  lastRefreshAt: number,
  now = Date.now(),
): boolean {
  if (now - lastRefreshAt < PASSIVE_REFRESH_MIN_INTERVAL_MS) {
    return false;
  }

  return familyMembers.some(
    (member) => !isFamilyWearHistorySnapshotFresh(member.publicId, now),
  );
}

export function pruneHomeWornOutfitFeedCaches(familyMembers: FamilyMember[]): void {
  pruneRemovedFamilyMemberCaches(familyMembers);
}
