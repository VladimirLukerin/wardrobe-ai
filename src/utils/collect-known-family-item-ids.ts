import type {
  FamilyOutfitsSnapshot,
  FamilyWardrobeSnapshot,
  FamilyWearHistorySnapshot,
} from '@/services/family-api';

export function collectKnownFamilyItemIdsForMemberCleanup({
  wardrobeSnapshot,
  wearHistorySnapshot,
  outfitsSnapshot,
}: {
  wardrobeSnapshot?: FamilyWardrobeSnapshot;
  wearHistorySnapshot?: FamilyWearHistorySnapshot;
  outfitsSnapshot?: FamilyOutfitsSnapshot;
}): string[] {
  const itemIds = new Set<string>();

  for (const item of wardrobeSnapshot?.items ?? []) {
    itemIds.add(item.id);
  }

  for (const event of wearHistorySnapshot?.events ?? []) {
    for (const itemId of event.itemIds) {
      itemIds.add(itemId);
    }
  }

  for (const outfit of outfitsSnapshot?.outfits ?? []) {
    for (const itemId of outfit.itemIds) {
      itemIds.add(itemId);
    }
  }

  return [...itemIds];
}
