import type { CurrentWeather } from '../providers/weather';
import { getWeatherCodeLabel } from '../weather-code';
import type {
  BehavioralContextPayload,
  CompactOutfitRef,
  OutfitFeedbackContextPayload,
  StylistPreferencesPayload,
  UserParametersPayload,
  WardrobeItemPayload,
} from '../suggest-outfits';
import {
  OutfitCandidateSelectionError,
  selectOutfitCandidates,
  summarizeCandidateSelection,
  type PairedMatchingModeHint,
} from './candidate-selection';

export const MAX_AI_WARDROBE_ITEMS = 100;

export const BEHAVIORAL_CAPS = {
  favoriteItemIds: 20,
  frequentlyWorn: 20,
  recentManualOutfits: 5,
  recentSavedAiOutfits: 5,
  recentOutfitSignatures: 10,
  recentlyLikedItemIds: 15,
  recentlyDislikedItemIds: 15,
  likedCombinations: 5,
  dislikedCombinations: 5,
  stronglyDislikedItemIds: 10,
} as const;

const WARDROBE_LEGEND = 'W:id|cat|color|style|pat[|fav|wear|last|print]';

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

const CATEGORY_FILL_ORDER: CategoryGroup[] = ['TOP', 'BOTTOM', 'SHOES', 'OUTERWEAR', 'OTHER'];

export type PersonalOutfitPromptInput = {
  wardrobe: WardrobeItemPayload[];
  weather: CurrentWeather | null;
  considerWeather: boolean;
  stylistPreferences: StylistPreferencesPayload;
  userParameters: UserParametersPayload;
  behavioralContext: BehavioralContextPayload;
  selectedItemId?: string;
  selectedItemName?: string;
  isHomeMode: boolean;
  maxOutfits: number;
};

export type PairedOutfitPromptPersonInput = {
  label: 'A' | 'B';
  stylistPreferences: StylistPreferencesPayload;
  userParameters: UserParametersPayload;
  behavioralContext: BehavioralContextPayload;
  wardrobe: WardrobeItemPayload[];
  fixedItemId?: string;
};

export type PairedOutfitPromptInput = {
  occasion: string;
  matchingMode: PairedMatchingModeHint;
  weather: CurrentWeather | null;
  considerWeather: boolean;
  personA: PairedOutfitPromptPersonInput;
  personB: PairedOutfitPromptPersonInput;
};

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

function capArray<T>(items: T[], max: number): T[] {
  return items.slice(0, max);
}

function capOutfitFeedback(
  feedback: OutfitFeedbackContextPayload | undefined,
): OutfitFeedbackContextPayload | undefined {
  if (!feedback) {
    return undefined;
  }

  return {
    recentlyLikedItemIds: capArray(feedback.recentlyLikedItemIds, BEHAVIORAL_CAPS.recentlyLikedItemIds),
    recentlyDislikedItemIds: capArray(
      feedback.recentlyDislikedItemIds,
      BEHAVIORAL_CAPS.recentlyDislikedItemIds,
    ),
    likedCombinations: capArray(feedback.likedCombinations, BEHAVIORAL_CAPS.likedCombinations),
    dislikedCombinations: capArray(feedback.dislikedCombinations, BEHAVIORAL_CAPS.dislikedCombinations),
    stronglyDislikedItemIds: capArray(
      feedback.stronglyDislikedItemIds,
      BEHAVIORAL_CAPS.stronglyDislikedItemIds,
    ),
    reasonCounts: feedback.reasonCounts,
  };
}

export function capBehavioralContext(context: BehavioralContextPayload): BehavioralContextPayload {
  return {
    favoriteItemIds: capArray(context.favoriteItemIds, BEHAVIORAL_CAPS.favoriteItemIds),
    frequentlyWorn: capArray(context.frequentlyWorn, BEHAVIORAL_CAPS.frequentlyWorn),
    recentManualOutfits: capArray(context.recentManualOutfits, BEHAVIORAL_CAPS.recentManualOutfits),
    recentSavedAiOutfits: capArray(context.recentSavedAiOutfits, BEHAVIORAL_CAPS.recentSavedAiOutfits),
    recentOutfitSignatures: capArray(
      context.recentOutfitSignatures,
      BEHAVIORAL_CAPS.recentOutfitSignatures,
    ),
    outfitFeedback: capOutfitFeedback(context.outfitFeedback),
  };
}

