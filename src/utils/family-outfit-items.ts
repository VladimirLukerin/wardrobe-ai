import type { FamilyWardrobeItem } from '@/services/family-api';

export function resolveFamilyOutfitItems(
  itemIds: string[],
  wardrobeItems: FamilyWardrobeItem[],
): FamilyWardrobeItem[] {
  const wardrobeById = new Map(wardrobeItems.map((item) => [item.id, item]));

  return itemIds
    .map((itemId) => wardrobeById.get(itemId))
    .filter((item): item is FamilyWardrobeItem => item !== undefined);
}

export function getFamilyOutfitDescription(
  description: string,
  items: FamilyWardrobeItem[],
): string {
  const trimmedDescription = description.trim();

  if (trimmedDescription.length > 0) {
    return trimmedDescription;
  }

  const names = items
    .map((item) => item.baseName.trim() || item.name.trim())
    .filter((name) => name.length > 0);

  if (names.length === 0) {
    return '';
  }

  return names.join(', ');
}
