import type { Request, Response } from 'express';
import OpenAI from 'openai';

import { getCurrentWeather, type CurrentWeather } from './providers/weather';
import { getWeatherCodeLabel } from './weather-code';

const MODEL = 'gpt-4o';
const MAX_OUTFITS = 3;
const STYLE_EXPERIMENTS = ['familiar', 'balanced', 'bold'] as const;

type StyleExperiment = (typeof STYLE_EXPERIMENTS)[number];
const DEFAULT_STYLE_EXPERIMENT: StyleExperiment = 'balanced';

const WEATHER_SENSITIVITIES = ['Часто мёрзну', 'Обычно', 'Мне часто жарко'] as const;

type WeatherSensitivity = (typeof WEATHER_SENSITIVITIES)[number];

export type SuggestOutfitsLocation = {
  latitude: number;
  longitude: number;
  name?: string;
};

export type { CurrentWeather };

export type WardrobeItemPayload = {
  id: string;
  name: string;
  category: string;
  color: string;
  pattern: string;
  printDescription: string | null;
  style: string;
};

export type SuggestOutfitsRequestBody = {
  selectedItemId?: string;
  wardrobe: WardrobeItemPayload[];
  styleExperiment: StyleExperiment;
  considerWeather: boolean;
  location: SuggestOutfitsLocation | null;
  weatherSensitivity: WeatherSensitivity | null;
};

export type OutfitSuggestion = {
  id: string;
  title: string;
  itemIds: string[];
  description: string;
};

type RawOutfitSuggestion = {
  id?: string;
  title?: string;
  itemIds?: string[];
  description?: string;
};

type RawOutfitsResponse = {
  outfits?: RawOutfitSuggestion[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseStyleExperiment(value: unknown): StyleExperiment {
  if (
    typeof value === 'string' &&
    STYLE_EXPERIMENTS.includes(value as StyleExperiment)
  ) {
    return value as StyleExperiment;
  }

  return DEFAULT_STYLE_EXPERIMENT;
}

function parseWeatherSensitivity(value: unknown): WeatherSensitivity | null {
  if (
    typeof value === 'string' &&
    WEATHER_SENSITIVITIES.includes(value as WeatherSensitivity)
  ) {
    return value as WeatherSensitivity;
  }

  return null;
}

function parseLocation(value: unknown): SuggestOutfitsLocation | null {
  if (!isRecord(value)) {
    return null;
  }

  const latitude = value.latitude;
  const longitude = value.longitude;

  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
    name: typeof value.name === 'string' && value.name.trim().length > 0 ? value.name.trim() : undefined,
  };
}

function parseRequestBody(body: unknown): SuggestOutfitsRequestBody | null {
  if (!isRecord(body)) {
    return null;
  }

  const wardrobe = body.wardrobe;
  const rawSelectedItemId = body.selectedItemId;
  const selectedItemId =
    typeof rawSelectedItemId === 'string' && rawSelectedItemId.trim().length > 0
      ? rawSelectedItemId.trim()
      : undefined;

  if (!Array.isArray(wardrobe) || wardrobe.length === 0) {
    return null;
  }

  const parsedWardrobe: WardrobeItemPayload[] = [];

  for (const entry of wardrobe) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || entry.id.trim().length === 0) {
      continue;
    }

    parsedWardrobe.push({
      id: entry.id,
      name: typeof entry.name === 'string' ? entry.name : '',
      category: typeof entry.category === 'string' ? entry.category : '',
      color: typeof entry.color === 'string' ? entry.color : '',
      pattern: typeof entry.pattern === 'string' ? entry.pattern : '',
      printDescription:
        typeof entry.printDescription === 'string'
          ? entry.printDescription
          : entry.printDescription === null
            ? null
            : null,
      style: typeof entry.style === 'string' ? entry.style : '',
    });
  }

  if (parsedWardrobe.length === 0) {
    return null;
  }

  return {
    selectedItemId,
    wardrobe: parsedWardrobe,
    styleExperiment: parseStyleExperiment(body.styleExperiment),
    considerWeather: body.considerWeather === true,
    location: parseLocation(body.location),
    weatherSensitivity: parseWeatherSensitivity(body.weatherSensitivity),
  };
}

