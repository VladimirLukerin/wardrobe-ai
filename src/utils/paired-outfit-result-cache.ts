import type { PairedMatchingMode } from '@/constants/paired-outfit';
import type { PairedOutfitResult } from '@/services/paired-outfits';

export type PairedOutfitResultCache = {
  result: PairedOutfitResult;
  occasion: string;
  matchingMode: PairedMatchingMode;
  memberPublicId: string;
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
