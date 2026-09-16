import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { removeBackground, type Config } from '@imgly/background-removal-node';
import fs from 'node:fs/promises';
import sharp from 'sharp';

import { createProcessingImage } from '../src/photo-processing/create-processing-image';
import { prepareUploadedImage } from '../src/photo-processing/prepare-uploaded-image';
import { normalizeProcessedClothingImage } from '../src/normalize-processed-image';

const require = createRequire(import.meta.url);

const MODEL_SIZES = {
  small: 44_342_436,
  medium: 88_188_479,
} as const;

type ModelName = keyof typeof MODEL_SIZES;

type WorkerResult = {
  model: ModelName;
  modelSizeBytes: number;
  preparedSize: { width: number; height: number };
  processingSize: { width: number; height: number };
  outputSize: { width: number; height: number };
  prepareMs: number;
  processingResizeMs: number;
  backgroundRemovalMs: number;
  normalizeMs: number;
  bgNormalizeTotalMs: number;
  peakRssMb: number;
  quality: {
    hasTransparency: boolean;
    transparentPixelRatio: number;
    semiTransparentEdgeRatio: number;
    outputBytes: number;
  };
  outputPath: string;
};

function resolveLocalBackgroundRemovalDistPath(): string {
  try {
    const packageEntry = require.resolve('@imgly/background-removal-node');

    return path.join(path.dirname(packageEntry), '..', 'dist');
  } catch {
    return path.join(process.cwd(), 'node_modules', '@imgly/background-removal-node', 'dist');
  }
}

function createModelConfig(model: ModelName): Config {
  const distPath = resolveLocalBackgroundRemovalDistPath();

  return {
    publicPath: `${pathToFileURL(distPath).href}/`,
    model,
    output: {
      format: 'image/png',
      quality: 0.9,
    },
    debug: process.env.NODE_ENV !== 'production',
  };
}

function trackPeakRss(): { stop: () => number } {
  let peakRss = process.memoryUsage().rss;
  const interval = setInterval(() => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
  }, 25);

  return {
    stop: () => {
      clearInterval(interval);
      return peakRss;
    },
  };
}

async function analyzeQuality(pngBuffer: Buffer) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });

  let transparentPixels = 0;
  let semiTransparentPixels = 0;

  for (let index = 3; index < data.length; index += 4) {
    const alpha = data[index];

    if (alpha === 0) {
      transparentPixels += 1;
    } else if (alpha < 255) {
      semiTransparentPixels += 1;
    }
  }

  const totalPixels = info.width * info.height;

  return {
    hasTransparency: transparentPixels > 0,
    transparentPixelRatio: transparentPixels / totalPixels,
    semiTransparentEdgeRatio: semiTransparentPixels / totalPixels,
    outputBytes: pngBuffer.byteLength,
  };
}

async function removeBackgroundWithModel(
  imageBuffer: Buffer,
  mimeType: string,
  model: ModelName,
): Promise<Buffer> {
  const config = createModelConfig(model);
  const imageBlob = new Blob([new Uint8Array(imageBuffer)], {
    type: mimeType || 'image/jpeg',
  });
  const resultBlob = await removeBackground(imageBlob, config);

  return Buffer.from(await resultBlob.arrayBuffer());
}

async function main() {
  const modelArg = process.argv[2];

  if (modelArg !== 'small' && modelArg !== 'medium') {
    console.error('Usage: tsx test-model-comparison-worker.ts <small|medium> [imagePath] [outputPath]');
    process.exit(1);
  }

  const model = modelArg;
  const imagePath =
    process.argv[3] ??
    path.join(
      process.cwd(),
      'data/wardrobe-images/75a2e29013a3c247c03ce1847f576e24ae67da36e6043cedb12c397224b2d4b7/original.jpg',
    );
  const outputPath =
    process.argv[4] ??
    path.join(process.cwd(), 'data/benchmark-model-comparison', `${model}-1600.png`);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const rawBuffer = await fs.readFile(imagePath);

  const prepareStartedAt = Date.now();
  const prepared = await prepareUploadedImage(rawBuffer, 'image/jpeg');
  const prepareMs = Date.now() - prepareStartedAt;

  const processingResizeStartedAt = Date.now();
  const processing = await createProcessingImage(prepared, 1600);
  const processingResizeMs = Date.now() - processingResizeStartedAt;

  const peakTracker = trackPeakRss();
  const bgNormalizeStartedAt = Date.now();

  const backgroundRemovalStartedAt = Date.now();
  const removedBackground = await removeBackgroundWithModel(
    processing.buffer,
    processing.mimeType,
    model,
  );
  const backgroundRemovalMs = Date.now() - backgroundRemovalStartedAt;

  const normalizeStartedAt = Date.now();
  const normalized = await normalizeProcessedClothingImage(removedBackground);
  const normalizeMs = Date.now() - normalizeStartedAt;

  const bgNormalizeTotalMs = Date.now() - bgNormalizeStartedAt;
  const peakRssMb = peakTracker.stop() / 1024 / 1024;

  await fs.writeFile(outputPath, normalized);

  const outputMetadata = await sharp(normalized).metadata();
  const quality = await analyzeQuality(normalized);

  const result: WorkerResult = {
    model,
    modelSizeBytes: MODEL_SIZES[model],
    preparedSize: { width: prepared.width, height: prepared.height },
    processingSize: { width: processing.width, height: processing.height },
    outputSize: {
      width: outputMetadata.width ?? 0,
      height: outputMetadata.height ?? 0,
    },
    prepareMs,
    processingResizeMs,
    backgroundRemovalMs,
    normalizeMs,
    bgNormalizeTotalMs,
    peakRssMb,
    quality,
    outputPath,
  };

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
