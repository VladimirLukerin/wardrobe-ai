import { describeOutfitItems } from '@/utils/outfit-description';
import type { SavedOutfit } from '@/constants/saved-outfit';
import type { WardrobeItem } from '@/contexts/wardrobe-context';
import { replaceOutfitItem } from '@/utils/outfit-item-replacement';

export function replaceSavedOutfitItem(
  outfits: SavedOutfit[], outfitId: string, targetId: string, replacementId: string, wardrobe: WardrobeItem[],
): SavedOutfit[] {
  const outfit = outfits.find((entry) => entry.id === outfitId);
  if (!outfit) return outfits;
  const itemIds = replaceOutfitItem(outfit.itemIds, targetId, replacementId, wardrobe);
  if (!itemIds) return outfits;
  // Preserve identity and creation date. Wear events hold their own item snapshots.
  // Rebuild the description from the new composition.
  return outfits.map((entry) => entry.id === outfitId
    ? { ...entry, itemIds, description: describeOutfitItems(wardrobe.filter((item) => itemIds.includes(item.id))), source: 'manual' }
    : entry);
}
