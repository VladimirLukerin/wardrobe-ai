import type { WardrobeItem } from '@/contexts/wardrobe-context';
import { matchesWardrobeFilter, type WardrobeFilterId } from '@/utils/wardrobe-category-groups';
export type WardrobeFilters = { query: string; category: WardrobeFilterId; color: string | null };
export const EMPTY_WARDROBE_FILTERS: WardrobeFilters = { query: '', category: 'all', color: null };
export function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase('ru').replace(/ё/g, 'е').trim();
}
export function filterWardrobe(items: WardrobeItem[], filters: WardrobeFilters, favoritesOnly: boolean): WardrobeItem[] {
  const terms = normalizeSearch(filters.query).split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (favoritesOnly && !item.isFavorite) return false;
    if (!matchesWardrobeFilter(item.category, filters.category)) return false;
    if (filters.color && normalizeSearch(item.color) !== normalizeSearch(filters.color)) return false;
    const text = normalizeSearch(`${item.name} ${item.baseName} ${item.category} ${item.color}`);
    return terms.every((term) => text.includes(term));
  });
}
export function countWardrobeFilters(filters: WardrobeFilters): number {
  return Number(!!filters.query.trim()) + Number(filters.category !== 'all') + Number(filters.color !== null);
}
