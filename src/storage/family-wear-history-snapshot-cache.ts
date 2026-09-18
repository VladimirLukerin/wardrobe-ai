import type { FamilyWearHistorySnapshot } from '@/services/family-api';

const SNAPSHOT_TTL_MS = 3 * 60 * 1000;

type CachedFamilyWearHistorySnapshot = {
  snapshot: FamilyWearHistorySnapshot;
  fetchedAt: number;
};

const snapshotCache = new Map<string, CachedFamilyWearHistorySnapshot>();

export function getFamilyWearHistorySnapshotCache(
  memberPublicId: string,
  now = Date.now(),
  allowStale = false,
): FamilyWearHistorySnapshot | undefined {
  const cached = snapshotCache.get(memberPublicId);

  if (!cached) {
    return undefined;
  }

  if (!allowStale && now - cached.fetchedAt > SNAPSHOT_TTL_MS) {
    snapshotCache.delete(memberPublicId);
    return undefined;
  }

  return cached.snapshot;
}

export function setFamilyWearHistorySnapshotCache(
  memberPublicId: string,
  snapshot: FamilyWearHistorySnapshot,
  fetchedAt = Date.now(),
): void {
  snapshotCache.set(memberPublicId, { snapshot, fetchedAt });
}

export function clearFamilyWearHistorySnapshotCache(memberPublicId?: string): void {
  if (memberPublicId) {
    snapshotCache.delete(memberPublicId);
    return;
  }

  snapshotCache.clear();
}

export function listFamilyWearHistorySnapshotCacheMemberPublicIds(): string[] {
  return [...snapshotCache.keys()];
}

export function pruneFamilyWearHistorySnapshotCache(activeMemberPublicIds: string[]): void {
  const activeIds = new Set(activeMemberPublicIds);

  for (const memberPublicId of snapshotCache.keys()) {
    if (!activeIds.has(memberPublicId)) {
      snapshotCache.delete(memberPublicId);
    }
  }
}

export function isFamilyWearHistorySnapshotFresh(
  memberPublicId: string,
  now = Date.now(),
): boolean {
  return getFamilyWearHistorySnapshotCache(memberPublicId, now) !== undefined;
}
