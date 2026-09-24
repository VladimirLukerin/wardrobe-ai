import {
  consumeAiRateLimit,
  getAiRateLimitBucketCountForTests,
  getAiRateLimitConfig,
  resetAiRateLimitsForTests,
  restoreAiRateLimitClockForTests,
} from '../src/ai-request-rate-limit';
import { selectOutfitCandidates } from '../src/outfit-ai/candidate-selection';
import {
  createImageFingerprint,
  resetProcessingCacheForTests,
  runCachedImageProcessing,
  seedProcessingCacheEntryForTests,
} from '../src/photo-processing/processing-cost-guard';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function testCandidateSelectionDoesNotConsumeBucket(): void {
  resetAiRateLimitsForTests(() => 0);
  selectOutfitCandidates({
    wardrobe: Array.from({ length: 40 }, (_, index) => ({
      id: `item-${index}`,
      name: `Item ${index}`,
      category: index % 2 === 0 ? 'футболка' : 'джинсы',
      color: 'чёрный',
      pattern: 'Без принта',
      printDescription: null,
      style: 'casual',
      isFavorite: false,
      wearCount: 0,
      lastWornAt: null,
    })),
    weather: null,
    stylistPreferences: {
      styleExperiment: 'balanced',
      considerWeather: false,
      wardrobeMode: 'owned-only',
      avoidRepeatedOutfits: false,
    },
    userParameters: {
      fitPreference: 'Обычная',
      weatherSensitivity: 'Обычно',
    },
    behavioralContext: {
      favoriteItemIds: [],
      frequentlyWorn: [],
      recentManualOutfits: [],
      recentSavedAiOutfits: [],
      recentOutfitSignatures: [],
    },
    mode: 'personal',
  });

  assert(
    getAiRateLimitBucketCountForTests() === 0,
    'Candidate selection alone should not consume suggest bucket',
  );
  console.log('OK candidate selection does not consume bucket');
}

async function testPhotoCacheHitDoesNotConsumeBucket(): Promise<void> {
  resetAiRateLimitsForTests(() => 0);
  resetProcessingCacheForTests();

  const fingerprint = createImageFingerprint(Buffer.from('cached-photo'));
  seedProcessingCacheEntryForTests(fingerprint, {
    expiresAt: Date.now() + 60_000,
    result: {
      accepted: false,
      rejectReason: 'item_not_clear',
      rejectMessage: 'test',
      confidence: 0.2,
      item: null,
    },
  });

  let processorCalls = 0;

  await runCachedImageProcessing(fingerprint, async () => {
    processorCalls += 1;
    consumeAiRateLimit('user-photo', 'photo');
    return {
      accepted: false,
      rejectReason: 'item_not_clear',
      rejectMessage: 'test',
      confidence: 0.2,
      item: null,
    };
  });

  assert(processorCalls === 0, 'Cached photo should not invoke processor/rate limit');
  assert(
    getAiRateLimitBucketCountForTests() === 0,
    'Photo cache hit should not consume photo bucket',
  );
  console.log('OK photo cache hit does not consume bucket');
}

function testActualProviderCallConsumesOne(): void {
  resetAiRateLimitsForTests(() => 0);
  const config = getAiRateLimitConfig('daily');

  for (let index = 0; index < config.max; index += 1) {
    consumeAiRateLimit('user-real', 'daily', 0);
  }

  let blocked = false;

  try {
    consumeAiRateLimit('user-real', 'daily', 0);
  } catch {
    blocked = true;
  }

  assert(blocked, 'Bucket should block after max consumes');
  console.log('OK actual provider call consumes one');
}

async function main(): Promise<void> {
  try {
    testCandidateSelectionDoesNotConsumeBucket();
    await testPhotoCacheHitDoesNotConsumeBucket();
    testActualProviderCallConsumesOne();
    console.log('All rate limit placement tests passed.');
  } finally {
    restoreAiRateLimitClockForTests();
    resetProcessingCacheForTests();
  }
}

void main();
