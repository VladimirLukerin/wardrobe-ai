import {
  getProcessingCacheSizeForTests,
  hasProcessingCacheEntryForTests,
  MAX_CACHE_ENTRIES,
  resetProcessingCacheForTests,
  runCachedImageProcessing,
  seedProcessingCacheEntryForTests,
  type PhotoProcessingRejectResult,
  type PhotoProcessingSuccessResult,
} from '../src/photo-processing/processing-cost-guard';
import { PHOTO_REJECT_REASONS } from '../src/photo-processing/photo-decision';

const mockSuccess = (): PhotoProcessingSuccessResult => ({
  accepted: true,
  rejectReason: null,
  confidence: 0.9,
  item: {
    baseName: 'Футболка',
    category: 'Футболка',
    color: 'Белый',
    pattern: 'Без принта',
    printDescription: null,
    style: 'Повседневный',
  },
  processedImage: Buffer.from('processed-image'),
});

const mockReject = (): PhotoProcessingRejectResult => ({
  accepted: false,
  rejectReason: PHOTO_REJECT_REASONS.NOT_CLOTHING,
  rejectMessage: 'Не похоже на одежду.',
  confidence: 0.2,
  item: null,
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function testDedup(): Promise<void> {
  resetProcessingCacheForTests();
  let processorCalls = 0;

  const first = runCachedImageProcessing('dedup-fingerprint', async () => {
    processorCalls += 1;
    await sleep(30);
    return mockSuccess();
  });
  const second = runCachedImageProcessing('dedup-fingerprint', async () => {
    processorCalls += 1;
    return mockSuccess();
  });

  await Promise.all([first, second]);

  if (processorCalls !== 1) {
    throw new Error(`Expected 1 processor call for dedup, got ${processorCalls}`);
  }

  console.log('OK dedup');
}

async function testCacheHit(): Promise<void> {
  resetProcessingCacheForTests();
  let processorCalls = 0;

  await runCachedImageProcessing('cache-hit-fingerprint', async () => {
    processorCalls += 1;
    return mockSuccess();
  });

  await runCachedImageProcessing('cache-hit-fingerprint', async () => {
    processorCalls += 1;
    return mockSuccess();
  });

  if (processorCalls !== 1) {
    throw new Error(`Expected cache hit without second processor call, got ${processorCalls}`);
  }

  console.log('OK cache hit');
}

async function testRejectionCleanup(): Promise<void> {
  resetProcessingCacheForTests();

  await runCachedImageProcessing('reject-fingerprint', () => Promise.reject(new Error('processing failed'))).catch(
    () => undefined,
  );

  if (getProcessingCacheSizeForTests() !== 0) {
    throw new Error('Expected rejected processing to remove cache entry');
  }

  let retryCalls = 0;
  await runCachedImageProcessing('reject-fingerprint', async () => {
    retryCalls += 1;
    return mockSuccess();
  });

  if (retryCalls !== 1) {
    throw new Error('Expected retry after rejection cleanup to call processor again');
  }

  console.log('OK rejection cleanup');
}

async function testMaxSize(): Promise<void> {
  resetProcessingCacheForTests();

  for (let index = 0; index < MAX_CACHE_ENTRIES + 50; index += 1) {
    await runCachedImageProcessing(`max-size-${index}`, async () => mockSuccess());
  }

  const size = getProcessingCacheSizeForTests();

  if (size > MAX_CACHE_ENTRIES) {
    throw new Error(`Expected cache size <= ${MAX_CACHE_ENTRIES}, got ${size}`);
  }

  console.log(`OK max size (${size} entries)`);
}

async function testExpiration(): Promise<void> {
  resetProcessingCacheForTests();

  seedProcessingCacheEntryForTests('expired-entry', {
    expiresAt: Date.now() - 1_000,
    result: mockReject(),
  });

  if (getProcessingCacheSizeForTests() !== 1) {
    throw new Error('Expected seeded expired cache entry');
  }

  await runCachedImageProcessing('fresh-entry', async () => mockSuccess());

  if (hasProcessingCacheEntryForTests('expired-entry')) {
    throw new Error('Expected expired cache entry to be removed');
  }

  console.log('OK expiration cleanup');
}

async function main(): Promise<void> {
  await testDedup();
  await testCacheHit();
  await testRejectionCleanup();
  await testMaxSize();
  await testExpiration();
  console.log('All processing-cost-guard checks passed.');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
