import type { WardrobeItem } from '@/contexts/wardrobe-context';
import { sortOutfitItems } from '@/utils/outfit-item-replacement';

export const MAX_OUTFIT_DESCRIPTION_LENGTH = 140;

export function shortenOutfitDescription(description: string): string {
  const text = description.replace(/\s+/g, ' ').trim();
  const sentence = text.match(/^.*?[.!?](?:\s|$)/)?.[0].trim() ?? text;
  if (sentence.length <= MAX_OUTFIT_DESCRIPTION_LENGTH) return sentence;
  const fragment = sentence.slice(0, MAX_OUTFIT_DESCRIPTION_LENGTH - 1);
  const boundary = fragment.lastIndexOf(' ');
  return `${fragment.slice(0, boundary > 60 ? boundary : fragment.length).replace(/[ ,;:—-]+$/, '')}…`;
}

export function describeOutfitItems(items: WardrobeItem[]): string {
  if (!items.length) return 'Состав образа пока недоступен.';
  const names = [...new Set(sortOutfitItems(items).map((item) => (item.baseName || item.category).trim().toLocaleLowerCase('ru')).filter(Boolean))];
  if (!names.length) return 'Образ из выбранных вещей.';
  const shown = names.slice(0, 3);
  const joined = shown.length > 1 ? `${shown.slice(0, -1).join(', ')} и ${shown[shown.length - 1]}` : shown[0];
  return shortenOutfitDescription(`В основе образа — ${joined}${names.length > 3 ? ' с дополнительными деталями' : ''}.`);
}

export function getOutfitDescription(description: string, items: WardrobeItem[], source?: 'ai' | 'manual'): string {
  // Describe manual/edited outfits from their actual contents; never reuse obsolete AI advice.
  return source === 'manual' || !description.trim()
    ? describeOutfitItems(items)
    : shortenOutfitDescription(description);
}