function buildWeatherSensitivityInstructions(
  weatherSensitivity: WeatherSensitivity,
): string[] {
  switch (weatherSensitivity) {
    case 'Часто мёрзну':
      return [
        'Чувствительность к погоде: пользователь часто мёрзнет.',
        'Склоняйся к немного более тёплым вариантам из доступного wardrobe при той же погоде, если это возможно без выдуманных вещей.',
      ];
    case 'Мне часто жарко':
      return [
        'Чувствительность к погоде: пользователю часто жарко.',
        'Предпочитай немного более лёгкие варианты из доступного wardrobe, если это разумно и безопасно по погоде.',
      ];
    case 'Обычно':
    default:
      return [
        'Чувствительность к погоде: обычная.',
        'Не добавляй дополнительную температурную коррекцию сверх фактической погоды.',
      ];
  }
}

function buildWeatherPromptLines(weather: CurrentWeather): string[] {
  const conditions = getWeatherCodeLabel(weather.weatherCode);

  return [
    'ТЕКУЩАЯ ПОГОДА (учитывай при выборе вещей ТОЛЬКО из wardrobe):',
    `- температура: ${weather.temperatureC}°C`,
    `- ощущается как: ${weather.apparentTemperatureC}°C`,
    `- осадки: ${weather.precipitationMm} мм`,
    `- ветер: ${weather.windSpeedKmh} км/ч`,
    `- условия: ${conditions}`,
    'Используй temperature и apparent temperature вместе.',
    'При сильном ветре и осадках учитывай это, если в wardrobe есть подходящие вещи.',
    'Не придумывай отсутствующую одежду и itemIds.',
    'Если нужной вещи нет в wardrobe, собери лучший доступный вариант и при необходимости упомяни в description, что комплект ограничен текущим гардеробом.',
  ];
}

async function resolveWeatherContext(
  considerWeather: boolean,
  location: SuggestOutfitsLocation | null,
): Promise<CurrentWeather | null> {
  if (!considerWeather || !location) {
    return null;
  }

  try {
    return await getCurrentWeather({
      latitude: location.latitude,
      longitude: location.longitude,
    });
  } catch (error) {
    console.error('Failed to fetch weather for outfit suggestions:', error);
    return null;
  }
}

function getDiversityPriority(styleExperiment: StyleExperiment): 'low' | 'medium' | 'high' {
  switch (styleExperiment) {
    case 'familiar':
      return 'low';
    case 'bold':
      return 'high';
    case 'balanced':
    default:
      return 'medium';
  }
}

type CategoryGroup = 'BOTTOM' | 'TOP' | 'OUTERWEAR' | 'SHOES' | 'OTHER';

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

const EXCLUSIVE_SINGLE_GROUPS: CategoryGroup[] = ['BOTTOM', 'SHOES', 'OUTERWEAR'];
const TOP_LAYERING_MAX = 2;

function normalizeCategory(category: string): string {
  return category.trim().toLowerCase();
}

function getCategoryGroup(category: string): CategoryGroup {
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

  return 'OTHER';
}

function pickItemsForCategoryGroup(
  itemIds: string[],
  wardrobeById: Map<string, WardrobeItemPayload>,
  selectedItemId: string | undefined,
  group: CategoryGroup,
  maxCount: number,
): Set<string> {
  const inGroup = itemIds.filter((itemId) => {
    const item = wardrobeById.get(itemId);

    return item !== undefined && getCategoryGroup(item.category) === group;
  });

  if (inGroup.length <= maxCount) {
    return new Set(inGroup);
  }

  const kept: string[] = [];

  if (selectedItemId && inGroup.includes(selectedItemId)) {
    kept.push(selectedItemId);
  }

  for (const itemId of inGroup) {
    if (kept.length >= maxCount) {
      break;
    }

    if (!kept.includes(itemId)) {
      kept.push(itemId);
    }
  }

  return new Set(kept);
}

