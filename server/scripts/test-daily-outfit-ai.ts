import {
  checkAiRateLimit,
  getAiRateLimitConfig,
  resetAiRateLimitsForTests,
  restoreAiRateLimitClockForTests,
} from '../src/ai-request-rate-limit';
import type { DailyOutfitResponse } from '../src/db/daily-outfits-repository';
import {
  buildDailyOutfitPromptText,
  buildPersonalOutfitPromptText,
  estimatePromptTokens,
  type DailyOutfitPromptInput,
  type PersonalOutfitPromptInput,
} from '../src/outfit-ai/prompt-optimization';
import { roundCoordinateForSignature } from '../src/daily-outfits/build-daily-outfit-input-signature';
import { resolveDailyGenerationDecision } from '../src/daily-outfits/resolve-daily-generation';
import { buildGuestWeatherAdvice } from '../../src/utils/guest-weather-advisor';
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

function createShortlist(count: number): WardrobeItemPayload[] {
  const categories = ['футболка', 'джинсы', 'кроссовки', 'куртка', 'рубашка', 'ботинки'];

  return Array.from({ length: count }, (_, index) =>
    createFixtureItem({
      id: `item-${index}`,
      name: `Item ${index}`,
      category: categories[index % categories.length] ?? 'футболка',
      color: index % 2 === 0 ? 'чёрный' : 'белый',
      isFavorite: index % 5 === 0,
      wearCount: index % 4,
      lastWornAt: index % 3 === 0 ? '2026-09-10T00:00:00.000Z' : null,
    }),
  );
}

function createDailyPromptInput(): DailyOutfitPromptInput {
  const wardrobe = createShortlist(12);
  const behavioralContext: BehavioralContextPayload = {
    favoriteItemIds: wardrobe.filter((item) => item.isFavorite).map((item) => item.id),
    frequentlyWorn: wardrobe.slice(0, 3).map((item) => ({
      id: item.id,
      wearCount: item.wearCount,
      lastWornAt: item.lastWornAt,
    })),
    recentManualOutfits: [{ itemIds: ['item-0', 'item-1', 'item-2'] }],
    recentSavedAiOutfits: [{ itemIds: ['item-1', 'item-3', 'item-4'] }],
    recentOutfitSignatures: ['item-0|item-1|item-2'],
  };

  return {
    wardrobe,
    weather: {
      temperatureC: 12,
      apparentTemperatureC: 9,
      precipitationMm: 0.2,
      weatherCode: 3,
      windSpeedKmh: 18,
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
  };
}

function createPersonalHomePromptInput(): PersonalOutfitPromptInput {
  const daily = createDailyPromptInput();

  return {
    ...daily,
    isHomeMode: true,
    maxOutfits: 1,
  };
}

function createExistingOutfit(signature = 'sig-1'): DailyOutfitResponse {
  return {
    id: 'outfit-1',
    localDate: '2026-09-18',
    itemIds: ['item-0', 'item-1', 'item-2'],
    description: 'Daily look',
    weather: null,
    inputSignature: signature,
    generatedAt: '2026-09-18T08:00:00.000Z',
  };
}

function testMissingEnabledUsesProvider(): void {
  const decision = resolveDailyGenerationDecision({
    manual: false,
    dailyStylistEnabled: true,
    existingOutfit: null,
    isStale: false,
  });

  assert(decision.action === 'provider', 'Expected provider for missing daily');
  assert(decision.reason === 'missing', 'Expected missing reason');
  console.log('OK missing + enabled → provider');
}

function testFreshEnabledSkipsProvider(): void {
  const outfit = createExistingOutfit();
  const decision = resolveDailyGenerationDecision({
    manual: false,
    dailyStylistEnabled: true,
    existingOutfit: outfit,
    isStale: false,
  });

  assert(decision.action === 'skip', 'Expected skip for fresh daily');
  assert(decision.reason === 'cache_fresh', 'Expected cache_fresh reason');
  assert(decision.outfit === outfit, 'Expected existing outfit returned');
  console.log('OK fresh + enabled → zero provider');
}

function testStaleEnabledUsesProvider(): void {
  const decision = resolveDailyGenerationDecision({
    manual: false,
    dailyStylistEnabled: true,
    existingOutfit: createExistingOutfit(),
    isStale: true,
  });

  assert(decision.action === 'provider', 'Expected provider for stale daily');
  assert(decision.reason === 'stale', 'Expected stale reason');
  console.log('OK stale + enabled → provider');
}

function testStaleDisabledSkipsProvider(): void {
  const outfit = createExistingOutfit();
  const decision = resolveDailyGenerationDecision({
    manual: false,
    dailyStylistEnabled: false,
    existingOutfit: outfit,
    isStale: true,
  });

  assert(decision.action === 'skip', 'Expected skip when daily disabled');
  assert(decision.reason === 'disabled', 'Expected disabled reason');
  assert(decision.outfit === outfit, 'Expected stale outfit preserved');
  console.log('OK stale + disabled → zero provider');
}

function testMissingDisabledSkipsProvider(): void {
  const decision = resolveDailyGenerationDecision({
    manual: false,
    dailyStylistEnabled: false,
    existingOutfit: null,
    isStale: false,
  });

  assert(decision.action === 'skip', 'Expected skip when missing and disabled');
  assert(decision.reason === 'disabled', 'Expected disabled reason');
  console.log('OK missing + disabled → zero provider');
}

function testManualRegenerateUsesProvider(): void {
  const decision = resolveDailyGenerationDecision({
    manual: true,
    dailyStylistEnabled: true,
    existingOutfit: createExistingOutfit(),
    isStale: false,
  });

  assert(decision.action === 'provider', 'Expected provider for manual regenerate');
  assert(decision.reason === 'manual', 'Expected manual reason');
  console.log('OK manual regenerate → provider');
}

async function testSimultaneousGenerationDedup(): Promise<void> {
  const inFlight = new Map<string, Promise<string>>();
  let providerCalls = 0;

  async function runGeneration(key: string): Promise<string> {
    const existing = inFlight.get(key);

    if (existing) {
      return existing;
    }

    const generationPromise = (async () => {
      providerCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 15));
      return 'generated';
    })().finally(() => {
      inFlight.delete(key);
    });

    inFlight.set(key, generationPromise);
    return generationPromise;
  }

  const key = 'user-a:2026-09-18';
  const [first, second] = await Promise.all([runGeneration(key), runGeneration(key)]);

  assert(first === 'generated', 'Expected first dedup follower to resolve generated outfit');
  assert(second === 'generated', 'Expected second dedup follower to resolve generated outfit');
  assert(providerCalls === 1, `Expected one provider intent, got ${providerCalls}`);
  assert(inFlight.size === 0, 'Expected in-flight map to clear after completion');
  console.log('OK simultaneous generation dedup → one provider intent');
}

