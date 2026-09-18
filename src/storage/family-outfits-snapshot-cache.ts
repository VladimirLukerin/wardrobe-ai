import type { FamilyOutfitsSnapshot } from '@/services/family-api';

const snapshotCache = new Map<string, FamilyOutfitsSnapshot>();

export function getFamilyOutfitsSnapshotCache(
  memberPublicId: string,
): FamilyOutfitsSnapshot | undefined {
  return snapshotCache.get(memberPublicId);
}

export function setFamilyOutfitsSnapshotCache(
  memberPublicId: string,
  snapshot: FamilyOutfitsSnapshot,
): void {
  snapshotCache.set(memberPublicId, snapshot);
}

export function clearFamilyOutfitsSnapshotCache(memberPublicId?: string): void {
  if (memberPublicId) {
    snapshotCache.delete(memberPublicId);
    return;
  }

  snapshotCache.clear();
}
