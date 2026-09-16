import type { WardrobeItem } from '@/contexts/wardrobe-context';

export function resolveWardrobeItemsFromIds(
  itemIds: string[],
  wardrobeById: Map<string, WardrobeItem>,
): WardrobeItem[] {
  return itemIds
    .map((itemId) => wardrobeById.get(itemId))
    .filter((item): item is WardrobeItem => item !== undefined);
}