export function selectWardrobeForAi(
  wardrobe: WardrobeItemPayload[],
  options: {
    selectedItemId?: string;
    favoriteItemIds: string[];
    frequentlyWorn: BehavioralContextPayload['frequentlyWorn'];
  },
): WardrobeItemPayload[] {
  const behavioralContext: BehavioralContextPayload = {
    favoriteItemIds: options.favoriteItemIds,
    frequentlyWorn: options.frequentlyWorn,
    recentManualOutfits: [],
    recentSavedAiOutfits: [],
    recentOutfitSignatures: [],
  };

  return selectOutfitCandidates({
    wardrobe,
    weather: null,
    stylistPreferences: {
      styleExperiment: 'balanced',
      considerWeather: false,
      wardrobeMode: 'owned-only',
      avoidRepeatedOutfits: false,
    },
    userParameters: {
      fitPreference: null,
      weatherSensitivity: null,
    },
    behavioralContext,
    fixedItemId: options.selectedItemId,
    mode: options.selectedItemId ? 'personal-fixed-item' : 'personal',
  });
}

export function buildLegacyWardrobeSummary(wardrobe: WardrobeItemPayload[]): string {
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

function formatPatternToken(pattern: string): string {
  return pattern === 'Без принта' ? '-' : pattern;
}

function formatCompactWardrobeItem(item: WardrobeItemPayload): string {
  const base = [
    item.id,
    item.category,
    item.color,
    item.style,
    formatPatternToken(item.pattern),
  ].join('|');
  const flags: string[] = [];

  if (item.isFavorite) {
    flags.push('fav=1');
  }

  if (item.wearCount > 0) {
    flags.push(`wear=${item.wearCount}`);
  }

  if (item.lastWornAt) {
    flags.push(`last=${item.lastWornAt.slice(0, 10)}`);
  }

  if (item.printDescription && item.pattern !== 'Без принта') {
    flags.push(`print=${item.printDescription}`);
  }

  return flags.length > 0 ? `${base}|${flags.join('|')}` : base;
}

export function buildCompactWardrobeSummary(wardrobe: WardrobeItemPayload[]): string {
  return [WARDROBE_LEGEND, ...wardrobe.map(formatCompactWardrobeItem)].join('\n');
}

function formatCompactOutfitRefs(outfits: CompactOutfitRef[]): string {
  return outfits.map((outfit) => `[${outfit.itemIds.join(',')}]`).join('|');
}

function encodeWeatherSensitivity(
  weatherSensitivity: UserParametersPayload['weatherSensitivity'],
): string {
  switch (weatherSensitivity) {
    case 'Часто мёрзну':
      return 'cold';
    case 'Мне часто жарко':
      return 'hot';
    case 'Обычно':
    default:
      return 'normal';
  }
}

function encodeFitPreference(fitPreference: UserParametersPayload['fitPreference']): string | null {
  switch (fitPreference) {
    case 'По фигуре':
      return 'fitted';
    case 'Свободная':
      return 'relaxed';
    case 'Обычная':
      return 'normal';
    default:
      return null;
  }
}

export function buildCompactStyleModeLine(styleExperiment: StylistPreferencesPayload['styleExperiment']): string {
  switch (styleExperiment) {
    case 'familiar':
      return 'STYLE_MODE=familiar prefer frequent/favorite/liked';
    case 'bold':
      return 'STYLE_MODE=bold allow rare/unworn/contrast; never override weather/occasion';
    case 'balanced':
    default:
      return 'STYLE_MODE=balanced familiar base + 1 less-used suitable item';
  }
}

export function buildCompactWeatherSection(weather: CurrentWeather): string[] {
  const condition = getWeatherCodeLabel(weather.weatherCode)
    .toLowerCase()
    .replace(/\s+/g, '_');

  return [
    'WEATHER:',
    `temp=${weather.temperatureC} feels=${weather.apparentTemperatureC} rain=${weather.precipitationMm} wind=${weather.windSpeedKmh} cond=${condition}`,
    'Use feels-like and rain/wind for sensible layers.',
  ];
}

function buildCompactWeatherUnavailableSection(considerWeather: boolean): string[] {
  if (considerWeather) {
    return ['WEATHER: unavailable', 'Choose reasonable layers from wardrobe.'];
  }

  return ['WEATHER: disabled'];
}

function buildCompactRulesSection(input: PersonalOutfitPromptInput): string[] {
  const lines = [
    'PRIORITY: weather+occasion > category > prefs > behavior > variety',
    'RULES:',
    '- itemIds: wardrobe IDs only',
    '- max: bottom=1 shoes=1 outer=1 tops=2',
    `- outfits=${input.maxOutfits}${input.maxOutfits === 1 ? '' : ' distinct'}`,
    '- no duplicate item sets',
    '- desc: 1 RU sentence <=140 chars; no title repeat',
  ];

  if (input.selectedItemId) {
    lines.push(`- fixedItemId=${input.selectedItemId} mandatory`);
  }

  if (input.stylistPreferences.wardrobeMode === 'owned-only') {
    lines.push('- wardrobeMode=owned-only');
  } else {
    lines.push('- wardrobeMode=allow-suggestions (mention gaps in desc only)');
  }

  return lines;
}

function buildCompactPreferencesSection(input: PersonalOutfitPromptInput): string[] {
  const parts = [buildCompactStyleModeLine(input.stylistPreferences.styleExperiment)];

  const fit = encodeFitPreference(input.userParameters.fitPreference);

  if (fit) {
    parts.push(`fit=${fit}`);
  }

  if (input.userParameters.weatherSensitivity) {
    parts.push(`weatherSens=${encodeWeatherSensitivity(input.userParameters.weatherSensitivity)}`);
  }

  if (input.stylistPreferences.avoidRepeatedOutfits) {
    parts.push('avoidRepeat=1');
  }

  return [`PREFS: ${parts.join(' ')}`];
}

function buildCompactBehaviorSection(
  behavioralContext: BehavioralContextPayload,
  avoidRepeatedOutfits: boolean,
): string[] {
  const lines: string[] = [];

  if (behavioralContext.recentManualOutfits.length > 0) {
    lines.push(`manual=${formatCompactOutfitRefs(behavioralContext.recentManualOutfits)}`);
  }

  if (behavioralContext.recentSavedAiOutfits.length > 0) {
    lines.push(`saved=${formatCompactOutfitRefs(behavioralContext.recentSavedAiOutfits)}`);
  }

  if (avoidRepeatedOutfits && behavioralContext.recentOutfitSignatures.length > 0) {
    lines.push(`avoid=${behavioralContext.recentOutfitSignatures.join('|')}`);
  }

  const feedback = behavioralContext.outfitFeedback;

  if (feedback) {
    if (feedback.recentlyLikedItemIds.length > 0) {
      lines.push(`liked=${feedback.recentlyLikedItemIds.join(',')}`);
    }

    if (feedback.recentlyDislikedItemIds.length > 0) {
      lines.push(`disliked=${feedback.recentlyDislikedItemIds.join(',')}`);
    }

    if (feedback.stronglyDislikedItemIds.length > 0) {
      lines.push(`strongDislike=${feedback.stronglyDislikedItemIds.join(',')}`);
    }

    if (feedback.likedCombinations.length > 0) {
      lines.push(`likedCombo=${formatCompactOutfitRefs(feedback.likedCombinations)}`);
    }

    if (feedback.dislikedCombinations.length > 0) {
      lines.push(`dislikedCombo=${formatCompactOutfitRefs(feedback.dislikedCombinations)}`);
    }

    const reasonSummary = Object.entries(feedback.reasonCounts)
      .filter(([, count]) => count > 0)
      .map(([reason, count]) => `${reason}:${count}`)
      .join(',');

    if (reasonSummary) {
      lines.push(`reasons=${reasonSummary}`);
    }
  }

  if (lines.length === 0) {
    return [];
  }

  return ['BEHAVIOR:', ...lines];
}

function buildCompactTaskSection(input: PersonalOutfitPromptInput): string[] {
  if (input.isHomeMode) {
    return [
      'TASK: Pick 1 complete outfit for today.',
      'Prefer top+bottom+shoes when available.',
    ];
  }

  if (input.selectedItemId) {
    return [
      `TASK: Pick up to ${input.maxOutfits} distinct outfits including fixedItemId=${input.selectedItemId}.`,
      'Vary non-fixed main pieces across outfits when alternatives exist.',
    ];
  }

  return [
    `TASK: Pick up to ${input.maxOutfits} distinct outfits.`,
    'Vary main pieces across outfits when alternatives exist.',
  ];
}

export function buildCompactMatchingModeLines(matchingMode: PairedMatchingModeHint): string[] {
  switch (matchingMode) {
    case 'same_style':
      return ['PAIR_MODE=same_style', 'same style family; items may differ'];
    case 'colors':
      return ['PAIR_MODE=colors', 'prioritize color harmony; identical colors not required'];
    case 'photo':
      return ['PAIR_MODE=photo', 'photo harmony; avoid competing large prints/strong accents'];
    case 'natural':
    default:
      return ['PAIR_MODE=natural', 'soft coordination; compatible formality; not identical'];
  }
}

function buildCompactPairedRulesSection(): string[] {
  return [
    'PRIORITY: occasion > weather > category > prefs > behavior > pair harmony',
    'RULES:',
    '- A.ids from A only; B.ids from B only',
    '- max per person: bottom=1 shoes=1 outer=1 tops=2',
    '- fixed mandatory when present',
    '- wardrobeMode=owned-only',
    '- weather/occasion before behavior',
    '- return one outfit each',
    '- pairExplanation: 1-2 RU sentences',
  ];
}

function buildPairedPersonPreferenceLine(person: PairedOutfitPromptPersonInput): string {
  const parts = [`style=${person.stylistPreferences.styleExperiment}`];
  const fit = encodeFitPreference(person.userParameters.fitPreference);

  if (fit) {
    parts.push(`fit=${fit}`);
  }

  if (person.userParameters.weatherSensitivity) {
    parts.push(`weatherSens=${encodeWeatherSensitivity(person.userParameters.weatherSensitivity)}`);
  }

  return parts.join(' ');
}

function buildPairedPersonBehaviorLines(person: PairedOutfitPromptPersonInput): string[] {
  const behavior = buildCompactBehaviorSection(
    person.behavioralContext,
    person.stylistPreferences.avoidRepeatedOutfits,
  );

  if (behavior.length === 0) {
    return [];
  }

  return ['behavior:', ...behavior.slice(1)];
}

function buildPairedPersonSection(person: PairedOutfitPromptPersonInput): string[] {
  const lines = [`${person.label}:`, buildPairedPersonPreferenceLine(person)];

  if (person.fixedItemId) {
    lines.push(`fixed=${person.fixedItemId} mandatory`);
  }

  lines.push(...buildPairedPersonBehaviorLines(person));
  lines.push('items:', buildCompactWardrobeSummary(person.wardrobe));

  return lines;
}

export function buildPairedOutfitPromptText(input: PairedOutfitPromptInput): string {
  const lines = [
    'Stylist. Create ONE outfit for A and ONE for B using only listed wardrobe IDs.',
    '',
    ...buildCompactPairedRulesSection(),
    '',
    `OCCASION=${input.occasion}`,
    'Both outfits must fit occasion.',
    '',
    ...buildCompactMatchingModeLines(input.matchingMode),
  ];

  if (input.weather) {
    lines.push('', ...buildCompactWeatherSection(input.weather));
    lines.push('Apply shared weather with each person weatherSens.');
  } else {
    lines.push('', ...buildCompactWeatherUnavailableSection(input.considerWeather));
  }

  lines.push('', ...buildPairedPersonSection(input.personA), '', ...buildPairedPersonSection(input.personB));
  lines.push(
    '',
    'TASK: Return personA.itemIds, personB.itemIds, pairExplanation.',
    'Coordinate per PAIR_MODE; outfits need not match identically.',
  );

  return lines.join('\n');
}

export function buildPersonalOutfitPromptText(input: PersonalOutfitPromptInput): string {
  const lines = [
    'Stylist. Use ONLY wardrobe IDs below.',
    '',
    ...buildCompactRulesSection(input),
  ];

  if (input.weather) {
    lines.push('', ...buildCompactWeatherSection(input.weather));
  } else {
    lines.push('', ...buildCompactWeatherUnavailableSection(input.considerWeather));
  }

  lines.push('', ...buildCompactPreferencesSection(input));

  const behaviorLines = buildCompactBehaviorSection(
    input.behavioralContext,
    input.stylistPreferences.avoidRepeatedOutfits,
  );

  if (behaviorLines.length > 0) {
    lines.push('', ...behaviorLines);
  }

  lines.push('', 'WARDROBE', buildCompactWardrobeSummary(input.wardrobe), '', ...buildCompactTaskSection(input));

  return lines.join('\n');
}

export function buildCompactUserBehaviorSection(
  behavioralContext: BehavioralContextPayload,
  avoidRepeatedOutfits: boolean,
): string[] {
  return buildCompactBehaviorSection(behavioralContext, avoidRepeatedOutfits);
}

export function buildCompactStyleExperimentInstructions(styleExperiment: string): string[] {
  return [buildCompactStyleModeLine(styleExperiment as StylistPreferencesPayload['styleExperiment'])];
}

export function buildHomeSelectionRules(): string[] {
  return ['Prefer top+bottom+shoes when available.'];
}

export function estimatePromptTokens(prompt: string): number {
  return Math.ceil(prompt.length / 4);
}

export function logOutfitPromptUsage(params: {
  promptText: string;
  actualInputTokens?: number;
  actualOutputTokens?: number;
  actualTotalTokens?: number;
}): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  if (params.actualInputTokens === undefined) {
    return;
  }

  const estimated = estimatePromptTokens(params.promptText);
  const overheadRatio = (params.actualInputTokens / Math.max(estimated, 1)).toFixed(2);

  console.log(
    `[OUTFIT AI] usage input=${params.actualInputTokens} output=${params.actualOutputTokens ?? 0} total=${params.actualTotalTokens ?? 0} estimated=${estimated} actualInput=${params.actualInputTokens} overheadRatio=${overheadRatio}`,
  );
  console.log(
    `[OUTFIT AI COST] input=${params.actualInputTokens} output=${params.actualOutputTokens ?? 0}`,
  );
}

