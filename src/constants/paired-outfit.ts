export const PAIRED_MATCHING_MODES = ['natural', 'same_style', 'colors', 'photo'] as const;

export type PairedMatchingMode = (typeof PAIRED_MATCHING_MODES)[number];

export type PairedOccasionOption = {
  id: string;
  label: string;
};

export const PAIRED_OCCASION_OPTIONS: PairedOccasionOption[] = [
  { id: 'date', label: 'Свидание' },
  { id: 'restaurant', label: 'Ресторан' },
  { id: 'walk', label: 'Прогулка' },
  { id: 'party', label: 'Вечеринка' },
  { id: 'event', label: 'Мероприятие' },
  { id: 'photoshoot', label: 'Фотосессия' },
  { id: 'other', label: 'Другое' },
];

export const PAIRED_MATCHING_MODE_OPTIONS: Array<{
  id: PairedMatchingMode;
  label: string;
  description: string;
}> = [
  {
    id: 'natural',
    label: 'Естественно',
    description: 'Образы сочетаются, но не выглядят одинаково',
  },
  {
    id: 'same_style',
    label: 'В одном стиле',
    description: 'Общий стиль у обоих образов',
  },
  {
    id: 'colors',
    label: 'По цветам',
    description: 'Гармония цветов между образами',
  },
  {
    id: 'photo',
    label: 'Для фото',
    description: 'Как образы выглядят рядом на фото',
  },
];

export const DEFAULT_PAIRED_MATCHING_MODE: PairedMatchingMode = 'natural';

export function resolvePairedOccasionLabel(
  occasionId: string,
  customOccasion?: string,
): string {
  if (occasionId === 'other') {
    return customOccasion?.trim() || 'Другое';
  }

  return PAIRED_OCCASION_OPTIONS.find((option) => option.id === occasionId)?.label ?? occasionId;
}
