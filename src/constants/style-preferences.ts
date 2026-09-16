export const STYLE_PREFERENCE_OPTIONS = [
  'Casual',
  'Streetwear',
  'Minimal',
  'Sport',
  'Classic',
  'Business',
  'Smart Casual',
  'Vintage',
] as const;

export const COLOR_PREFERENCE_OPTIONS = [
  'Чёрный',
  'Белый',
  'Серый',
  'Синий',
  'Голубой',
  'Зелёный',
  'Красный',
  'Бежевый',
  'Коричневый',
] as const;

export type StylePreference = (typeof STYLE_PREFERENCE_OPTIONS)[number];
export type ColorPreference = (typeof COLOR_PREFERENCE_OPTIONS)[number];

export type StylePreferences = {
  styles: StylePreference[];
  colors: ColorPreference[];
};
