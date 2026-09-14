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

export const MOCK_WARDROBE_DEFAULTS = {
  name: 'Новая вещь',
  category: 'Другое',
  color: 'Не определён',
  style: 'Повседневный',
} as const;
