import { RateLimitError } from 'openai';

import {
  BEHAVIORAL_CAPS,
  buildCompactWardrobeSummary,
  buildLegacyWardrobeSummary,
  capBehavioralContext,
  estimatePromptTokens,
  MAX_AI_WARDROBE_ITEMS,
  selectWardrobeForAi,
} from '../src/outfit-ai/prompt-optimization';
import {
  AI_PROVIDER_RATE_LIMIT_CODE,
  AI_PROVIDER_RATE_LIMIT_MESSAGE,
  isOpenAiProviderRateLimitError,
  parseRetryAfterSecondsFromProviderError,
} from '../src/outfit-ai/provider-rate-limit';
import type { BehavioralContextPayload, WardrobeItemPayload } from '../src/suggest-outfits';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function createFixtureItem(overrides: Partial<WardrobeItemPayload> & Pick<WardrobeItemPayload, 'id'>): WardrobeItemPayload {
  return {
    name: 'Item',
    category: 'футболка',
    color: 'чёрный',
    pattern: 'Без принта',
    printDescription: null,
    style: 'casual',
    isFavorite: false,
    wearCount: 0,
    lastWornAt: null,
    ...overrides,
  };
}

function createFixtureWardrobe(count: number): WardrobeItemPayload[] {
  const categories = ['футболка', 'джинсы', 'кроссовки', 'куртка', 'сумка'];

  return Array.from({ length: count }, (_, index) =>
    createFixtureItem({
      id: `item-${index}`,
      name: `Item ${index}`,
      category: categories[index % categories.length] ?? 'футболка',
      color: index % 2 === 0 ? 'чёрный' : 'белый',
      isFavorite: index % 17 === 0,
      wearCount: index % 5,
      lastWornAt: index % 3 === 0 ? '2026-09-18T10:00:00.000Z' : null,
    }),
  );
}

function testCompactWardrobeSummaryIsShorter(): void {
  const wardrobe = createFixtureWardrobe(12);
  const legacy = buildLegacyWardrobeSummary(wardrobe);
  const compact = buildCompactWardrobeSummary(wardrobe);

  assert(compact.length < legacy.length, 'Compact wardrobe summary should be shorter than legacy');
  assert(
    compact.length / legacy.length <= 0.7,
    `Expected at least ~30% reduction, got ${Math.round((1 - compact.length / legacy.length) * 100)}%`,
  );

  console.log(
    `OK compact wardrobe summary (${legacy.length} -> ${compact.length} chars, ${estimatePromptTokens(legacy)} -> ${estimatePromptTokens(compact)} est. tokens)`,
  );
}

function testNullAndDefaultFieldsOmitted(): void {
  const line = buildCompactWardrobeSummary([
    createFixtureItem({
      id: 'plain-item',
      name: 'Plain tee',
      category: 'футболка',
      color: 'белый',
      pattern: 'Без принта',
      printDescription: null,
      style: 'casual',
      isFavorite: false,
      wearCount: 0,
      lastWornAt: null,
    }),
  ]);

  const lines = line.split('\n');
  const itemLine = lines[lines.length - 1] ?? '';

  assert(!itemLine.includes('fav='), 'Default favorite flag should be omitted');
  assert(!itemLine.includes('wear=0'), 'Zero wear count should be omitted');
  assert(!itemLine.includes('last='), 'Null last worn should be omitted');
  assert(!itemLine.includes('print='), 'Empty print should be omitted');

  console.log('OK null/default wardrobe fields omitted');
}

function testWardrobeSelectionRespectsMaxAndSelectedItem(): void {
  const wardrobe = createFixtureWardrobe(140);
  const selectedItemId = 'item-139';

  const selected = selectWardrobeForAi(wardrobe, {
    selectedItemId,
    favoriteItemIds: wardrobe.filter((item) => item.isFavorite).map((item) => item.id),
    frequentlyWorn: wardrobe.slice(0, 25).map((item) => ({
      id: item.id,
      wearCount: item.wearCount,
      lastWornAt: item.lastWornAt,
    })),
  });

  assert(selected.length <= MAX_AI_WARDROBE_ITEMS, 'Selected wardrobe should respect max size');
  assert(
    selected.some((item) => item.id === selectedItemId),
    'Selected item must never be dropped',
  );

  console.log('OK wardrobe selection max and selected item preserved');
}

