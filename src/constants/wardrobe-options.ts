export const WARDROBE_CATEGORIES = [
  'Футболка',
  'Рубашка',
  'Худи',
  'Свитер',
  'Куртка',
  'Брюки',
  'Джинсы',
  'Шорты',
  'Обувь',
  'Аксессуар',
  'Другое',
] as const;

export const WARDROBE_COLORS = [
  'Чёрный',
  'Белый',
  'Серый',
  'Синий',
  'Голубой',
  'Зелёный',
  'Красный',
  'Бежевый',
  'Коричневый',
  'Жёлтый',
  'Другой',
  'Не определён',
] as const;

export const WARDROBE_STYLES = [
  'Повседневный',
  'Деловой',
  'Спортивный',
  'Вечерний',
  'Универсальный',
] as const;

export const WARDROBE_PATTERNS = [
  'Без принта',
  'Принт',
  'Полоска',
  'Клетка',
  'Горошек',
  'Камуфляж',
  'Градиент',
  'Другое',
] as const;

export type WardrobePattern = (typeof WARDROBE_PATTERNS)[number];

export const MOCK_WARDROBE_DEFAULTS = {
  name: 'Новая вещь',
  baseName: 'Вещь',
  category: 'Другое',
  color: 'Не определён',
  pattern: 'Без принта' as WardrobePattern,
  printDescription: null as string | null,
  style: 'Повседневный',
} as const;
