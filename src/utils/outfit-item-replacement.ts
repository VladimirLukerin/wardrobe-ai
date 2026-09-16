import type { WardrobeItem } from '@/contexts/wardrobe-context';
import { getOutfitCategoryGroup } from '@/utils/wardrobe-category-groups';

// Accessories are stored under one broad category; use the garment name for its role.
export function getOutfitItemRole(item: WardrobeItem): string {
  const name = `${item.category} ${item.baseName} ${item.name}`.toLowerCase();
  if (/(шапк|шляп|кепк|панам|берет|бейсболк|головной убор)/.test(name)) return 'HEAD';
  if (/(шарф|платок|снуд)/.test(name)) return 'NECK';
  if (/(сумк|рюкзак|клатч)/.test(name)) return 'BAG';
  if (/(ремень|пояс)/.test(name)) return 'BELT';
  const group = getOutfitCategoryGroup(item.category);
  return group === 'OTHER' || group === 'ACCESSORY'
    ? `${group}:${item.category.trim().toLowerCase()}:${item.baseName.trim().toLowerCase()}`
    : group;
}

export function sortOutfitItems(items: WardrobeItem[]): WardrobeItem[] {
  const order: Record<string, number> = { HEAD: 0, NECK: 1, OUTERWEAR: 2, TOP: 3, BELT: 4, BOTTOM: 5, BAG: 6, SHOES: 8 };
  return [...items].sort((a, b) => (order[getOutfitItemRole(a)] ?? 7) - (order[getOutfitItemRole(b)] ?? 7));
}

export function getReplacementCandidates(items: WardrobeItem[], itemIds: string[], targetId: string): WardrobeItem[] {
  const target = items.find((item) => item.id === targetId);
  if (!target || !itemIds.includes(targetId)) return [];
  return items.filter((item) => !itemIds.includes(item.id) && getOutfitItemRole(item) === getOutfitItemRole(target));
}

export function replaceOutfitItem(itemIds: string[], targetId: string, replacementId: string, wardrobe: WardrobeItem[]): string[] | null {
  if (!getReplacementCandidates(wardrobe, itemIds, targetId).some((item) => item.id === replacementId)) return null;
  return itemIds.map((id) => id === targetId ? replacementId : id);
}