function testBehavioralContextCaps(): void {
  const capped = capBehavioralContext({
    favoriteItemIds: Array.from({ length: 30 }, (_, index) => `fav-${index}`),
    frequentlyWorn: Array.from({ length: 30 }, (_, index) => ({
      id: `wear-${index}`,
      wearCount: index,
      lastWornAt: null,
    })),
    recentManualOutfits: Array.from({ length: 10 }, (_, index) => ({
      itemIds: [`manual-${index}`],
    })),
    recentSavedAiOutfits: Array.from({ length: 10 }, (_, index) => ({
      itemIds: [`ai-${index}`],
    })),
    recentOutfitSignatures: Array.from({ length: 20 }, (_, index) => `sig-${index}`),
    outfitFeedback: {
      recentlyLikedItemIds: Array.from({ length: 20 }, (_, index) => `like-${index}`),
      recentlyDislikedItemIds: Array.from({ length: 20 }, (_, index) => `dislike-${index}`),
      likedCombinations: Array.from({ length: 10 }, (_, index) => ({ itemIds: [`lc-${index}`] })),
      dislikedCombinations: Array.from({ length: 10 }, (_, index) => ({ itemIds: [`dc-${index}`] })),
      stronglyDislikedItemIds: Array.from({ length: 20 }, (_, index) => `strong-${index}`),
      reasonCounts: { item_disliked: 2 },
    },
  });

  assert(capped.favoriteItemIds.length === BEHAVIORAL_CAPS.favoriteItemIds);
  assert(capped.frequentlyWorn.length === BEHAVIORAL_CAPS.frequentlyWorn);
  assert(capped.recentManualOutfits.length === BEHAVIORAL_CAPS.recentManualOutfits);
  assert(capped.recentSavedAiOutfits.length === BEHAVIORAL_CAPS.recentSavedAiOutfits);
  assert(capped.recentOutfitSignatures.length === BEHAVIORAL_CAPS.recentOutfitSignatures);
  assert(capped.outfitFeedback?.recentlyLikedItemIds.length === BEHAVIORAL_CAPS.recentlyLikedItemIds);
  assert(capped.outfitFeedback?.likedCombinations.length === BEHAVIORAL_CAPS.likedCombinations);

  console.log('OK behavioral context caps');
}

function testProviderRateLimitParser(): void {
  const retryAfterError = new RateLimitError(429, undefined, 'Rate limit exceeded', {
    'retry-after': '12',
  });
  const retryAfterMsError = new RateLimitError(429, undefined, 'Rate limit exceeded', {
    'retry-after-ms': '2500',
  });
  const fallbackError = new RateLimitError(429, undefined, 'Rate limit exceeded', {});

  assert(isOpenAiProviderRateLimitError(retryAfterError), 'Expected RateLimitError to match');
  assert(parseRetryAfterSecondsFromProviderError(retryAfterError) === 12, 'Expected retry-after seconds');
  assert(parseRetryAfterSecondsFromProviderError(retryAfterMsError) === 3, 'Expected retry-after-ms conversion');
  assert(parseRetryAfterSecondsFromProviderError(fallbackError) >= 1, 'Expected fallback retry seconds');

  console.log('OK provider 429 parser');
}

function testProviderRateLimitContract(): void {
  assert(AI_PROVIDER_RATE_LIMIT_CODE === 'ai_provider_rate_limited', 'Expected provider code');
  assert(
    AI_PROVIDER_RATE_LIMIT_MESSAGE.includes('AI'),
    'Expected safe user-facing provider message',
  );
  assert(!AI_PROVIDER_RATE_LIMIT_MESSAGE.includes('TPM'), 'Message must not expose provider limits');

  console.log('OK provider rate limit response contract');
}

function main(): void {
  testCompactWardrobeSummaryIsShorter();
  testNullAndDefaultFieldsOmitted();
  testWardrobeSelectionRespectsMaxAndSelectedItem();
  testBehavioralContextCaps();
  testProviderRateLimitParser();
  testProviderRateLimitContract();
  console.log('All outfit AI prompt/rate-limit tests passed.');
}

main();
