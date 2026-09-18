import type { Request, Response } from 'express';
import type { OutfitFeedbackReason } from './db/outfit-feedback-reasons';
import { mergeOutfitFeedbackIntoBehavioralContext } from './outfit-feedback/build-outfit-feedback-context';
import { enforceAiRateLimit } from './ai-request-rate-limit';
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

const FIT_PREFERENCES = ['По фигуре', 'Обычная', 'Свободная'] as const;

type FitPreference = (typeof FIT_PREFERENCES)[number];

const WARDROBE_MODES = ['owned-only', 'allow-suggestions'] as const;

type WardrobeMode = (typeof WARDROBE_MODES)[number];
const DEFAULT_WARDROBE_MODE: WardrobeMode = 'owned-only';

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
  isFavorite: boolean;
  wearCount: number;
  lastWornAt: string | null;
};

export type CompactOutfitRef = {
  itemIds: string[];
  title?: string;
};

export type OutfitFeedbackContextPayload = {
  recentlyLikedItemIds: string[];
  recentlyDislikedItemIds: string[];
  likedCombinations: CompactOutfitRef[];
  dislikedCombinations: CompactOutfitRef[];
  stronglyDislikedItemIds: string[];
  reasonCounts: Partial<Record<OutfitFeedbackReason, number>>;
};

export type BehavioralContextPayload = {
  favoriteItemIds: string[];
  frequentlyWorn: Array<{ id: string; wearCount: number; lastWornAt: string | null }>;
  recentManualOutfits: CompactOutfitRef[];
  recentSavedAiOutfits: CompactOutfitRef[];
  recentOutfitSignatures: string[];
  outfitFeedback?: OutfitFeedbackContextPayload;
};

export type StylistPreferencesPayload = {
  styleExperiment: StyleExperiment;
  considerWeather: boolean;
  wardrobeMode: WardrobeMode;
  avoidRepeatedOutfits: boolean;
};

export type UserParametersPayload = {
  fitPreference: FitPreference | null;
  weatherSensitivity: WeatherSensitivity | null;
};

export type SuggestOutfitsRequestBody = {
  selectedItemId?: string;
  wardrobe: WardrobeItemPayload[];
  stylistPreferences: StylistPreferencesPayload;
  userParameters: UserParametersPayload;
  behavioralContext: BehavioralContextPayload;
  location: SuggestOutfitsLocation | null;
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

function parseFitPreference(value: unknown): FitPreference | null {
  if (typeof value === 'string' && FIT_PREFERENCES.includes(value as FitPreference)) {
    return value as FitPreference;
  }

  return null;
}

function parseWardrobeMode(value: unknown): WardrobeMode {
  if (typeof value === 'string' && WARDROBE_MODES.includes(value as WardrobeMode)) {
    return value as WardrobeMode;
  }

  return DEFAULT_WARDROBE_MODE;
}

function parseCompactOutfitRef(value: unknown): CompactOutfitRef | null {
  if (!isRecord(value) || !Array.isArray(value.itemIds)) {
    return null;
  }

  const itemIds = value.itemIds.filter((itemId): itemId is string => typeof itemId === 'string');

  if (itemIds.length === 0) {
    return null;
  }

  return {
    itemIds,
    title:
      typeof value.title === 'string' && value.title.trim().length > 0
        ? value.title.trim()
        : undefined,
  };
}

function parseOutfitFeedbackContext(value: unknown): OutfitFeedbackContextPayload | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const parseItemIds = (raw: unknown): string[] =>
    Array.isArray(raw) ? raw.filter((itemId): itemId is string => typeof itemId === 'string') : [];

  const parseCombinations = (raw: unknown): CompactOutfitRef[] =>
    Array.isArray(raw)
      ? raw
          .map((entry) => parseCompactOutfitRef(entry))
          .filter((entry): entry is CompactOutfitRef => entry !== null)
      : [];

  const reasonCounts: Partial<Record<OutfitFeedbackReason, number>> = {};

  if (isRecord(value.reasonCounts)) {
    for (const [key, count] of Object.entries(value.reasonCounts)) {
      if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
        reasonCounts[key as OutfitFeedbackReason] = Math.floor(count);
      }
    }
  }

  return {
    recentlyLikedItemIds: parseItemIds(value.recentlyLikedItemIds),
    recentlyDislikedItemIds: parseItemIds(value.recentlyDislikedItemIds),
    likedCombinations: parseCombinations(value.likedCombinations),
    dislikedCombinations: parseCombinations(value.dislikedCombinations),
    stronglyDislikedItemIds: parseItemIds(value.stronglyDislikedItemIds),
    reasonCounts,
  };
}

