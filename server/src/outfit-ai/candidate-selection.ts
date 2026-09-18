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
const LIGHT_BOTTOM_HINTS = ['шорты', 'юбка'];

const CATEGORY_TARGETS: Record<CategoryGroup, { min: number; max: number }> = {
  TOP: { min: 5, max: 8 },
  BOTTOM: { min: 5, max: 8 },
  SHOES: { min: 3, max: 5 },
  OUTERWEAR: { min: 3, max: 5 },
  OTHER: { min: 2, max: 4 },
};

const NEUTRAL_COLORS = new Set(['чёрный', 'black', 'белый', 'white', 'серый', 'grey', 'gray', 'бежевый', 'beige', 'кремовый']);

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
  const apparent = weather.apparentTemperatureC;
  let score = 0;

  if (apparent <= 8) {
    if (group === 'OUTERWEAR') {
      score += 4;
    }

    if (group === 'TOP' && WARM_TOP_HINTS.some((hint) => normalizedCategory.includes(hint))) {
      score += 2;
    }

    if (LIGHT_BOTTOM_HINTS.includes(normalizedCategory)) {
      score -= 3;
    }
  } else if (apparent >= 24) {
    if (LIGHT_BOTTOM_HINTS.includes(normalizedCategory)) {
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

    if (group === 'SHOES' && (normalizedCategory.includes('ботин') || normalizedCategory.includes('сапог'))) {
      score += 1;
    }
  }

  if (weather.windSpeedKmh >= 25 && group === 'OUTERWEAR') {
    score += 1;
  }

  if (weatherSensitivity === 'Часто мёрзну' && apparent <= 14) {
    if (group === 'OUTERWEAR') {
      score += 2;
    }
  }

  if (weatherSensitivity === 'Мне часто жарко' && apparent >= 18) {
    if (group === 'OUTERWEAR') {
      score -= 1;
    }

    if (LIGHT_BOTTOM_HINTS.includes(normalizedCategory)) {
      score += 1;
    }
  }

  return score;
}

function scoreBehavioralFit(
  item: WardrobeItemPayload,
  context: BehavioralContextPayload,
  styleExperiment: StylistPreferencesPayload['styleExperiment'],
  avoidRepeatedOutfits: boolean,
): number {
  let score = 0;

  if (context.favoriteItemIds.includes(item.id)) {
    score += 4;
  }

  const wornEntry = context.frequentlyWorn.find((entry) => entry.id === item.id);

  if (wornEntry) {
    score += Math.min(3, 1 + Math.floor(wornEntry.wearCount / 3));
  }

  const days = daysSince(item.lastWornAt);

  if (days !== null && days >= 21) {
    score += styleExperiment === 'bold' ? 2 : 1;
  }

  if (item.wearCount === 0) {
    score += styleExperiment === 'bold' ? 2 : styleExperiment === 'balanced' ? 1 : 0;
  } else if (styleExperiment === 'familiar') {
    score += Math.min(2, Math.floor(item.wearCount / 4));
  }

  if (avoidRepeatedOutfits) {
    for (const signature of context.recentOutfitSignatures) {
      if (signature.includes(item.id)) {
        score -= 2;
        break;
      }
    }
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

  if (input.occasion) {
    const occasion = input.occasion.toLowerCase();

    if (occasion.includes('спорт') && getOutfitCategoryGroup(item.category) === 'SHOES') {
      score += 1;
    }

    if (
      (occasion.includes('ресторан') || occasion.includes('свидан')) &&
      getOutfitCategoryGroup(item.category) !== 'OTHER'
    ) {
      score += 0.5;
    }
  }

  return score;
}

function pickCategoryShortlist(
  scoredItems: Array<{ item: WardrobeItemPayload; score: number }>,
  group: CategoryGroup,
  fixedItemId: string | undefined,
): WardrobeItemPayload[] {
  const targets = CATEGORY_TARGETS[group];
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
    if (selected.length >= targets.max) {
      break;
    }

    if (selected.some((item) => item.id === entry.item.id)) {
      continue;
    }

    selected.push(entry.item);
  }

  if (selected.length < targets.min) {
    for (const entry of ranked) {
      if (selected.length >= targets.min) {
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

  if (wardrobe.length <= 30) {
    return wardrobe;
  }

  const { disliked, stronglyDisliked } = buildDislikedSets(input.behavioralContext);
  const eligible = wardrobe.filter((item) => {
    if (item.id === fixedItemId) {
      return true;
    }

    if (stronglyDisliked.has(item.id)) {
      return false;
    }

    if (disliked.has(item.id)) {
      return false;
    }

    return true;
  });

  const scoredItems = eligible.map((item) => ({
    item,
    score: scoreItem(input, item),
  }));

  const selectedById = new Map<string, WardrobeItemPayload>();

  for (const group of ['TOP', 'BOTTOM', 'SHOES', 'OUTERWEAR', 'OTHER'] as CategoryGroup[]) {
    for (const item of pickCategoryShortlist(scoredItems, group, fixedItemId)) {
      selectedById.set(item.id, item);
    }
  }

  if (fixedItemId) {
    const fixedItem = wardrobe.find((item) => item.id === fixedItemId);

    if (fixedItem) {
      selectedById.set(fixedItem.id, fixedItem);
    }
  }

  return wardrobe.filter((item) => selectedById.has(item.id));
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
