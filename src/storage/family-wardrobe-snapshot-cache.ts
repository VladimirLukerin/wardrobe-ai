import type { FamilyWardrobeSnapshot } from '@/services/family-api';

const snapshotCache = new Map<string, FamilyWardrobeSnapshot>();

export function getFamilyWardrobeSnapshotCache(
  memberPublicId: string,
): FamilyWardrobeSnapshot | undefined {
  return snapshotCache.get(memberPublicId);
}

export function setFamilyWardrobeSnapshotCache(
  memberPublicId: string,
  snapshot: FamilyWardrobeSnapshot,
): void {
  snapshotCache.set(memberPublicId, snapshot);
}

export function clearFamilyWardrobeSnapshotCache(memberPublicId?: string): void {
  if (memberPublicId) {
    snapshotCache.delete(memberPublicId);
    return;
  }

  snapshotCache.clear();
}

export function listFamilyWardrobeSnapshotCacheMemberPublicIds(): string[] {
  return [...snapshotCache.keys()];
}
