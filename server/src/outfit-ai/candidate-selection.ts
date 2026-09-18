import type { CurrentWeather } from '../providers/weather';
import type {
  BehavioralContextPayload,
  StylistPreferencesPayload,
  UserParametersPayload,
  WardrobeItemPayload,
} from '../suggest-outfits';

export type OutfitCandidateMode =
  | 'personal'
  | 'personal-fixed-item'
  | 'paired-owner'
  | 'paired-member';

export type PairedMatchingModeHint = 'natural' | 'same_style' | 'colors' | 'photo';

export type OutfitCandidateSelectionInput = {
  wardrobe: WardrobeItemPayload[];
  weather: CurrentWeather | null;
  stylistPreferences: StylistPreferencesPayload;
  userParameters: UserParametersPayload;
  behavioralContext: BehavioralContextPayload;
  fixedItemId?: string;
  occasion?: string;
  mode: OutfitCandidateMode;
  matchingMode?: PairedMatchingModeHint;
};

export class OutfitCandidateSelectionError extends Error {
  constructor(
    message: string,
    readonly code: 'fixed_item_not_found' | 'fixed_item_invalid',
  ) {
    super(message);
    this.name = 'OutfitCandidateSelectionError';
  }
}

type CategoryGroup = 'BOTTOM' | 'TOP' | 'OUTERWEAR' | 'SHOES' | 'OTHER';

export const TINY_WARDROBE_MAX = 8;
export const PERSONAL_SHORTLIST_MAX = 20;
export const FIXED_ITEM_SHORTLIST_MAX = 12;
export const PAIRED_SHORTLIST_MAX = 18;

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

const WARM_TOP_HINTS = ['свитер', 'худи', 'толстовка', 'свитшот', 'рубашка'];
const LIGHT_BOTTOM_HINTS = ['шорты', 'юбка', 'леггинсы'];
const HEAVY_OUTERWEAR_HINTS = ['пуховик', 'пальто', 'куртка'];
const OPEN_SHOES_HINTS = ['сандал', 'шлёп', 'шлеп'];

const NEUTRAL_COLORS = new Set([
  'чёрный',
  'black',
  'белый',
  'white',
  'серый',
  'grey',
  'gray',
  'бежевый',
  'beige',
  'кремовый',
]);

const ACCENT_COLORS = new Set([
  'красный',
  'red',
  'синий',
  'blue',
  'зелёный',
  'green',
  'жёлтый',
  'yellow',
  'оранжевый',
  'orange',
  'розовый',
  'pink',
  'фиолетовый',
  'purple',
]);

type CategoryTargets = Record<CategoryGroup, { min: number; max: number }>;

const PERSONAL_TARGETS: CategoryTargets = {
  TOP: { min: 3, max: 5 },
  BOTTOM: { min: 2, max: 3 },
  SHOES: { min: 2, max: 3 },
  OUTERWEAR: { min: 1, max: 3 },
  OTHER: { min: 1, max: 2 },
};

const FIXED_ITEM_TARGETS: CategoryTargets = {
  TOP: { min: 2, max: 4 },
  BOTTOM: { min: 1, max: 2 },
  SHOES: { min: 1, max: 2 },
  OUTERWEAR: { min: 1, max: 2 },
  OTHER: { min: 1, max: 2 },
};

const PAIRED_TARGETS: CategoryTargets = {
  TOP: { min: 3, max: 5 },
  BOTTOM: { min: 2, max: 3 },
  SHOES: { min: 2, max: 3 },
  OUTERWEAR: { min: 1, max: 3 },
  OTHER: { min: 1, max: 2 },
};

const CATEGORY_GROUPS: CategoryGroup[] = ['TOP', 'BOTTOM', 'SHOES', 'OUTERWEAR', 'OTHER'];

function normalizeCategory(category: string): string {
  return category.trim().toLowerCase();
}

