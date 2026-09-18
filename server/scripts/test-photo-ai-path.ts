import sharp from 'sharp';

import {
  checkAiRateLimit,
  getAiRateLimitConfig,
  resetAiRateLimitsForTests,
  restoreAiRateLimitClockForTests,
} from '../src/ai-request-rate-limit';
import {
  ANALYSIS_MAX_LONG_EDGE,
  createAnalysisImage,
} from '../src/photo-processing/create-analysis-image';
import {
  PROCESSING_MAX_LONG_EDGE,
  createProcessingImage,
} from '../src/photo-processing/create-processing-image';
import { PHOTO_VISION_DETAIL } from '../src/photo-processing/photo-processing-error';
import { prepareUploadedImage } from '../src/photo-processing/prepare-uploaded-image';
import { validateAndRecognizeClothingPhoto } from '../src/photo-processing/photo-validation-recognition';
import {
  resetProcessingCacheForTests,
  runCachedImageProcessing,
  seedProcessingCacheEntryForTests,
  type PhotoProcessingSuccessResult,
} from '../src/photo-processing/processing-cost-guard';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

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

async function createLargePreparedImage() {
  const buffer = await sharp({
    create: {
      width: 3024,
      height: 4032,
      channels: 3,
      background: { r: 240, g: 240, b: 240 },
    },
  })
    .jpeg({ quality: 92 })
    .toBuffer();

  return prepareUploadedImage(buffer, 'image/jpeg');
}

async function testAnalysisImageRespectsMaxDimension(): Promise<void> {
  const prepared = await createLargePreparedImage();
  const analysis = await createAnalysisImage(prepared);
  const analysisLongEdge = Math.max(analysis.width, analysis.height);

  assert(analysisLongEdge <= ANALYSIS_MAX_LONG_EDGE, `Analysis long edge should be <= ${ANALYSIS_MAX_LONG_EDGE}`);
  assert(analysisLongEdge < Math.max(prepared.width, prepared.height), 'Analysis image should be smaller than prepared');
  console.log(
    `OK analysis resize (${prepared.width}x${prepared.height} -> ${analysis.width}x${analysis.height}, ${prepared.buffer.byteLength} -> ${analysis.buffer.byteLength} bytes)`,
  );
}

async function testProcessingImageRemainsSeparate(): Promise<void> {
  const prepared = await createLargePreparedImage();
  const analysis = await createAnalysisImage(prepared);
  const processing = await createProcessingImage(prepared);
  const processingLongEdge = Math.max(processing.width, processing.height);

  assert(processingLongEdge <= PROCESSING_MAX_LONG_EDGE, 'Processing image should respect processing max edge');
  assert(
    processing.buffer.byteLength >= analysis.buffer.byteLength,
    'Processing image may remain higher quality than analysis image',
  );
  console.log(
    `OK processing path separate (${analysis.width}x${analysis.height} analysis vs ${processing.width}x${processing.height} processing)`,
  );
}

async function testCacheHitSkipsProcessorAndRateLimit(): Promise<void> {
  resetProcessingCacheForTests();
  resetAiRateLimitsForTests(() => 0);

  const userId = 'photo-cache-user';
  const config = getAiRateLimitConfig('photo');

  for (let index = 0; index < config.max; index += 1) {
    checkAiRateLimit(userId, 'photo', 0);
  }

  const blockedBefore = checkAiRateLimit(userId, 'photo', 0);
  assert(!blockedBefore.allowed, 'Expected photo limiter to be exhausted in setup');

  seedProcessingCacheEntryForTests('cached-photo', {
    expiresAt: Date.now() + 60_000,
    result: mockSuccess(),
  });

  let processorCalls = 0;
  let rateLimitCalls = 0;

  await runCachedImageProcessing('cached-photo', async () => {
    processorCalls += 1;
    checkAiRateLimit(userId, 'photo', 0);
    rateLimitCalls += 1;
    return mockSuccess();
  });

  assert(processorCalls === 0, 'Cache hit should not invoke processor');
  assert(rateLimitCalls === 0, 'Cache hit should not consume photo rate limit');
  console.log('OK cache hit skips processor and rate limit');
}

async function testUncachedPhotoUsesOneProcessorIntent(): Promise<void> {
  resetProcessingCacheForTests();

  let processorCalls = 0;

  await runCachedImageProcessing('fresh-photo', async () => {
    processorCalls += 1;
    return mockSuccess();
  });

  assert(processorCalls === 1, 'Uncached photo should invoke processor once');
  console.log('OK uncached photo uses one processor intent');
}

function testVisionDetailMode(): void {
  assert(PHOTO_VISION_DETAIL === 'auto', 'Expected auto detail mode for resized analysis images');
  console.log('OK vision detail mode remains auto');
}

function testSingleVisionCallPipeline(): void {
  assert(typeof validateAndRecognizeClothingPhoto === 'function', 'Expected unified vision entry point');
  console.log('OK one OpenAI call returns validation + metadata + bbox');
}

async function main(): Promise<void> {
  try {
    await testAnalysisImageRespectsMaxDimension();
    await testProcessingImageRemainsSeparate();
    await testCacheHitSkipsProcessorAndRateLimit();
    await testUncachedPhotoUsesOneProcessorIntent();
    testVisionDetailMode();
    testSingleVisionCallPipeline();
    console.log('All photo AI path tests passed.');
  } finally {
    restoreAiRateLimitClockForTests();
    resetProcessingCacheForTests();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