function testLimiterNotConsumedOnFreshCacheDecision(): void {
  resetAiRateLimitsForTests(() => 0);
  const config = getAiRateLimitConfig('daily');
  const userId = 'fresh-cache-user';

  for (let index = 0; index < config.max; index += 1) {
    checkAiRateLimit(userId, 'daily', 0);
  }

  const blockedBefore = checkAiRateLimit(userId, 'daily', 0);
  assert(!blockedBefore.allowed, 'Expected daily limiter to be exhausted in setup');

  const decision = resolveDailyGenerationDecision({
    manual: false,
    dailyStylistEnabled: true,
    existingOutfit: createExistingOutfit(),
    isStale: false,
  });

  assert(decision.action === 'skip', 'Fresh cache should skip provider without touching limiter again');
  console.log('OK limiter not consumed on fresh cache decision path');
}

function testCompactDailyPromptShorterThanPersonalHome(): void {
  const dailyInput = createDailyPromptInput();
  const personalInput = createPersonalHomePromptInput();
  const dailyPrompt = buildDailyOutfitPromptText(dailyInput);
  const personalPrompt = buildPersonalOutfitPromptText(personalInput);

  assert(dailyPrompt.includes('MODE=daily'), 'Daily prompt should declare MODE=daily');
  assert(!dailyPrompt.includes('outfits=1 distinct'), 'Daily prompt should not include multi-outfit rules');
  assert(dailyPrompt.length < personalPrompt.length, 'Daily prompt should be shorter than personal home prompt');

  const reduction = 1 - dailyPrompt.length / personalPrompt.length;

  assert(
    reduction >= 0.1,
    `Expected meaningful daily prompt reduction, got ${Math.round(reduction * 100)}%`,
  );

  console.log(
    `OK compact daily prompt (${personalPrompt.length} -> ${dailyPrompt.length} chars, ${estimatePromptTokens(personalPrompt)} -> ${estimatePromptTokens(dailyPrompt)} est. tokens, ${Math.round(reduction * 100)}% reduction)`,
  );
}

function testDailyPromptRequestsOneOutfit(): void {
  const prompt = buildDailyOutfitPromptText(createDailyPromptInput());

  assert(prompt.includes('one complete outfit'), 'Daily rules should request one outfit');
  assert(prompt.includes('return one outfit for today'), 'Daily task should request one outfit');
  assert(!prompt.includes('Pick up to'), 'Daily prompt should not mention multiple outfits');
  console.log('OK daily returns one outfit only');
}

function testGuestWeatherAdviceNeverUsesDailyAi(): void {
  const advice = buildGuestWeatherAdvice({
    temperatureC: 8,
    apparentTemperatureC: 5,
    precipitationMm: 0,
    weatherCode: 3,
    windSpeedKmh: 12,
  });

  assert(typeof advice === 'string' && advice.length > 0, 'Guest advice should be deterministic text');
  assert(!advice.includes('OpenAI'), 'Guest advice must not reference AI provider');
  console.log('OK guest weather advice never reaches Daily AI');
}

function testLocationRoundingReducesGpsChurn(): void {
  assert(roundCoordinateForSignature(55.751244) === 55.8, 'Expected rounded latitude');
  assert(roundCoordinateForSignature(37.618423) === 37.6, 'Expected rounded longitude');
  assert(
    roundCoordinateForSignature(55.751244) === roundCoordinateForSignature(55.754),
    'Nearby GPS points should normalize to same bucket',
  );
  console.log('OK location rounding reduces GPS signature churn');
}

async function main(): Promise<void> {
  try {
    testMissingEnabledUsesProvider();
    testFreshEnabledSkipsProvider();
    testStaleEnabledUsesProvider();
    testStaleDisabledSkipsProvider();
    testMissingDisabledSkipsProvider();
    testManualRegenerateUsesProvider();
    await testSimultaneousGenerationDedup();
    testLimiterNotConsumedOnFreshCacheDecision();
    testCompactDailyPromptShorterThanPersonalHome();
    testDailyPromptRequestsOneOutfit();
    testGuestWeatherAdviceNeverUsesDailyAi();
    testLocationRoundingReducesGpsChurn();
    console.log('All Daily Stylist AI optimization tests passed.');
  } finally {
    restoreAiRateLimitClockForTests();
  }
}

void main();