export function logPairedPromptUsage(params: {
  ownerTotal: number;
  ownerShortlist: number;
  memberTotal: number;
  memberShortlist: number;
  promptText: string;
  actualInputTokens?: number;
  actualOutputTokens?: number;
  actualTotalTokens?: number;
}): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const estimated = estimatePromptTokens(params.promptText);

  if (params.actualInputTokens === undefined) {
    console.log(
      `[PAIRED AI] owner total=${params.ownerTotal} shortlist=${params.ownerShortlist} member total=${params.memberTotal} shortlist=${params.memberShortlist} promptChars=${params.promptText.length} estimatedTokens=${estimated}`,
    );
    return;
  }

  const overheadRatio = (params.actualInputTokens / Math.max(estimated, 1)).toFixed(2);

  console.log(
    `[PAIRED AI] usage input=${params.actualInputTokens} output=${params.actualOutputTokens ?? 0} total=${params.actualTotalTokens ?? 0} estimated=${estimated} actualInput=${params.actualInputTokens} overheadRatio=${overheadRatio}`,
  );
  console.log(
    `[PAIRED AI COST] input=${params.actualInputTokens} output=${params.actualOutputTokens ?? 0}`,
  );
}

export {
  OutfitCandidateSelectionError,
  selectOutfitCandidates,
  summarizeCandidateSelection,
};
export type { OutfitCandidateMode, OutfitCandidateSelectionInput, PairedMatchingModeHint } from './candidate-selection';