export function getOutfitCategoryGroup(category: string): CategoryGroup {
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

export function getCategoryTargetsForMode(mode: OutfitCandidateMode): CategoryTargets {
  if (mode === 'personal-fixed-item') {
    return FIXED_ITEM_TARGETS;
  }

  if (mode === 'paired-owner' || mode === 'paired-member') {
    return PAIRED_TARGETS;
  }

  return PERSONAL_TARGETS;
}

export function getShortlistMaxForMode(mode: OutfitCandidateMode): number {
  if (mode === 'personal-fixed-item') {
    return FIXED_ITEM_SHORTLIST_MAX;
  }

  if (mode === 'paired-owner' || mode === 'paired-member') {
    return PAIRED_SHORTLIST_MAX;
  }

  return PERSONAL_SHORTLIST_MAX;
}

function daysSince(isoDate: string | null): number | null {
  if (!isoDate) {
    return null;
  }

  const parsed = Date.parse(isoDate);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return Math.floor((Date.now() - parsed) / (1000 * 60 * 60 * 24));
}

function buildDislikedSets(context: BehavioralContextPayload): {
  disliked: Set<string>;
  stronglyDisliked: Set<string>;
} {
  const feedback = context.outfitFeedback;
  const disliked = new Set<string>(feedback?.recentlyDislikedItemIds ?? []);
  const stronglyDisliked = new Set<string>(feedback?.stronglyDislikedItemIds ?? []);

  for (const itemId of stronglyDisliked) {
    disliked.add(itemId);
  }

  return { disliked, stronglyDisliked };
}

function isLightBottom(category: string): boolean {
  return LIGHT_BOTTOM_HINTS.includes(normalizeCategory(category));
}

function isHeavyOuterwear(category: string): boolean {
  const normalized = normalizeCategory(category);
  return HEAVY_OUTERWEAR_HINTS.some((hint) => normalized.includes(hint));
}

function isOpenShoes(category: string): boolean {
  const normalized = normalizeCategory(category);
  return OPEN_SHOES_HINTS.some((hint) => normalized.includes(hint));
}

function isClosedShoes(category: string): boolean {
  const group = getOutfitCategoryGroup(category);
  return group === 'SHOES' && !isOpenShoes(category);
}

function getEffectiveTemperature(
  weather: CurrentWeather,
  weatherSensitivity: UserParametersPayload['weatherSensitivity'],
): number {
  let apparent = weather.apparentTemperatureC;

  if (weatherSensitivity === 'Часто мёрзну') {
    apparent -= 2;
  } else if (weatherSensitivity === 'Мне часто жарко') {
    apparent += 2;
  }

  return apparent;
}

function failsWeatherHardFilter(
  item: WardrobeItemPayload,
  weather: CurrentWeather | null,
  weatherSensitivity: UserParametersPayload['weatherSensitivity'],
): boolean {
  if (!weather) {
    return false;
  }

  const group = getOutfitCategoryGroup(item.category);
  const normalizedCategory = normalizeCategory(item.category);
  const apparent = getEffectiveTemperature(weather, weatherSensitivity);

  if (apparent <= 5 && (isLightBottom(item.category) || normalizedCategory.includes('шорт'))) {
    return true;
  }

  if (apparent >= 28 && group === 'OUTERWEAR' && isHeavyOuterwear(item.category)) {
    return true;
  }

  if (weather.precipitationMm >= 2 && group === 'SHOES' && isOpenShoes(item.category)) {
    return true;
  }

  return false;
}

function failsFixedItemCategoryConflict(
  item: WardrobeItemPayload,
  fixedItem: WardrobeItemPayload | undefined,
): boolean {
  if (!fixedItem || item.id === fixedItem.id) {
    return false;
  }

  const fixedGroup = getOutfitCategoryGroup(fixedItem.category);
  const itemGroup = getOutfitCategoryGroup(item.category);

  if (fixedGroup === itemGroup && fixedGroup !== 'OTHER' && fixedGroup !== 'TOP') {
    return true;
  }

  if (fixedGroup === 'OUTERWEAR' && itemGroup === 'OUTERWEAR') {
    return true;
  }

  return false;
}

function failsOccasionHardFilter(item: WardrobeItemPayload, occasion: string | undefined): boolean {
  if (!occasion) {
    return false;
  }

  const normalizedOccasion = occasion.toLowerCase();
  const group = getOutfitCategoryGroup(item.category);
  const normalizedCategory = normalizeCategory(item.category);

  if (normalizedOccasion.includes('спорт')) {
    if (group === 'SHOES' && (normalizedCategory.includes('туфл') || normalizedCategory.includes('каблук'))) {
      return true;
    }
  }

  if (
    normalizedOccasion.includes('работ') ||
    normalizedOccasion.includes('офис') ||
    normalizedOccasion.includes('ресторан') ||
    normalizedOccasion.includes('свидан')
  ) {
    if (normalizedCategory.includes('шорт') || normalizedCategory.includes('спорт')) {
      return true;
    }
  }

  return false;
}

function applyHardFilters(
  wardrobe: WardrobeItemPayload[],
  input: OutfitCandidateSelectionInput,
  fixedItem: WardrobeItemPayload | undefined,
): WardrobeItemPayload[] {
  const { disliked, stronglyDisliked } = buildDislikedSets(input.behavioralContext);
  const recentSignature =
    input.stylistPreferences.avoidRepeatedOutfits &&
    input.behavioralContext.recentOutfitSignatures.length > 0
      ? new Set(input.behavioralContext.recentOutfitSignatures[0])
      : null;

  return wardrobe.filter((item) => {
    if (item.id === input.fixedItemId) {
      return true;
    }

    if (stronglyDisliked.has(item.id) || disliked.has(item.id)) {
      return false;
    }

    if (recentSignature?.has(item.id) && recentSignature.size >= 3) {
      return false;
    }

    if (failsWeatherHardFilter(item, input.weather, input.userParameters.weatherSensitivity)) {
      return false;
    }

    if (failsFixedItemCategoryConflict(item, fixedItem)) {
      return false;
    }

    if (failsOccasionHardFilter(item, input.occasion)) {
      return false;
    }

    return true;
  });
}

function scoreWeatherFit(
  item: WardrobeItemPayload,
  weather: CurrentWeather | null,
  weatherSensitivity: UserParametersPayload['weatherSensitivity'],
): number {
  if (!weather) {
    return 0;
  }

  const group = getOutfitCategoryGroup(item.category);
  const normalizedCategory = normalizeCategory(item.category);
  const apparent = getEffectiveTemperature(weather, weatherSensitivity);
  let score = 0;

  if (apparent <= 8) {
    if (group === 'OUTERWEAR') {
      score += 4;
    }

    if (group === 'TOP' && WARM_TOP_HINTS.some((hint) => normalizedCategory.includes(hint))) {
      score += 2;
    }

    if (isLightBottom(item.category)) {
      score -= 3;
    }
  } else if (apparent >= 24) {
    if (isLightBottom(item.category)) {
      score += 2;
    }

    if (group === 'OUTERWEAR') {
      score -= 2;
    }
  }

  if (weather.precipitationMm >= 0.5) {
    if (group === 'OUTERWEAR') {
      score += 2;
    }

    if (isClosedShoes(item.category)) {
      score += 1;
    }

    if (isOpenShoes(item.category)) {
      score -= 2;
    }
  }

  if (weather.windSpeedKmh >= 25) {
    if (group === 'OUTERWEAR' || group === 'TOP') {
      score += 1;
    }
  }

  if (weatherSensitivity === 'Часто мёрзну' && apparent <= 14 && group === 'OUTERWEAR') {
    score += 2;
  }

  if (weatherSensitivity === 'Мне часто жарко' && apparent >= 18) {
    if (group === 'OUTERWEAR') {
      score -= 1;
    }

    if (isLightBottom(item.category)) {
      score += 1;
    }
  }

  return score;
}

function scoreFamiliarity(
  item: WardrobeItemPayload,
  context: BehavioralContextPayload,
  styleExperiment: StylistPreferencesPayload['styleExperiment'],
): number {
  let score = 0;

  if (context.favoriteItemIds.includes(item.id)) {
    score += 4;
  }

  const wornEntry = context.frequentlyWorn.find((entry) => entry.id === item.id);

  if (wornEntry) {
    score += Math.min(3, 1 + Math.floor(wornEntry.wearCount / 3));
  }

  if (styleExperiment === 'familiar') {
    score += Math.min(2, Math.floor(item.wearCount / 4));
  }

  const feedback = context.outfitFeedback;

  if (feedback) {
    if (feedback.recentlyLikedItemIds.includes(item.id)) {
      score += 3;
    }

    for (const combo of feedback.likedCombinations) {
      if (combo.itemIds.includes(item.id)) {
        score += 1;
        break;
      }
    }

    for (const combo of feedback.dislikedCombinations) {
      if (combo.itemIds.includes(item.id)) {
        score -= 2;
        break;
      }
    }
  }

  for (const manual of context.recentManualOutfits) {
    if (manual.itemIds.includes(item.id)) {
      score += 1;
      break;
    }
  }

  for (const saved of context.recentSavedAiOutfits) {
    if (saved.itemIds.includes(item.id)) {
      score += 1;
      break;
    }
  }

  return score;
}

function scoreStyleBoldness(
  item: WardrobeItemPayload,
  styleExperiment: StylistPreferencesPayload['styleExperiment'],
): number {
  let score = 0;
  const normalizedColor = item.color.trim().toLowerCase();
  const days = daysSince(item.lastWornAt);

  if (ACCENT_COLORS.has(normalizedColor)) {
    score += 1.5;
  } else if (!NEUTRAL_COLORS.has(normalizedColor)) {
    score += 0.5;
  }

  if (item.pattern !== 'Без принта') {
    score += 1;
  }

  if (item.wearCount === 0) {
    score += 1;
  } else if (days !== null && days >= 21) {
    score += 0.75;
  }

  if (styleExperiment === 'bold') {
    return score * 1.5;
  }

  if (styleExperiment === 'balanced') {
    if (item.wearCount <= 1) {
      score += 1;
    }

    return score * 0.75;
  }

  return score * 0.35;
}

function scoreBehavioralFit(
  item: WardrobeItemPayload,
  context: BehavioralContextPayload,
  styleExperiment: StylistPreferencesPayload['styleExperiment'],
  avoidRepeatedOutfits: boolean,
): number {
  let score = scoreFamiliarity(item, context, styleExperiment);
  score += scoreStyleBoldness(item, styleExperiment);

  if (avoidRepeatedOutfits) {
    for (const signature of context.recentOutfitSignatures) {
      if (signature.includes(item.id)) {
        score -= 2;
        break;
      }
    }
  }

  return score;
}

function scoreMatchingModeHint(
  item: WardrobeItemPayload,
  matchingMode: PairedMatchingModeHint | undefined,
): number {
  if (!matchingMode) {
    return 0;
  }

  const normalizedColor = item.color.trim().toLowerCase();
  const isNeutral = NEUTRAL_COLORS.has(normalizedColor);

  switch (matchingMode) {
    case 'colors':
      return isNeutral ? 1 : 0;
    case 'same_style':
      return item.style.trim().length > 0 ? 0.5 : 0;
    case 'photo':
      return item.pattern === 'Без принта' ? 0.5 : 0;
    case 'natural':
    default:
      return isNeutral ? 0.5 : 0;
  }
}

function scoreOccasionFit(item: WardrobeItemPayload, occasion: string | undefined): number {
  if (!occasion) {
    return 0;
  }

  const normalizedOccasion = occasion.toLowerCase();
  const group = getOutfitCategoryGroup(item.category);
  const normalizedCategory = normalizeCategory(item.category);
  let score = 0;

  if (normalizedOccasion.includes('спорт') && group === 'SHOES') {
    score += 1;
  }

  if (
    (normalizedOccasion.includes('ресторан') ||
      normalizedOccasion.includes('свидан') ||
      normalizedOccasion.includes('работ')) &&
    group !== 'OTHER'
  ) {
    score += 0.5;
  }

  if (normalizedOccasion.includes('прогул') && group === 'OUTERWEAR') {
    score += 0.5;
  }

  if (normalizedOccasion.includes('вечерин') && !normalizedCategory.includes('спорт')) {
    score += 0.25;
  }

  return score;
}

function scoreItem(input: OutfitCandidateSelectionInput, item: WardrobeItemPayload): number {
  if (input.fixedItemId === item.id) {
    return Number.MAX_SAFE_INTEGER;
  }

  let score = scoreWeatherFit(item, input.weather, input.userParameters.weatherSensitivity);
  score += scoreBehavioralFit(
    item,
    input.behavioralContext,
    input.stylistPreferences.styleExperiment,
    input.stylistPreferences.avoidRepeatedOutfits,
  );
  score += scoreMatchingModeHint(item, input.matchingMode);
  score += scoreOccasionFit(item, input.occasion);

  return score;
}

function pickCategoryShortlist(
  scoredItems: Array<{ item: WardrobeItemPayload; score: number }>,
  group: CategoryGroup,
  targets: CategoryTargets,
  fixedItemId: string | undefined,
  fallbackPool: WardrobeItemPayload[],
): WardrobeItemPayload[] {
  const groupTargets = targets[group];
  const inGroup = scoredItems.filter(
    ({ item }) => getOutfitCategoryGroup(item.category) === group,
  );
  const fixed = fixedItemId
    ? inGroup.find(({ item }) => item.id === fixedItemId)?.item ?? null
    : null;
  const ranked = [...inGroup].sort((left, right) => right.score - left.score);
  const selected: WardrobeItemPayload[] = [];

  if (fixed) {
    selected.push(fixed);
  }

  for (const entry of ranked) {
    if (selected.length >= groupTargets.max) {
      break;
    }

    if (selected.some((item) => item.id === entry.item.id)) {
      continue;
    }

    selected.push(entry.item);
  }

  if (selected.length < groupTargets.min) {
    const fallbackRanked = fallbackPool
      .filter((item) => getOutfitCategoryGroup(item.category) === group)
      .map((item) => ({
        item,
        score: scoredItems.find((entry) => entry.item.id === item.id)?.score ?? -999,
      }))
      .sort((left, right) => right.score - left.score);

    for (const entry of fallbackRanked) {
      if (selected.length >= groupTargets.min) {
        break;
      }

      if (!selected.some((item) => item.id === entry.item.id)) {
        selected.push(entry.item);
      }
    }
  }

  return selected;
}

export function selectOutfitCandidates(input: OutfitCandidateSelectionInput): WardrobeItemPayload[] {
  const { wardrobe, fixedItemId } = input;

  if (fixedItemId && !wardrobe.some((item) => item.id === fixedItemId)) {
    throw new OutfitCandidateSelectionError(
      'Fixed item is not available in this wardrobe.',
      'fixed_item_not_found',
    );
  }

  if (wardrobe.length <= TINY_WARDROBE_MAX) {
    return wardrobe;
  }

  const fixedItem = fixedItemId ? wardrobe.find((item) => item.id === fixedItemId) : undefined;
  const eligible = applyHardFilters(wardrobe, input, fixedItem);
  const scoredItems = eligible.map((item) => ({
    item,
    score: scoreItem(input, item),
  }));
  const targets = getCategoryTargetsForMode(input.mode);
  const shortlistMax = getShortlistMaxForMode(input.mode);
  const selectedById = new Map<string, WardrobeItemPayload>();

  for (const group of CATEGORY_GROUPS) {
    for (const item of pickCategoryShortlist(
      scoredItems,
      group,
      targets,
      fixedItemId,
      wardrobe,
    )) {
      selectedById.set(item.id, item);
    }
  }

  if (fixedItemId) {
    const fixed = wardrobe.find((item) => item.id === fixedItemId);

    if (fixed) {
      selectedById.set(fixed.id, fixed);
    }
  }

  let selected = wardrobe.filter((item) => selectedById.has(item.id));

  if (selected.length > shortlistMax) {
    const rankedSelected = selected
      .map((item) => ({
        item,
        score: scoredItems.find((entry) => entry.item.id === item.id)?.score ?? 0,
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, shortlistMax)
      .map(({ item }) => item.id);
    const rankedIds = new Set(rankedSelected);

    if (fixedItemId) {
      rankedIds.add(fixedItemId);
    }

    selected = wardrobe.filter((item) => rankedIds.has(item.id));
  }

  return selected;
}

export function summarizeCandidateSelection(
  totalCount: number,
  selected: WardrobeItemPayload[],
): { total: number; selected: number } {
  return {
    total: totalCount,
    selected: selected.length,
  };
}
