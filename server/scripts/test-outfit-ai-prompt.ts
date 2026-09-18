import { RateLimitError } from 'openai';

import {
  BEHAVIORAL_CAPS,
  buildCompactStyleModeLine,
  buildCompactWardrobeSummary,
  buildCompactWeatherSection,
  buildLegacyWardrobeSummary,
  buildPersonalOutfitPromptText,
  capBehavioralContext,
  estimatePromptTokens,
  MAX_AI_WARDROBE_ITEMS,
  selectWardrobeForAi,
  type PersonalOutfitPromptInput,
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

function createRepresentativeNineItemPromptInput(): PersonalOutfitPromptInput {
  const wardrobe = Array.from({ length: 9 }, (_, index) =>
    createFixtureItem({
      id: `item-${index}`,
      name: `Item ${index}`,
      category: ['футболка', 'джинсы', 'кроссовки', 'куртка', 'сумка', 'рубашка', 'ботинки', 'худи', 'юбка'][index] ?? 'футболка',
      color: index % 2 === 0 ? 'чёрный' : 'белый',
      wearCount: index < 4 ? index + 1 : 0,
      lastWornAt: index < 4 ? '2026-09-10T00:00:00.000Z' : null,
    }),
  );

  const behavioralContext: BehavioralContextPayload = {
    favoriteItemIds: [],
    frequentlyWorn: wardrobe.slice(0, 4).map((item) => ({
      id: item.id,
      wearCount: item.wearCount,
      lastWornAt: item.lastWornAt,
    })),
    recentManualOutfits: [],
    recentSavedAiOutfits: [
      { itemIds: ['item-0', 'item-1', 'item-2'] },
      { itemIds: ['item-3', 'item-4', 'item-5'] },
      { itemIds: ['item-1', 'item-6', 'item-7'] },
    ],
    recentOutfitSignatures: [],
  };

  return {
    wardrobe,
    weather: {
      temperatureC: 12,
      apparentTemperatureC: 9,
      precipitationMm: 0.4,
      weatherCode: 3,
      windSpeedKmh: 22,
    },
    considerWeather: true,
    stylistPreferences: {
      styleExperiment: 'balanced',
      considerWeather: true,
      wardrobeMode: 'owned-only',
      avoidRepeatedOutfits: true,
    },
    userParameters: {
      fitPreference: 'Обычная',
      weatherSensitivity: 'Обычно',
    },
    behavioralContext,
    isHomeMode: true,
    maxOutfits: 1,
  };
}

function buildLegacyVerbosePersonalPrompt(input: PersonalOutfitPromptInput): string {
  const lines = [
    'You are a stylist assembling outfits ONLY from the provided wardrobe.',
    '',
    'SIGNAL PRIORITY (highest to lowest):',
    '1. weather appropriateness / physical comfort;',
    '2. category compatibility (no conflicting items);',
    '3. explicit user preferences (styleExperiment, fitPreference, weatherSensitivity, wardrobeMode);',
    '4. behavioral signals (favorites, wear history, saved outfits);',
    '5. variety / avoiding unnecessary repetition.',
    '',
    'Behavioral signals are preferences, NOT hard constraints.',
    '',
    'A. HARD RULES',
    '- Use ONLY existing item ids from wardrobe. Never invent items.',
    '- Category conflicts are forbidden (max 1 bottom, max 1 shoes, max 1 outerwear, max 2 tops).',
    '- Pick one coherent outfit from existing items.',
    '- Return exactly 1 outfit.',
    '- Do not return identical item sets in different order.',
  ];

  if (input.weather) {
    lines.push(
      '',
      'B. CURRENT WEATHER',
      `- actual temperature: ${input.weather.temperatureC}°C`,
      `- feels like (apparent): ${input.weather.apparentTemperatureC}°C`,
      `- precipitation: ${input.weather.precipitationMm} mm`,
      `- wind: ${input.weather.windSpeedKmh} km/h`,
      '- conditions: cloudy',
      '- apparent temperature differs noticeably — prioritize feels like for comfort when choosing layers.',
      '- Weather is a strong factor, but use ONLY existing wardrobe items.',
      '- Do not pick weather-inappropriate items just because they are favorites or often worn.',
    );
  }

  lines.push(
    '',
    'C. USER PREFERENCES',
    `styleExperiment: ${input.stylistPreferences.styleExperiment}`,
    `considerWeather: ${input.stylistPreferences.considerWeather}`,
    `wardrobeMode: ${input.stylistPreferences.wardrobeMode}`,
    `avoidRepeatedOutfits: ${input.stylistPreferences.avoidRepeatedOutfits}`,
    '',
    'wardrobeMode owned-only: use ONLY items from wardrobe.',
    '',
    'fitPreference: neutral — no extra fit bias beyond wardrobe metadata.',
    '',
    'Чувствительность к погоде: обычная.',
    'Не добавляй дополнительную температурную коррекцию сверх фактической погоды.',
    '',
    'D. USER BEHAVIOR (soft signals; weather/category win)',
    `favorites: [${input.behavioralContext.favoriteItemIds.join(', ') || 'none'}]`,
    'frequentlyWorn:',
    ...input.behavioralContext.frequentlyWorn.map((entry) => `- ${entry.id}|wear=${entry.wearCount}|last=${entry.lastWornAt?.slice(0, 10) ?? ''}`),
    'recentManualOutfits:',
    '- none',
    'recentSavedAiOutfits:',
    ...input.behavioralContext.recentSavedAiOutfits.map((outfit) => `- [${outfit.itemIds.join(',')}]`),
    '',
    'E. AVAILABLE WARDROBE',
    buildLegacyWardrobeSummary(input.wardrobe),
    '',
    'F. TASK',
    'Pick exactly ONE complete outfit for today from wardrobe.',
    'Selection rules:',
    '- Use ONLY wardrobe ids; max 1 bottom, 1 shoes, 1 outerwear, up to 2 tops.',
    '- Prefer complete outfit: top + bottom + shoes when available.',
    '- Match weather and user preferences when data is present.',
    '',
    'description: one short Russian sentence, max 140 chars, no lists, no title repeat.',
    'Explain real item pairing by color/style/layers. Mention weather only if weather data was provided.',
    'Do not invent materials, comfort, warmth, or user circumstances.',
  );

  return lines.join('\n');
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
  assert(!itemLine.includes('Plain tee'), 'Name should be omitted from compact wardrobe line');

  console.log('OK null/default wardrobe fields omitted');
}

function testCompactWeatherIsShorter(): void {
  const weather = {
    temperatureC: 12,
    apparentTemperatureC: 9,
    precipitationMm: 0.4,
    weatherCode: 3,
    windSpeedKmh: 22,
  };
  const compact = buildCompactWeatherSection(weather).join('\n');
  const verbose = [
    'B. CURRENT WEATHER',
    `- actual temperature: ${weather.temperatureC}°C`,
    `- feels like (apparent): ${weather.apparentTemperatureC}°C`,
    `- precipitation: ${weather.precipitationMm} mm`,
    `- wind: ${weather.windSpeedKmh} km/h`,
    '- conditions: cloudy',
    '- apparent temperature differs noticeably — prioritize feels like for comfort when choosing layers.',
    '- Weather is a strong factor, but use ONLY existing wardrobe items.',
    '- Do not pick weather-inappropriate items just because they are favorites or often worn.',
  ].join('\n');

  assert(compact.length < verbose.length, 'Compact weather should be shorter than verbose weather');
  console.log(`OK compact weather (${verbose.length} -> ${compact.length} chars)`);
}

function testCompactStyleInstructions(): void {
  assert(buildCompactStyleModeLine('familiar').includes('STYLE_MODE=familiar'), 'Expected familiar mode');
  assert(buildCompactStyleModeLine('bold').includes('STYLE_MODE=bold'), 'Expected bold mode');
  assert(buildCompactStyleModeLine('balanced').includes('STYLE_MODE=balanced'), 'Expected balanced mode');
  console.log('OK compact style instructions');
}

function testEmptyBehaviorSectionsOmitted(): void {
  const prompt = buildPersonalOutfitPromptText({
    ...createRepresentativeNineItemPromptInput(),
    behavioralContext: {
      favoriteItemIds: [],
      frequentlyWorn: [],
      recentManualOutfits: [],
      recentSavedAiOutfits: [],
      recentOutfitSignatures: [],
    },
  });

  assert(!prompt.includes('favorites:'), 'Empty favorites list should be omitted');
  assert(!prompt.includes('frequentlyWorn'), 'Empty frequently worn section should be omitted');
  assert(!prompt.includes('manual='), 'Empty manual outfits should be omitted');
  assert(!prompt.includes('BEHAVIOR:'), 'Fully empty behavior should omit section');
  console.log('OK empty behavioral sections omitted');
}

function testNoDuplicateFavoriteRepresentation(): void {
  const wardrobe = [
    createFixtureItem({ id: 'fav-item', category: 'футболка', isFavorite: true, wearCount: 3 }),
  ];
  const prompt = buildPersonalOutfitPromptText({
    wardrobe,
    weather: null,
    considerWeather: false,
    stylistPreferences: {
      styleExperiment: 'familiar',
      considerWeather: false,
      wardrobeMode: 'owned-only',
      avoidRepeatedOutfits: false,
    },
    userParameters: { fitPreference: null, weatherSensitivity: null },
    behavioralContext: {
      favoriteItemIds: ['fav-item'],
      frequentlyWorn: [{ id: 'fav-item', wearCount: 3, lastWornAt: null }],
      recentManualOutfits: [],
      recentSavedAiOutfits: [],
      recentOutfitSignatures: [],
    },
    isHomeMode: true,
    maxOutfits: 1,
  });

  assert(prompt.includes('fav=1'), 'Favorite flag should remain on wardrobe item');
  assert(!prompt.includes('favorites='), 'Separate favorites list should be omitted');
  assert(!prompt.includes('frequent='), 'Separate frequently worn list should be omitted');
  console.log('OK duplicate favorites representation removed');
}

function testFixedItemRemainsExplicit(): void {
  const prompt = buildPersonalOutfitPromptText({
    ...createRepresentativeNineItemPromptInput(),
    selectedItemId: 'item-2',
    selectedItemName: 'Sneakers',
    isHomeMode: false,
    maxOutfits: 3,
  });

  assert(prompt.includes('fixedItemId=item-2 mandatory'), 'Fixed item must remain explicit');
  assert(prompt.includes('bottom=1'), 'Category limits must remain');
  console.log('OK fixed item remains explicit');
}

function testRepresentativeNineItemPromptReduced(): void {
  const input = createRepresentativeNineItemPromptInput();
  const legacy = buildLegacyVerbosePersonalPrompt(input);
  const compact = buildPersonalOutfitPromptText(input);
  const reduction = 1 - compact.length / legacy.length;

  assert(
    reduction >= 0.3,
    `Expected >=30% promptChars reduction, got ${Math.round(reduction * 100)}% (${legacy.length} -> ${compact.length})`,
  );

  console.log(
    `OK representative 9-item prompt (${legacy.length} -> ${compact.length} chars, ${estimatePromptTokens(legacy)} -> ${estimatePromptTokens(compact)} est. tokens, ${Math.round(reduction * 100)}% reduction)`,
  );
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
  testCompactWeatherIsShorter();
  testCompactStyleInstructions();
  testEmptyBehaviorSectionsOmitted();
  testNoDuplicateFavoriteRepresentation();
  testFixedItemRemainsExplicit();
  testRepresentativeNineItemPromptReduced();
  testWardrobeSelectionRespectsMaxAndSelectedItem();
  testBehavioralContextCaps();
  testProviderRateLimitParser();
  testProviderRateLimitContract();
  console.log('All outfit AI prompt/rate-limit tests passed.');
}

main();
