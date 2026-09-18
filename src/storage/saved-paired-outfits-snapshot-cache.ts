import type { SavedPairedOutfit } from '@/services/paired-outfits-storage';

let snapshotCache: SavedPairedOutfit[] | null = null;

export function getSavedPairedOutfitsSnapshotCache(): SavedPairedOutfit[] | null {
  return snapshotCache;
}

export function setSavedPairedOutfitsSnapshotCache(outfits: SavedPairedOutfit[]): void {
  snapshotCache = outfits;
}

export function removeSavedPairedOutfitFromSnapshotCache(outfitId: string): void {
  if (!snapshotCache) {
    return;
  }

  snapshotCache = snapshotCache.filter((outfit) => outfit.id !== outfitId);
}

export function clearSavedPairedOutfitsSnapshotCache(): void {
  snapshotCache = null;
}
