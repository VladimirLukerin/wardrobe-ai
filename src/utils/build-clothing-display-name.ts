export type BuildClothingDisplayNameInput = {
  baseName: string;
  color: string;
  pattern: string;
  printDescription: string | null;
};

type Gender = 'm' | 'f' | 'n' | 'pl';

const BASE_NAME_GENDER: Record<string, Gender> = {
  Футболка: 'f',
  Рубашка: 'f',
  Куртка: 'f',
  Обувь: 'f',
  Шорты: 'pl',
  Брюки: 'pl',
  Джинсы: 'pl',
  Свитер: 'm',
  Худи: 'n',
  Аксессуар: 'm',
  Другое: 'n',
};

const COLOR_FORMS: Partial<Record<string, Record<Gender, string>>> = {
  Чёрный: { m: 'Чёрный', f: 'Чёрная', n: 'Чёрное', pl: 'Чёрные' },
  Белый: { m: 'Белый', f: 'Белая', n: 'Белое', pl: 'Белые' },
  Серый: { m: 'Серый', f: 'Серая', n: 'Серое', pl: 'Серые' },
  Синий: { m: 'Синий', f: 'Синяя', n: 'Синее', pl: 'Синие' },
  Голубой: { m: 'Голубой', f: 'Голубая', n: 'Голубое', pl: 'Голубые' },
  Зелёный: { m: 'Зелёный', f: 'Зелёная', n: 'Зелёное', pl: 'Зелёные' },
  Красный: { m: 'Красный', f: 'Красная', n: 'Красное', pl: 'Красные' },
  Бежевый: { m: 'Бежевый', f: 'Бежевая', n: 'Бежевое', pl: 'Бежевые' },
  Коричневый: { m: 'Коричневый', f: 'Коричневая', n: 'Коричневое', pl: 'Коричневые' },
  Жёлтый: { m: 'Жёлтый', f: 'Жёлтая', n: 'Жёлтое', pl: 'Жёлтые' },
};

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function shouldIncludeColor(color: string): boolean {
  return color !== 'Не определён' && color !== 'Другой';
}

function getBaseNameGender(baseName: string): Gender {
  return BASE_NAME_GENDER[baseName] ?? 'f';
}

function getColorForm(color: string, gender: Gender): string {
  return COLOR_FORMS[color]?.[gender] ?? color;
}

function getPatternPhrase(pattern: string, printDescription: string | null): string | null {
  const description = printDescription ? normalizeText(printDescription) : null;
  const lowerDescription = description?.toLowerCase() ?? '';

  if (pattern === 'Без принта') {
    return null;
  }

  if (pattern === 'Принт') {
    if (!description) {
      return null;
    }

    if (lowerDescription.includes('логотип')) {
      return lowerDescription === 'логотип' ? 'с логотипом' : `с ${description}`;
    }

    return `с принтом ${description}`;
  }

  if (pattern === 'Полоска') {
    if (lowerDescription.includes('вертикаль')) {
      return 'в вертикальную полоску';
    }

    if (lowerDescription.includes('горизонталь')) {
      return 'в горизонтальную полоску';
    }

    return description ? `в ${description}` : 'в полоску';
  }

  if (pattern === 'Клетка') {
    return description ? `в ${description}` : 'в клетку';
  }

  if (pattern === 'Горошек') {
    return description ? `в ${description}` : 'в горошек';
  }

  if (pattern === 'Камуфляж') {
    return description ? `с ${description}` : 'с камуфляжным принтом';
  }

  if (pattern === 'Градиент') {
    return description ? `с ${description}` : 'с градиентом';
  }

  if (description) {
    return `с ${description}`;
  }

  return null;
}

export function buildClothingDisplayName({
  baseName,
  color,
  pattern,
  printDescription,
}: BuildClothingDisplayNameInput): string {
  const normalizedBaseName = normalizeText(baseName);

  if (!normalizedBaseName) {
    return '';
  }

  const gender = getBaseNameGender(normalizedBaseName);
  const parts: string[] = [];

  if (shouldIncludeColor(color)) {
    parts.push(getColorForm(color, gender));
  }

  parts.push(normalizedBaseName);

  const patternPhrase = getPatternPhrase(pattern, printDescription);

  if (patternPhrase) {
    parts.push(patternPhrase);
  }

  return parts.join(' ');
}
