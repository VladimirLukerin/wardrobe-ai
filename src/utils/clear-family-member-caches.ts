import type { FamilyMember } from '@/constants/family';
import {
  clearFamilyOutfitsSnapshotCache,
  getFamilyOutfitsSnapshotCache,
  listFamilyOutfitsSnapshotCacheMemberPublicIds,
} from '@/storage/family-outfits-snapshot-cache';
import {
  clearFamilyWardrobeSnapshotCache,
  getFamilyWardrobeSnapshotCache,
  listFamilyWardrobeSnapshotCacheMemberPublicIds,
} from '@/storage/family-wardrobe-snapshot-cache';
import {
  clearFamilyWearHistorySnapshotCache,
  getFamilyWearHistorySnapshotCache,
  listFamilyWearHistorySnapshotCacheMemberPublicIds,
} from '@/storage/family-wear-history-snapshot-cache';
import { collectKnownFamilyItemIdsForMemberCleanup } from '@/utils/collect-known-family-item-ids';
import { clearFamilyMemberWardrobeLocalImageFiles } from '@/utils/family-wardrobe-local-image-path';

function collectCachedFamilyMemberPublicIds(): string[] {
  const memberPublicIds = new Set<string>();

  for (const memberPublicId of listFamilyWearHistorySnapshotCacheMemberPublicIds()) {
    memberPublicIds.add(memberPublicId);
  }

  for (const memberPublicId of listFamilyWardrobeSnapshotCacheMemberPublicIds()) {
    memberPublicIds.add(memberPublicId);
  }

  for (const memberPublicId of listFamilyOutfitsSnapshotCacheMemberPublicIds()) {
    memberPublicIds.add(memberPublicId);
  }

  return [...memberPublicIds];
}

export async function clearFamilyMemberCachesBestEffort(memberPublicId: string): Promise<void> {
  const wardrobeSnapshot = getFamilyWardrobeSnapshotCache(memberPublicId);
  const wearHistorySnapshot = getFamilyWearHistorySnapshotCache(memberPublicId, Date.now(), true);
  const outfitsSnapshot = getFamilyOutfitsSnapshotCache(memberPublicId);
  const knownItemIds = collectKnownFamilyItemIdsForMemberCleanup({
    wardrobeSnapshot,
    wearHistorySnapshot,
    outfitsSnapshot,
  });

  clearFamilyWearHistorySnapshotCache(memberPublicId);
  clearFamilyWardrobeSnapshotCache(memberPublicId);
  clearFamilyOutfitsSnapshotCache(memberPublicId);

  try {
    await clearFamilyMemberWardrobeLocalImageFiles(memberPublicId, knownItemIds);
  } catch (error) {
    if (__DEV__) {
      console.warn(
        `[FAMILY CACHE] Failed to clear wardrobe images for member=${memberPublicId.slice(0, 8)}`,
        error,
      );
    }
  }
}

export function pruneRemovedFamilyMemberCaches(activeMembers: FamilyMember[]): void {
  const activeMemberPublicIds = new Set(activeMembers.map((member) => member.publicId));

  for (const memberPublicId of collectCachedFamilyMemberPublicIds()) {
    if (!activeMemberPublicIds.has(memberPublicId)) {
      void clearFamilyMemberCachesBestEffort(memberPublicId);
    }
  }
}
