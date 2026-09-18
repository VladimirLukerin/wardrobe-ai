import type { PairedMatchingMode } from '@/constants/paired-outfit';
import type { PairedOutfitResult } from '@/services/paired-outfits';
import type { FixedItemOwner } from '@/utils/paired-outfit-route';

export type PairedOutfitResultCache = {
  result: PairedOutfitResult;
  occasion: string;
  matchingMode: PairedMatchingMode;
  memberPublicId: string;
  fixedItemId?: string;
  fixedItemOwner?: FixedItemOwner;
};

let cachedPairedOutfit: PairedOutfitResultCache | null = null;

export function setPairedOutfitResultCache(entry: PairedOutfitResultCache): void {
  cachedPairedOutfit = entry;
}

export function peekPairedOutfitResultCache(): PairedOutfitResultCache | null {
  return cachedPairedOutfit;
}

export function clearPairedOutfitResultCache(): void {
  cachedPairedOutfit = null;
}
