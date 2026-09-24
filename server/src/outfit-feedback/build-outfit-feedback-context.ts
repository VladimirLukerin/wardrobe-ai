import {
  getRecentOutfitFeedback,
  type OutfitFeedbackResponse,
} from '../db/outfit-feedback-repository';
import type { OutfitFeedbackReason } from '../db/outfit-feedback-reasons';
import type { CompactOutfitRef, OutfitFeedbackContextPayload } from '../suggest-outfits';

const MAX_ITEM_IDS = 12;
const MAX_COMBINATIONS = 8;

function filterToWardrobe(itemIds: string[], wardrobeIds: Set<string>): string[] {
  return itemIds.filter((itemId) => wardrobeIds.has(itemId));
}

function toCompactCombination(itemIds: string[]): CompactOutfitRef | null {
  if (itemIds.length < 2) {
    return null;
  }

  return { itemIds };
}

function pushUnique(target: string[], itemId: string, max: number): void {
  if (target.includes(itemId) || target.length >= max) {
    return;
  }

  target.push(itemId);
}

function pushCombination(
  target: CompactOutfitRef[],
  itemIds: string[],
  max: number,
): void {
  const compact = toCompactCombination(itemIds);

  if (!compact) {
    return;
  }

  const signature = [...compact.itemIds].sort().join('|');

  if (target.some((entry) => [...entry.itemIds].sort().join('|') === signature)) {
    return;
  }

  if (target.length >= max) {
    return;
  }

  target.push(compact);
}

function aggregateFeedback(
  entries: OutfitFeedbackResponse[],
  wardrobeIds: Set<string>,
): OutfitFeedbackContextPayload {
  const recentlyLikedItemIds: string[] = [];
  const recentlyDislikedItemIds: string[] = [];
  const likedCombinations: CompactOutfitRef[] = [];
  const dislikedCombinations: CompactOutfitRef[] = [];
  const stronglyDislikedItemIds: string[] = [];
  const reasonCounts: Partial<Record<OutfitFeedbackReason, number>> = {};

  for (const entry of entries) {
    const itemIds = filterToWardrobe(entry.itemIds, wardrobeIds);

    if (itemIds.length < 2) {
      continue;
    }

    if (entry.rating === 'like') {
      for (const itemId of itemIds) {
        pushUnique(recentlyLikedItemIds, itemId, MAX_ITEM_IDS);
      }

      pushCombination(likedCombinations, itemIds, MAX_COMBINATIONS);
      continue;
    }

    if (entry.reason) {
      reasonCounts[entry.reason] = (reasonCounts[entry.reason] ?? 0) + 1;
    }

    if (entry.reason === 'combination_disliked') {
      pushCombination(dislikedCombinations, itemIds, MAX_COMBINATIONS);
      continue;
    }

    if (entry.reason === 'item_disliked') {
      if (entry.targetItemId && wardrobeIds.has(entry.targetItemId)) {
        pushUnique(stronglyDislikedItemIds, entry.targetItemId, MAX_ITEM_IDS);
      }

      continue;
    }

    if (
      entry.reason === 'too_familiar' ||
      entry.reason === 'too_unusual' ||
      entry.reason === 'weather_mismatch'
    ) {
      continue;
    }

    if (entry.reason === 'other' || entry.reason === null) {
      pushCombination(dislikedCombinations, itemIds, MAX_COMBINATIONS);
    }
  }

  return {
    recentlyLikedItemIds,
    recentlyDislikedItemIds,
    likedCombinations,
    dislikedCombinations,
    stronglyDislikedItemIds,
    reasonCounts,
  };
}

export function buildOutfitFeedbackContext(
  userId: string,
  wardrobeIds: Set<string>,
): OutfitFeedbackContextPayload {
  const entries = getRecentOutfitFeedback(userId);
  const context = aggregateFeedback(entries, wardrobeIds);

  if (process.env.NODE_ENV !== 'production') {
    const likes = entries.filter((entry) => entry.rating === 'like').length;
    const dislikes = entries.filter((entry) => entry.rating === 'dislike').length;
    console.log(`[STYLIST FEEDBACK] likes=${likes} dislikes=${dislikes}`);
  }

  return context;
}

export function mergeOutfitFeedbackIntoBehavioralContext<T extends { outfitFeedback?: OutfitFeedbackContextPayload }>(
  behavioralContext: T,
  userId: string,
  wardrobeIds: Set<string>,
): T & { outfitFeedback: OutfitFeedbackContextPayload } {
  return {
    ...behavioralContext,
    outfitFeedback: buildOutfitFeedbackContext(userId, wardrobeIds),
  };
}