export function sanitizeItemIdsByCategory(
  itemIds: string[],
  wardrobeById: Map<string, WardrobeItemPayload>,
  selectedItemId?: string,
): string[] {
  const orderedUnique = [...new Set(itemIds)];
  const allowed = new Set<string>();

  if (selectedItemId) {
    allowed.add(selectedItemId);
  }

  for (const group of EXCLUSIVE_SINGLE_GROUPS) {
    const kept = pickItemsForCategoryGroup(
      orderedUnique,
      wardrobeById,
      selectedItemId,
      group,
      1,
    );

    kept.forEach((itemId) => allowed.add(itemId));
  }

  const topKept = pickItemsForCategoryGroup(
    orderedUnique,
    wardrobeById,
    selectedItemId,
    'TOP',
    TOP_LAYERING_MAX,
  );

  topKept.forEach((itemId) => allowed.add(itemId));

  for (const itemId of orderedUnique) {
    const item = wardrobeById.get(itemId);

    if (item && getCategoryGroup(item.category) === 'OTHER') {
      allowed.add(itemId);
    }
  }

  return orderedUnique.filter((itemId) => allowed.has(itemId));
}

function buildSharedSelectionRules(): string[] {
  return [
    'ОБЩИЕ ПРАВИЛА ВЫБОРА:',
    '- Используй ТОЛЬКО id из wardrobe. Не придумывай вещи.',
    '- Никогда не включай одновременно брюки и шорты, две пары брюк, две пары обуви и другие взаимоисключающие предметы одной функциональной категории.',
    '- Максимум 1 нижняя часть (брюки/джинсы/шорты), максимум 1 обувь, верхний слой может включать layering (например топ + свитер) плюс верхняя одежда.',
    '- Если существует несколько валидных сочетаний, не выбирай один и тот же набор вещей для разных stylist modes без необходимости.',
    '- Не жертвуй логикой образа только ради различия.',
    '',
    'РАЗНООБРАЗИЕ ВНУТРИ ОДНОГО ОТВЕТА (до 3 outfits):',
    '- Каждый следующий outfit должен отличаться от предыдущих.',
    '- Для каждого следующего outfit постарайся заменить хотя бы одну НЕ выбранную основную вещь (кроме selectedItemId).',
    '- Не возвращай одинаковый набор itemIds в другом порядке.',
    '- Если реальных альтернатив в wardrobe нет, допустимо вернуть похожие или одинаковые наборы — но не выдумывай новые вещи.',
  ];
}

