export type FixedItemOwner = 'self' | 'member';

export type PairedOutfitRouteParams = {
  publicId: string;
  fixedItemId?: string;
  fixedItemOwner?: FixedItemOwner;
  occasionId?: string;
  customOccasion?: string;
  matchingMode?: string;
  occasion?: string;
};

export function parseFixedItemOwner(value: unknown): FixedItemOwner | undefined {
  if (value === 'self' || value === 'member') {
    return value;
  }

  return undefined;
}

export function buildPairedOutfitEntryParams(input: {
  memberPublicId: string;
  fixedItemId?: string;
  fixedItemOwner?: FixedItemOwner;
}): PairedOutfitRouteParams {
  return {
    publicId: input.memberPublicId,
    ...(input.fixedItemId ? { fixedItemId: input.fixedItemId } : {}),
    ...(input.fixedItemOwner ? { fixedItemOwner: input.fixedItemOwner } : {}),
  };
}

export function buildPairedOutfitMatchingParams(input: {
  memberPublicId: string;
  occasionId: string;
  customOccasion?: string;
  fixedItemId?: string;
  fixedItemOwner?: FixedItemOwner;
}): PairedOutfitRouteParams {
  return {
    publicId: input.memberPublicId,
    occasionId: input.occasionId,
    customOccasion: input.customOccasion ?? '',
    ...(input.fixedItemId ? { fixedItemId: input.fixedItemId } : {}),
    ...(input.fixedItemOwner ? { fixedItemOwner: input.fixedItemOwner } : {}),
  };
}

export function buildPairedOutfitResultParams(input: {
  memberPublicId: string;
  occasion: string;
  matchingMode: string;
  fixedItemId?: string;
  fixedItemOwner?: FixedItemOwner;
}): PairedOutfitRouteParams {
  return {
    publicId: input.memberPublicId,
    occasion: input.occasion,
    matchingMode: input.matchingMode,
    ...(input.fixedItemId ? { fixedItemId: input.fixedItemId } : {}),
    ...(input.fixedItemOwner ? { fixedItemOwner: input.fixedItemOwner } : {}),
  };
}
