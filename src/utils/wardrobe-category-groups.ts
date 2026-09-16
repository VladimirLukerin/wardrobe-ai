import type { WardrobeItem } from '@/contexts/wardrobe-context';

export type OutfitCategoryGroup = 'BOTTOM' | 'TOP' | 'OUTERWEAR' | 'SHOES' | 'ACCESSORY' | 'OTHER';

export type WardrobeFilterId = 'all' | 'top' | 'bottom' | 'shoes' | 'outerwear' | 'accessories';

export const WARDROBE_FILTER_OPTIONS: { id: WardrobeFilterId; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'top', label: 'Верх' },
  { id: 'bottom', label: 'Низ' },
  { id: 'shoes', label: 'Обувь' },
  { id: 'outerwear', label: 'Верхний слой' },
  { id: 'accessories', label: 'Аксессуары' },
];

export const MAX_MANUAL_OUTFIT_ITEMS = 6;

const BOTTOM_CATEGORIES = new Set([
  'брюки',
  'штаны',
  'джинсы',
  'шорты',
  'юбка',
  'леггинсы',
]);

const TOP_CATEGORIES = new Set([
  'футболка',
  'майка',
  'рубашка',
  'блузка',
  'свитер',
  'худи',
  'толстовка',
  'свитшот',
]);

const OUTERWEAR_CATEGORIES = new Set(['куртка', 'пальто', 'плащ', 'пуховик', 'ветровка']);

const SHOES_CATEGORIES = new Set([
  'обувь',
  'кроссовки',
  'кеды',
  'ботинки',
  'туфли',
  'сандалии',
  'сапоги',
]);

const ACCESSORY_CATEGORIES = new Set(['аксессуар']);

const FILTER_TO_GROUP: Record<Exclude<WardrobeFilterId, 'all'>, OutfitCategoryGroup> = {
  top: 'TOP',
  bottom: 'BOTTOM',
  shoes: 'SHOES',
  outerwear: 'OUTERWEAR',
  accessories: 'ACCESSORY',
};

function normalizeCategory(category: string): string {
  return category.trim().toLowerCase();
}

export function getOutfitCategoryGroup(category: string): OutfitCategoryGroup {
  const normalized = normalizeCategory(category);

  if (BOTTOM_CATEGORIES.has(normalized)) {
    return 'BOTTOM';
  }

  if (SHOES_CATEGORIES.has(normalized)) {
    return 'SHOES';
  }

  if (OUTERWEAR_CATEGORIES.has(normalized)) {
    return 'OUTERWEAR';
  }

  if (TOP_CATEGORIES.has(normalized)) {
    return 'TOP';
  }

  if (ACCESSORY_CATEGORIES.has(normalized)) {
    return 'ACCESSORY';
  }

  return 'OTHER';
}

export function matchesWardrobeFilter(category: string, filter: WardrobeFilterId): boolean {
  if (filter === 'all') {
    return true;
  }

  return getOutfitCategoryGroup(category) === FILTER_TO_GROUP[filter];
}

function getGroupLimit(group: OutfitCategoryGroup): number | null {
  switch (group) {
    case 'BOTTOM':
    case 'SHOES':
    case 'OUTERWEAR':
      return 1;
    case 'TOP':
      return 2;
    default:
      return null;
  }
}

function getSelectedIdsInGroup(
  selectedIds: string[],
  itemsById: Map<string, WardrobeItem>,
  group: OutfitCategoryGroup,
): string[] {
  return selectedIds.filter((itemId) => {
    const item = itemsById.get(itemId);

    return item !== undefined && getOutfitCategoryGroup(item.category) === group;
  });
}

export function applyOutfitItemToggle(
  selectedIds: string[],
  itemId: string,
  itemsById: Map<string, WardrobeItem>,
  maxItems: number = MAX_MANUAL_OUTFIT_ITEMS,
): string[] {
  if (selectedIds.includes(itemId)) {
    return selectedIds.filter((id) => id !== itemId);
  }

  const item = itemsById.get(itemId);

  if (!item) {
    return selectedIds;
  }

  let nextIds = [...selectedIds];
  const group = getOutfitCategoryGroup(item.category);
  const limit = getGroupLimit(group);

  if (limit !== null) {
    const sameGroupIds = getSelectedIdsInGroup(nextIds, itemsById, group);

    if (limit === 1) {
      nextIds = nextIds.filter((id) => !sameGroupIds.includes(id));
    } else {
      while (getSelectedIdsInGroup(nextIds, itemsById, group).length >= limit) {
        const oldestInGroup = sameGroupIds.find((id) => nextIds.includes(id));

        if (!oldestInGroup) {
          break;
        }

        nextIds = nextIds.filter((id) => id !== oldestInGroup);
      }
    }
  }

  if (nextIds.length >= maxItems) {
    return selectedIds;
  }

  return [...nextIds, itemId];
}