function buildStyleExperimentInstructions(styleExperiment: StyleExperiment): string[] {
  const diversityPriority = getDiversityPriority(styleExperiment);
  const toneHint =
    'Title и description каждого образа должны явно отражать характер подбора для выбранного режима.';

  switch (styleExperiment) {
    case 'familiar':
      return [
        'РЕЖИМ СТИЛИСТА: familiar (привычный).',
        `diversity priority: ${diversityPriority}.`,
        '',
        'ПРИОРИТЕТ ВЫБОРА (строго следуй):',
        '- Минимальный визуальный контраст между вещами.',
        '- Близкие и нейтральные цвета.',
        '- Похожий, совместимый стиль у всех вещей образа.',
        '- Простые базовые сочетания без необычных акцентов.',
        '- Минимум смелых или неожиданных элементов.',
        '',
        'ЕСЛИ ЕСТЬ НЕСКОЛЬКО ПОДХОДЯЩИХ ВАРИАНТОВ — выбери наиболее спокойный и предсказуемый.',
        'Избегай комбинаций, которые выглядели бы уместнее в режимах balanced или bold.',
        toneHint,
      ];
    case 'bold':
      return [
        'РЕЖИМ СТИЛИСТА: bold (смелее).',
        `diversity priority: ${diversityPriority}.`,
        '',
        'ПРИОРИТЕТ ВЫБОРА (строго следуй):',
        '- Максимальный разумный контраст среди имеющихся вещей.',
        '- Более заметные и выразительные цветовые сочетания.',
        '- Допускается сочетание разных стилей, если образ остаётся носибельным.',
        '- Предпочитай менее очевидные комбинации, если они всё ещё логичны.',
        '',
        'ЕСЛИ ЕСТЬ ВАЛИДНАЯ АЛЬТЕРНАТИВА — не используй самый очевидный familiar-набор.',
        'Bold не означает случайность: не создавай плохие сочетания только ради отличия.',
        'Образ должен быть смелее, чем в familiar, но осмысленным и носибельным.',
        toneHint,
      ];
    case 'balanced':
    default:
      return [
        'РЕЖИМ СТИЛИСТА: balanced (баланс).',
        `diversity priority: ${diversityPriority}.`,
        '',
        'ПРИОРИТЕТ ВЫБОРА (строго следуй):',
        '- Базовый носибельный комплект как основа образа.',
        '- Ровно один заметный элемент или цветовой акцент (не больше).',
        '- Умеренный контраст — не максимально спокойный и не максимально смелый.',
        '- Сочетание должно оставаться универсальным и практичным.',
        '',
        'ЕСЛИ ВОЗМОЖНО — не выбирай тот же набор, который был бы очевидным выбором для familiar.',
        'Не уходи в экстремальные контрасты режима bold.',
        toneHint,
      ];
  }
}

export function sanitizeOutfitSuggestions(
  rawOutfits: RawOutfitSuggestion[],
  validIds: Set<string>,
  selectedItemId: string | undefined,
  wardrobe: WardrobeItemPayload[],
  maxOutfits: number = MAX_OUTFITS,
): OutfitSuggestion[] {
  const wardrobeById = new Map(wardrobe.map((item) => [item.id, item]));
  const sanitized: OutfitSuggestion[] = [];

  for (const [index, rawOutfit] of rawOutfits.slice(0, maxOutfits).entries()) {
    const rawItemIds = Array.isArray(rawOutfit.itemIds) ? rawOutfit.itemIds : [];
    const filteredIds = rawItemIds.filter(
      (itemId): itemId is string => typeof itemId === 'string' && validIds.has(itemId),
    );
    const uniqueIds = [...new Set(filteredIds)];

    if (selectedItemId && !uniqueIds.includes(selectedItemId)) {
      uniqueIds.unshift(selectedItemId);
    }

    const categorySafeIds = sanitizeItemIdsByCategory(uniqueIds, wardrobeById, selectedItemId);

    if (categorySafeIds.length === 0) {
      continue;
    }

    sanitized.push({
      id:
        typeof rawOutfit.id === 'string' && rawOutfit.id.trim().length > 0
          ? rawOutfit.id.trim()
          : `outfit-${index + 1}`,
      title:
        typeof rawOutfit.title === 'string' && rawOutfit.title.trim().length > 0
          ? rawOutfit.title.trim()
          : `Образ ${index + 1}`,
      itemIds: categorySafeIds,
      description:
        typeof rawOutfit.description === 'string' ? rawOutfit.description.trim() : '',
    });
  }

  return sanitized;
}

function buildWardrobeSummary(wardrobe: WardrobeItemPayload[]): string {
  return wardrobe
    .map((item) => {
      const printPart =
        item.printDescription && item.pattern !== 'Без принта'
          ? `, принт: ${item.printDescription}`
          : '';

      return `- id: ${item.id}; name: ${item.name}; category: ${item.category}; color: ${item.color}; pattern: ${item.pattern}${printPart}; style: ${item.style}`;
    })
    .join('\n');
}