function parseBehavioralContext(value: unknown, wardrobe: WardrobeItemPayload[]): BehavioralContextPayload {
  const fallbackFavorites = wardrobe.filter((item) => item.isFavorite).map((item) => item.id);

  if (!isRecord(value)) {
    return {
      favoriteItemIds: fallbackFavorites,
      frequentlyWorn: [],
      recentManualOutfits: [],
      recentSavedAiOutfits: [],
      recentOutfitSignatures: [],
    };
  }

  const favoriteItemIds = Array.isArray(value.favoriteItemIds)
    ? value.favoriteItemIds.filter((itemId): itemId is string => typeof itemId === 'string')
    : fallbackFavorites;

  const frequentlyWorn = Array.isArray(value.frequentlyWorn)
    ? value.frequentlyWorn
        .map((entry) => {
          if (!isRecord(entry) || typeof entry.id !== 'string') {
            return null;
          }

          const wearCount =
            typeof entry.wearCount === 'number' && Number.isFinite(entry.wearCount) && entry.wearCount >= 0
              ? Math.floor(entry.wearCount)
              : 0;

          return {
            id: entry.id,
            wearCount,
            lastWornAt:
              typeof entry.lastWornAt === 'string' && entry.lastWornAt.trim().length > 0
                ? entry.lastWornAt.trim()
                : null,
          };
        })
        .filter((entry): entry is { id: string; wearCount: number; lastWornAt: string | null } => entry !== null)
    : [];

  const recentManualOutfits = Array.isArray(value.recentManualOutfits)
    ? value.recentManualOutfits
        .map((entry) => parseCompactOutfitRef(entry))
        .filter((entry): entry is CompactOutfitRef => entry !== null)
    : [];

  const recentSavedAiOutfits = Array.isArray(value.recentSavedAiOutfits)
    ? value.recentSavedAiOutfits
        .map((entry) => parseCompactOutfitRef(entry))
        .filter((entry): entry is CompactOutfitRef => entry !== null)
    : [];

  const recentOutfitSignatures = Array.isArray(value.recentOutfitSignatures)
    ? value.recentOutfitSignatures.filter((signature): signature is string => typeof signature === 'string')
    : [];

  return {
    favoriteItemIds,
    frequentlyWorn,
    recentManualOutfits,
    recentSavedAiOutfits,
    recentOutfitSignatures,
    outfitFeedback: parseOutfitFeedbackContext(value.outfitFeedback),
  };
}

function parseStylistPreferences(body: Record<string, unknown>): StylistPreferencesPayload {
  const nested = isRecord(body.stylistPreferences) ? body.stylistPreferences : null;

  return {
    styleExperiment: parseStyleExperiment(nested?.styleExperiment ?? body.styleExperiment),
    considerWeather: nested ? nested.considerWeather === true : body.considerWeather === true,
    wardrobeMode: parseWardrobeMode(nested?.wardrobeMode ?? body.wardrobeMode),
    avoidRepeatedOutfits: nested ? nested.avoidRepeatedOutfits !== false : body.avoidRepeatedOutfits !== false,
  };
}

function parseUserParameters(body: Record<string, unknown>): UserParametersPayload {
  const nested = isRecord(body.userParameters) ? body.userParameters : null;

  return {
    fitPreference: parseFitPreference(nested?.fitPreference ?? body.fitPreference),
    weatherSensitivity: parseWeatherSensitivity(nested?.weatherSensitivity ?? body.weatherSensitivity),
  };
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

    const wearCount =
      typeof entry.wearCount === 'number' && Number.isFinite(entry.wearCount) && entry.wearCount >= 0
        ? Math.floor(entry.wearCount)
        : 0;

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
      isFavorite: entry.isFavorite === true,
      wearCount,
      lastWornAt:
        typeof entry.lastWornAt === 'string' && entry.lastWornAt.trim().length > 0
          ? entry.lastWornAt.trim()
          : null,
    });
  }

  if (parsedWardrobe.length === 0) {
    return null;
  }

  return {
    selectedItemId,
    wardrobe: parsedWardrobe,
    stylistPreferences: parseStylistPreferences(body),
    userParameters: parseUserParameters(body),
    behavioralContext: parseBehavioralContext(body.behavioralContext, parsedWardrobe),
    location: parseLocation(body.location),
  };
}

