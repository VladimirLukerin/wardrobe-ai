import {
  checkAiRateLimit,
  getAiRateLimitBucketCountForTests,
  getAiRateLimitConfig,
  resetAiRateLimitsForTests,
  restoreAiRateLimitClockForTests,
} from '../src/ai-request-rate-limit';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function testAllowsRequestsUntilLimit(): void {
  resetAiRateLimitsForTests(() => 0);
  const config = getAiRateLimitConfig('photo');
  const userId = 'user-a';

  for (let index = 0; index < config.max; index += 1) {
    const result = checkAiRateLimit(userId, 'photo', index);

    assert(result.allowed, `Expected request ${index + 1} to be allowed`);
  }

  const blocked = checkAiRateLimit(userId, 'photo', config.max);

  assert(!blocked.allowed, 'Expected next request to be blocked');
  assert(blocked.retryAfterSeconds > 0, 'Expected retryAfterSeconds > 0');

  console.log('OK allows requests until limit');
}

function testNewWindowAllowsAgain(): void {
  resetAiRateLimitsForTests(() => 0);
  const config = getAiRateLimitConfig('suggest');
  const userId = 'user-window';

  for (let index = 0; index < config.max; index += 1) {
    checkAiRateLimit(userId, 'suggest', 0);
  }

  const blocked = checkAiRateLimit(userId, 'suggest', 0);

  assert(!blocked.allowed, 'Expected blocked request inside same window');

  const afterWindow = checkAiRateLimit(userId, 'suggest', config.windowMs);

  assert(afterWindow.allowed, 'Expected request to be allowed in a new window');

  console.log('OK new window allows again');
}

function testIndependentUsers(): void {
  resetAiRateLimitsForTests(() => 0);
  const config = getAiRateLimitConfig('daily');

  for (let index = 0; index < config.max; index += 1) {
    checkAiRateLimit('user-one', 'daily', 0);
  }

  const blockedForOne = checkAiRateLimit('user-one', 'daily', 0);
  const allowedForTwo = checkAiRateLimit('user-two', 'daily', 0);

  assert(!blockedForOne.allowed, 'Expected user-one to be blocked');
  assert(allowedForTwo.allowed, 'Expected user-two to remain allowed');

  console.log('OK independent users');
}

function testIndependentLimiterTypes(): void {
  resetAiRateLimitsForTests(() => 0);
  const photoConfig = getAiRateLimitConfig('photo');
  const userId = 'user-types';

  for (let index = 0; index < photoConfig.max; index += 1) {
    checkAiRateLimit(userId, 'photo', 0);
  }

  const blockedPhoto = checkAiRateLimit(userId, 'photo', 0);
  const allowedPaired = checkAiRateLimit(userId, 'paired', 0);

  assert(!blockedPhoto.allowed, 'Expected photo limiter to be blocked');
  assert(allowedPaired.allowed, 'Expected paired limiter to remain independent');

  console.log('OK independent limiter types');
}

function testExpiredEntriesAreRemoved(): void {
  resetAiRateLimitsForTests(() => 0);
  const config = getAiRateLimitConfig('paired');
  const userId = 'user-expire';

  checkAiRateLimit(userId, 'paired', 0);
  assert(getAiRateLimitBucketCountForTests() === 1, 'Expected one active bucket');

  checkAiRateLimit(userId, 'paired', config.windowMs + 1);
  assert(getAiRateLimitBucketCountForTests() === 1, 'Expected bucket count to stay bounded');

  checkAiRateLimit('another-user', 'paired', config.windowMs + 2);
  assert(
    getAiRateLimitBucketCountForTests() <= 2,
    'Expected expired buckets not to grow without bound',
  );

  console.log('OK expired entries are removed');
}

async function main(): Promise<void> {
  try {
    testAllowsRequestsUntilLimit();
    testNewWindowAllowsAgain();
    testIndependentUsers();
    testIndependentLimiterTypes();
    testExpiredEntriesAreRemoved();
    console.log('All AI rate limit tests passed.');
  } finally {
    restoreAiRateLimitClockForTests();
  }
}

void main();
