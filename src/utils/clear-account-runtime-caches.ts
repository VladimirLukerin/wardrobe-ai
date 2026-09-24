import { clearFamilyOutfitsSnapshotCache } from '@/storage/family-outfits-snapshot-cache';
import { clearFamilyWardrobeSnapshotCache } from '@/storage/family-wardrobe-snapshot-cache';
import { clearFamilyWearHistorySnapshotCache } from '@/storage/family-wear-history-snapshot-cache';
import { clearSavedPairedOutfitsSnapshotCache } from '@/storage/saved-paired-outfits-snapshot-cache';
import { clearPairedOutfitResultCache } from '@/utils/paired-outfit-result-cache';

export function clearAccountRuntimeCaches(): void {
  clearFamilyWearHistorySnapshotCache();
  clearFamilyWardrobeSnapshotCache();
  clearFamilyOutfitsSnapshotCache();
  clearSavedPairedOutfitsSnapshotCache();
  clearPairedOutfitResultCache();

  if (__DEV__) {
    console.log('[ACCOUNT CACHE] runtime cleared');
  }
}