export function buildWeatherSensitivityInstructions(
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

export function buildWeatherSection(weather: CurrentWeather): string[] {
  const conditions = getWeatherCodeLabel(weather.weatherCode);
  const feelsDifferent =
    Math.abs(weather.apparentTemperatureC - weather.temperatureC) >= 2;

  return [
    'B. CURRENT WEATHER',
    `- actual temperature: ${weather.temperatureC}°C`,
    `- feels like (apparent): ${weather.apparentTemperatureC}°C`,
    `- precipitation: ${weather.precipitationMm} mm`,
    `- wind: ${weather.windSpeedKmh} km/h`,
    `- conditions: ${conditions}`,
    feelsDifferent
      ? '- apparent temperature differs noticeably — prioritize feels like for comfort when choosing layers.'
      : '- actual and apparent temperature are close.',
    '- Weather is a strong factor, but use ONLY existing wardrobe items.',
    '- Do not pick weather-inappropriate items just because they are favorites or often worn.',
  ];
}

export async function resolveWeatherContext(
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

export function hasMinimumWardrobeForOutfit(wardrobe: WardrobeItemPayload[]): boolean {
  if (wardrobe.length < 2) {
    return false;
  }

  const groups = new Set(wardrobe.map((item) => getCategoryGroup(item.category)));

  return groups.has('BOTTOM') && groups.has('TOP');
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

export function buildSharedSelectionRules(): string[] {
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

function buildPriorityOrderSection(): string[] {
  return [
    'SIGNAL PRIORITY (highest to lowest):',
    '1. weather appropriateness / physical comfort;',
    '2. category compatibility (no conflicting items);',
    '3. explicit user preferences (styleExperiment, fitPreference, weatherSensitivity, wardrobeMode);',
    '4. behavioral signals (favorites, wear history, saved outfits);',
    '5. variety / avoiding unnecessary repetition.',
    '',
    'Behavioral signals are preferences, NOT hard constraints.',
  ];
}

function buildHardRulesSection(
  isHomeMode: boolean,
  maxOutfits: number,
  selectedItemId?: string,
): string[] {
  return [
    'A. HARD RULES',
    '- Use ONLY existing item ids from wardrobe. Never invent items.',
    '- Category conflicts are forbidden (max 1 bottom, max 1 shoes, max 1 outerwear, max 2 tops).',
    selectedItemId
      ? `- selectedItemId "${selectedItemId}" is REQUIRED in every outfit regardless of recency or favorites.`
      : '- Pick one coherent outfit from existing items.',
    isHomeMode
      ? '- Return exactly 1 outfit.'
      : `- Return up to ${maxOutfits} distinct outfits.`,
    '- Do not return identical item sets in different order.',
  ];
}

export function buildFitPreferenceLines(fitPreference: FitPreference | null): string[] {
  if (!fitPreference) {
    return [];
  }

  switch (fitPreference) {
    case 'По фигуре':
      return [
        'fitPreference: closer-to-body silhouettes when wardrobe metadata reasonably supports it.',
        'Do NOT invent fit properties that are not present in wardrobe metadata.',
      ];
    case 'Свободная':
      return [
        'fitPreference: relaxed / roomy silhouettes and comfortable layering when wardrobe metadata supports it.',
        'Do NOT invent fit properties that are not present in wardrobe metadata.',
      ];
    case 'Обычная':
    default:
      return ['fitPreference: neutral — no extra fit bias beyond wardrobe metadata.'];
  }
}

function buildUserExplicitPreferencesSection(
  stylistPreferences: StylistPreferencesPayload,
  userParameters: UserParametersPayload,
): string[] {
  const lines = [
    'C. USER EXPLICIT PREFERENCES',
    `styleExperiment: ${stylistPreferences.styleExperiment}`,
    `considerWeather: ${stylistPreferences.considerWeather}`,
    `wardrobeMode: ${stylistPreferences.wardrobeMode}`,
    `avoidRepeatedOutfits: ${stylistPreferences.avoidRepeatedOutfits}`,
    '',
    ...buildStyleExperimentInstructions(stylistPreferences.styleExperiment),
  ];

  if (stylistPreferences.wardrobeMode === 'owned-only') {
    lines.push('', 'wardrobeMode owned-only: use ONLY items from wardrobe.');
  } else {
    lines.push(
      '',
      'wardrobeMode allow-suggestions: prefer owned wardrobe items; mention missing pieces only in description, never as itemIds.',
    );
  }

  const fitLines = buildFitPreferenceLines(userParameters.fitPreference);

  if (fitLines.length > 0) {
    lines.push('', ...fitLines);
  }

  if (userParameters.weatherSensitivity) {
    lines.push('', ...buildWeatherSensitivityInstructions(userParameters.weatherSensitivity));
  }

  return lines;
}

function formatCompactOutfits(outfits: CompactOutfitRef[]): string {
  if (outfits.length === 0) {
    return '- none';
  }

  return outfits
    .map((outfit) => {
      const titlePart = outfit.title ? ` title="${outfit.title}"` : '';

      return `- itemIds: [${outfit.itemIds.join(', ')}]${titlePart}`;
    })
    .join('\n');
}

function buildUserBehaviorSection(
  behavioralContext: BehavioralContextPayload,
  avoidRepeatedOutfits: boolean,
): string[] {
  const frequentlyWornSummary =
    behavioralContext.frequentlyWorn.length > 0
      ? behavioralContext.frequentlyWorn
          .map(
            (entry) =>
              `- id: ${entry.id}; wearCount: ${entry.wearCount}; lastWornAt: ${entry.lastWornAt ?? 'null'}`,
          )
          .join('\n')
      : '- none';

  const lines = [
    'D. USER BEHAVIOR',
    '',
    'Interpretation rules:',
    '- isFavorite: user likes the item; prefer slightly among equal candidates; never override weather.',
    '- wearCount: habit/comfort signal (0=rare, 1-3=normal, 4+=regular); not mandatory every outfit.',
    '- lastWornAt: recency signal — recently worn → slightly lower repeat priority if good alternatives exist; long ago → slightly higher chance to include.',
    '- manual saved outfits: STRONG taste signal (user built them).',
    '- AI saved outfits: WEAKER taste signal (user liked the suggestion).',
    '- Behavioral signals must NOT beat weather or category logic.',
    '',
    `favoriteItemIds: [${behavioralContext.favoriteItemIds.join(', ') || 'none'}]`,
    '',
    'frequentlyWorn:',
    frequentlyWornSummary,
    '',
    'recentManualOutfits (strong preference):',
    formatCompactOutfits(behavioralContext.recentManualOutfits),
    '',
    'recentSavedAiOutfits (secondary preference):',
    formatCompactOutfits(behavioralContext.recentSavedAiOutfits),
  ];

  if (avoidRepeatedOutfits && behavioralContext.recentOutfitSignatures.length > 0) {
    lines.push(
      '',
      'avoidRepeatedOutfits: try NOT to repeat these recent outfit signatures exactly:',
      ...behavioralContext.recentOutfitSignatures.map((signature) => `- ${signature}`),
      'If alternatives are equally good, prefer a different combination.',
    );
  } else if (avoidRepeatedOutfits) {
    lines.push('', 'avoidRepeatedOutfits: enabled, but no recent signatures available.');
  }

  lines.push(
    '',
    'Variety: do not always pick top favorites or highest wearCount; balance familiar vs fresh combinations.',
  );

  const feedback = behavioralContext.outfitFeedback;

  if (feedback) {
    const reasonSummary = Object.entries(feedback.reasonCounts)
      .filter(([, count]) => count > 0)
      .map(([reason, count]) => `${reason}: ${count}`)
      .join(', ');

    lines.push(
      '',
      'G. RECENT OUTFIT FEEDBACK (soft preference hints, not hard bans)',
      '',
      'Interpretation rules:',
      '- These are recent thumbs-up/down on AI recommendations only.',
      '- LIKE: gently favor similar combinations/styles; do NOT repeat the exact same outfit.',
      '- DISLIKE combination_disliked: avoid similar combinations; individual items stay allowed.',
      '- DISLIKE item_disliked: strongly reduce priority of listed items; keep them in wardrobe.',
      '- DISLIKE too_familiar: next outfit may lean slightly toward rare/regular variety.',
      '- DISLIKE too_unusual: next outfit may lean slightly toward familiar/regular combinations.',
      '- DISLIKE weather_mismatch: weak weather signal only; real weather rules still win.',
      '- One dislike does not ban items forever; balance with other signals.',
      '',
      `recentlyLikedItemIds: [${feedback.recentlyLikedItemIds.join(', ') || 'none'}]`,
      `recentlyDislikedItemIds: [${feedback.recentlyDislikedItemIds.join(', ') || 'none'}]`,
      `stronglyDislikedItemIds: [${feedback.stronglyDislikedItemIds.join(', ') || 'none'}]`,
      '',
      'likedCombinations:',
      formatCompactOutfits(feedback.likedCombinations),
      '',
      'dislikedCombinations:',
      formatCompactOutfits(feedback.dislikedCombinations),
      '',
      `reasonCounts: ${reasonSummary || 'none'}`,
    );
  }

  return lines;
}

function buildWardrobeSummary(wardrobe: WardrobeItemPayload[]): string {
  return wardrobe
    .map((item) => {
      const printPart =
        item.printDescription && item.pattern !== 'Без принта'
          ? `, принт: ${item.printDescription}`
          : '';
      const lastWornPart = item.lastWornAt ? item.lastWornAt : 'null';

      return `- id: ${item.id}; name: ${item.name}; category: ${item.category}; color: ${item.color}; pattern: ${item.pattern}${printPart}; style: ${item.style}; isFavorite: ${item.isFavorite}; wearCount: ${item.wearCount}; lastWornAt: ${lastWornPart}`;
    })
    .join('\n');
}

export async function generateOutfitSuggestionsFromBody(
  parsedBody: SuggestOutfitsRequestBody,
  options?: { userId?: string },
): Promise<{ outfits: OutfitSuggestion[]; weather: CurrentWeather | null }> {
  const {
    selectedItemId,
    wardrobe,
    stylistPreferences,
    userParameters,
    behavioralContext: parsedBehavioralContext,
    location,
  } = parsedBody;
  const { considerWeather, avoidRepeatedOutfits } = stylistPreferences;
  const validIds = new Set(wardrobe.map((item) => item.id));
  const behavioralContext = options?.userId
    ? mergeOutfitFeedbackIntoBehavioralContext(parsedBehavioralContext, options.userId, validIds)
    : parsedBehavioralContext;

  if (selectedItemId && !validIds.has(selectedItemId)) {
    throw new Error('selectedItemId отсутствует в wardrobe.');
  }

  const isHomeMode = !selectedItemId;
  const maxOutfits = isHomeMode ? 1 : MAX_OUTFITS;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY не настроен на сервере.');
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[OUTFIT PERSONALIZATION] favorites: ${behavioralContext.favoriteItemIds.length}, ` +
        `wear history items: ${behavioralContext.frequentlyWorn.length}, ` +
        `manual outfits: ${behavioralContext.recentManualOutfits.length}, ` +
        `saved ai outfits: ${behavioralContext.recentSavedAiOutfits.length}`,
    );
  }

  const openai = new OpenAI({ apiKey });
  const wardrobeSummary = buildWardrobeSummary(wardrobe);
  const selectedItem = selectedItemId
    ? wardrobe.find((item) => item.id === selectedItemId)
    : undefined;
  const weather = await resolveWeatherContext(considerWeather, location);

  const promptLines = [
    'You are a stylist assembling outfits ONLY from the provided wardrobe.',
    '',
    ...buildPriorityOrderSection(),
    '',
    ...buildHardRulesSection(isHomeMode, maxOutfits, selectedItemId),
  ];

  if (weather) {
    promptLines.push('', ...buildWeatherSection(weather));
  } else if (considerWeather) {
    promptLines.push('', 'B. CURRENT WEATHER', '- Weather requested but unavailable — choose reasonable layers from wardrobe.');
  } else {
    promptLines.push('', 'B. CURRENT WEATHER', '- Weather consideration disabled by user.');
  }

  promptLines.push(
    '',
    ...buildUserExplicitPreferencesSection(stylistPreferences, userParameters),
    '',
    ...buildUserBehaviorSection(behavioralContext, avoidRepeatedOutfits),
    '',
    'E. AVAILABLE WARDROBE',
    wardrobeSummary,
    '',
    'F. TASK',
    isHomeMode
      ? 'Pick exactly ONE complete outfit for today from wardrobe. Prefer top + bottom + shoes when available.'
      : `Pick up to ${maxOutfits} DISTINCT outfits. Each MUST include selectedItemId "${selectedItemId}" (${selectedItem?.name ?? 'selected item'}).`,
    ...(isHomeMode ? buildSharedSelectionRules().slice(0, 6) : buildSharedSelectionRules()),
    '',
    'description: one short Russian sentence, max 140 chars, no lists, no title repeat.',
    'Explain real item pairing by color/style/layers. Mention weather only if weather data was provided.',
    'Do not invent materials, comfort, warmth, or user circumstances.',
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
    throw new Error('OpenAI не вернул результат подбора образов.');
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

  return { outfits, weather };
}

export async function suggestOutfitsHandler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.authUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const parsedBody = parseRequestBody(req.body);

    if (!parsedBody) {
      res.status(400).json({ error: 'Некорректное тело запроса.' });
      return;
    }

    if (!enforceAiRateLimit(res, req.authUser.id, 'suggest')) {
      return;
    }

    const result = await generateOutfitSuggestionsFromBody(parsedBody, {
      userId: req.authUser.id,
    });

    res.json(result);
  } catch (error) {
    console.error('Failed to suggest outfits:', error);
    res.status(500).json({ error: 'Не удалось подобрать образы.' });
  }
}
