import type { SavedOutfit, SavedOutfitSource } from '@/constants/saved-outfit';

export const LOCAL_OUTFIT_FEED_LIMIT = 5;

export type OutfitFeedEntry = {
  id: string;
  title: string;
  itemIds: string[];
  sourceLabel: string;
  createdAt: string;
};

export function getOutfitSourceLabel(source?: SavedOutfitSource): string {
  return source === 'manual' ? 'Собрано вручную' : 'Подобрано AI';
}

function getSourceSortPriority(source?: SavedOutfitSource): number {
  return source === 'manual' ? 0 : 1;
}

export function buildLocalOutfitFeed(savedOutfits: SavedOutfit[]): OutfitFeedEntry[] {
  return [...savedOutfits]
    .sort((left, right) => {
      const priorityDifference =
        getSourceSortPriority(left.source) - getSourceSortPriority(right.source);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    })
    .slice(0, LOCAL_OUTFIT_FEED_LIMIT)
    .map((outfit) => ({
      id: outfit.id,
      title: outfit.title,
      itemIds: outfit.itemIds,
      sourceLabel: getOutfitSourceLabel(outfit.source),
      createdAt: outfit.createdAt,
    }));
}