export async function suggestOutfitsHandler(req: Request, res: Response): Promise<void> {
  try {
    const parsedBody = parseRequestBody(req.body);

    if (!parsedBody) {
      res.status(400).json({ error: 'Некорректное тело запроса.' });
      return;
    }

    const {
      selectedItemId,
      wardrobe,
      styleExperiment,
      considerWeather,
      location,
      weatherSensitivity,
    } = parsedBody;
    const validIds = new Set(wardrobe.map((item) => item.id));

    if (selectedItemId && !validIds.has(selectedItemId)) {
      res.status(400).json({ error: 'selectedItemId отсутствует в wardrobe.' });
      return;
    }

    const isHomeMode = !selectedItemId;
    const maxOutfits = isHomeMode ? 1 : MAX_OUTFITS;

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      res.status(500).json({ error: 'OPENAI_API_KEY не настроен на сервере.' });
      return;
    }

    const openai = new OpenAI({ apiKey });
    const wardrobeSummary = buildWardrobeSummary(wardrobe);
    const selectedItem = selectedItemId
      ? wardrobe.find((item) => item.id === selectedItemId)
      : undefined;
    const weather = await resolveWeatherContext(considerWeather, location);

    const promptLines = isHomeMode
      ? [
          'Ты стилист. Подбери ОДИН полный образ на сегодня из переданного гардероба.',
          'Самостоятельно выбери логичный комплект из существующих вещей — верх, низ и обувь, если они есть в wardrobe.',
          'Старайся не дублировать одну категорию в образе без необходимости (например, две пары брюк).',
          'Учитывай цвет, стиль, категорию и принт при сочетании.',
          'Если вещей мало, можно предложить неполный, но логичный комплект.',
          'Верни ровно 1 образ.',
          '',
          ...buildSharedSelectionRules().slice(0, 6),
          '',
          ...buildStyleExperimentInstructions(styleExperiment),
        ]
      : [
          'Ты стилист. Подбери до 3 РАЗНЫХ образов из переданного гардероба.',
          `Обязательная вещь для каждого образа: id "${selectedItemId}" (${selectedItem?.name ?? 'выбранная вещь'}).`,
          'Каждый образ должен содержать selectedItemId.',
          'Старайся не дублировать одну категорию в образе без необходимости (например, две пары брюк).',
          'Учитывай цвет, стиль, категорию и принт при сочетании.',
          'Если вещей мало, можно предложить неполный, но логичный комплект.',
          'Верни максимум 3 образа.',
          '',
          ...buildSharedSelectionRules(),
          '',
          ...buildStyleExperimentInstructions(styleExperiment),
        ];

    if (weather) {
      promptLines.push('', ...buildWeatherPromptLines(weather));

      if (weatherSensitivity) {
        promptLines.push('', ...buildWeatherSensitivityInstructions(weatherSensitivity));
      }
    }

    promptLines.push(
      '',
      'description: одно короткое предложение на русском, не более 140 символов, без списков и повторения заголовка.',
      'Кратко объясни сочетание реальных вещей по цвету, стилю или слоям. Погоду упоминай только если её данные переданы.',
      'Не выдумывай материал, удобство, теплоту вещей или обстоятельства пользователя.',
      '', 'Wardrobe:', wardrobeSummary,
    );

    const response = await openai.responses.create({
      model: MODEL,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: promptLines.join('\n'),
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'outfit_suggestions',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              outfits: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    itemIds: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    description: { type: 'string' },
                  },
                  required: ['id', 'title', 'itemIds', 'description'],
                  additionalProperties: false,
                },
              },
            },
            required: ['outfits'],
            additionalProperties: false,
          },
        },
      },
    });

    const outputText = response.output_text;

    if (!outputText) {
      res.status(502).json({ error: 'OpenAI не вернул результат подбора образов.' });
      return;
    }

    const parsed = JSON.parse(outputText) as RawOutfitsResponse;
    const rawOutfits = Array.isArray(parsed.outfits) ? parsed.outfits : [];
    const outfits = sanitizeOutfitSuggestions(
      rawOutfits,
      validIds,
      selectedItemId,
      wardrobe,
      maxOutfits,
    );

    res.json({ outfits, weather });
  } catch (error) {
    console.error('Failed to suggest outfits:', error);
    res.status(500).json({ error: 'Не удалось подобрать образы.' });
  }
}
