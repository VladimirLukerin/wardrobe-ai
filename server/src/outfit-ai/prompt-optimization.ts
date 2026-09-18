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

const WARDROBE_LEGEND =
  'id|name|category|color|pattern|style|optional: fav=1 wear=N last=YYYY-MM-DD print=...';

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

function formatCompactWardrobeItem(item: WardrobeItemPayload): string {
  const base = [item.id, item.name, item.category, item.color, item.pattern, item.style].join('|');
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

function formatCompactOutfitRef(outfit: CompactOutfitRef): string {
  const titlePart = outfit.title ? `@${outfit.title}` : '';

  return `[${outfit.itemIds.join(',')}]${titlePart}`;
}

function formatCompactOutfits(outfits: CompactOutfitRef[]): string {
  if (outfits.length === 0) {
    return '- none';
  }

  return outfits.map((outfit) => `- ${formatCompactOutfitRef(outfit)}`).join('\n');
}

function formatFrequentlyWornSummary(
  frequentlyWorn: BehavioralContextPayload['frequentlyWorn'],
): string {
  if (frequentlyWorn.length === 0) {
    return '- none';
  }

  return frequentlyWorn
    .map((entry) => {
      const parts = [`${entry.id}`, `wear=${entry.wearCount}`];

      if (entry.lastWornAt) {
        parts.push(`last=${entry.lastWornAt.slice(0, 10)}`);
      }

      return `- ${parts.join('|')}`;
    })
    .join('\n');
}

export function buildCompactUserBehaviorSection(
  behavioralContext: BehavioralContextPayload,
  avoidRepeatedOutfits: boolean,
  compact: boolean,
): string[] {
  const lines = compact
    ? [
        'D. USER BEHAVIOR (soft signals; weather/category win)',
        `favorites: [${behavioralContext.favoriteItemIds.join(', ') || 'none'}]`,
        'frequentlyWorn:',
        formatFrequentlyWornSummary(behavioralContext.frequentlyWorn),
        'recentManualOutfits:',
        formatCompactOutfits(behavioralContext.recentManualOutfits),
        'recentSavedAiOutfits:',
        formatCompactOutfits(behavioralContext.recentSavedAiOutfits),
      ]
    : [
        'D. USER BEHAVIOR',
        'Soft signals only; weather and category rules win.',
        `favoriteItemIds: [${behavioralContext.favoriteItemIds.join(', ') || 'none'}]`,
        'frequentlyWorn:',
        formatFrequentlyWornSummary(behavioralContext.frequentlyWorn),
        'recentManualOutfits:',
        formatCompactOutfits(behavioralContext.recentManualOutfits),
        'recentSavedAiOutfits:',
        formatCompactOutfits(behavioralContext.recentSavedAiOutfits),
      ];

  if (avoidRepeatedOutfits && behavioralContext.recentOutfitSignatures.length > 0) {
    lines.push(
      'avoidRepeatedOutfits:',
      ...behavioralContext.recentOutfitSignatures.map((signature) => `- ${signature}`),
    );
  }

  const feedback = behavioralContext.outfitFeedback;

  if (feedback) {
    const reasonSummary = Object.entries(feedback.reasonCounts)
      .filter(([, count]) => count > 0)
      .map(([reason, count]) => `${reason}:${count}`)
      .join(', ');

    lines.push(
      '',
      compact ? 'G. FEEDBACK (soft hints)' : 'G. RECENT OUTFIT FEEDBACK (soft hints)',
      `likedIds: [${feedback.recentlyLikedItemIds.join(', ') || 'none'}]`,
      `dislikedIds: [${feedback.recentlyDislikedItemIds.join(', ') || 'none'}]`,
      `stronglyDislikedIds: [${feedback.stronglyDislikedItemIds.join(', ') || 'none'}]`,
      'likedCombinations:',
      formatCompactOutfits(feedback.likedCombinations),
      'dislikedCombinations:',
      formatCompactOutfits(feedback.dislikedCombinations),
      `reasonCounts: ${reasonSummary || 'none'}`,
    );
  }

  return lines;
}

export function buildCompactStyleExperimentInstructions(styleExperiment: string): string[] {
  return [`styleExperiment: ${styleExperiment} (follow mode tone in title/description).`];
}

export function buildHomeSelectionRules(): string[] {
  return [
    'Selection rules:',
    '- Use ONLY wardrobe ids; max 1 bottom, 1 shoes, 1 outerwear, up to 2 tops.',
    '- Prefer complete outfit: top + bottom + shoes when available.',
    '- Match weather and user preferences when data is present.',
  ];
}

export function estimatePromptTokens(prompt: string): number {
  return Math.ceil(prompt.length / 4);
}

export {
  OutfitCandidateSelectionError,
  selectOutfitCandidates,
  summarizeCandidateSelection,
};
export type { OutfitCandidateMode, OutfitCandidateSelectionInput, PairedMatchingModeHint } from './candidate-selection';
