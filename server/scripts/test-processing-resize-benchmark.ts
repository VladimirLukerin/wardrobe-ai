import fs from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import { createProcessingImage } from '../src/photo-processing/create-processing-image';
import { prepareUploadedImage } from '../src/photo-processing/prepare-uploaded-image';
import { normalizeProcessedClothingImage } from '../src/normalize-processed-image';
import { removeBackgroundLocally } from '../src/providers/local-background-removal';

type ImageSize = {
  width: number;
  height: number;
};

type QualityMetrics = {
  hasTransparency: boolean;
  transparentPixelRatio: number;
  semiTransparentEdgeRatio: number;
  opaquePixelRatio: number;
  outputBytes: number;
};

type VariantResult = {
  label: string;
  inputSize: ImageSize;
  outputSize: ImageSize;
  backgroundRemovalMs: number;
  normalizeMs: number;
  totalMs: number;
  peakRssMb: number;
  quality: QualityMetrics;
  outputPath: string;
};

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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

async function analyzeQuality(pngBuffer: Buffer): Promise<QualityMetrics> {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });

  let transparentPixels = 0;
  let semiTransparentPixels = 0;
  let opaquePixels = 0;

  for (let index = 3; index < data.length; index += 4) {
    const alpha = data[index];

    if (alpha === 0) {
      transparentPixels += 1;
    } else if (alpha < 255) {
      semiTransparentPixels += 1;
    } else {
      opaquePixels += 1;
    }
  }

  const totalPixels = info.width * info.height;

  return {
    hasTransparency: transparentPixels > 0,
    transparentPixelRatio: transparentPixels / totalPixels,
    semiTransparentEdgeRatio: semiTransparentPixels / totalPixels,
    opaquePixelRatio: opaquePixels / totalPixels,
    outputBytes: pngBuffer.byteLength,
  };
}

async function runVariant(
  label: string,
  inputBuffer: Buffer,
  mimeType: string,
  outputPath: string,
): Promise<VariantResult> {
  const inputMetadata = await sharp(inputBuffer).metadata();
  const inputSize = {
    width: inputMetadata.width ?? 0,
    height: inputMetadata.height ?? 0,
  };

  const peakTracker = trackPeakRss();
  const totalStartedAt = Date.now();

  const backgroundRemovalStartedAt = Date.now();
  const removedBackground = await removeBackgroundLocally(inputBuffer, mimeType);
  const backgroundRemovalMs = Date.now() - backgroundRemovalStartedAt;

  const normalizeStartedAt = Date.now();
  const normalized = await normalizeProcessedClothingImage(removedBackground);
  const normalizeMs = Date.now() - normalizeStartedAt;

  const totalMs = Date.now() - totalStartedAt;
  const peakRssMb = peakTracker.stop() / 1024 / 1024;

  await fs.writeFile(outputPath, normalized);

  const outputMetadata = await sharp(normalized).metadata();
  const quality = await analyzeQuality(normalized);

  return {
    label,
    inputSize,
    outputSize: {
      width: outputMetadata.width ?? 0,
      height: outputMetadata.height ?? 0,
    },
    backgroundRemovalMs,
    normalizeMs,
    totalMs,
    peakRssMb,
    quality,
    outputPath,
  };
}

function assessVisualQuality(result: VariantResult, baseline: VariantResult): string {
  const edgeDelta =
    result.quality.semiTransparentEdgeRatio - baseline.quality.semiTransparentEdgeRatio;
  const transparentDelta =
    result.quality.transparentPixelRatio - baseline.quality.transparentPixelRatio;

  if (!result.quality.hasTransparency) {
    return 'bad (no transparency)';
  }

  if (Math.abs(edgeDelta) <= 0.003 && Math.abs(transparentDelta) <= 0.02) {
    return 'good (≈ full-res)';
  }

  if (edgeDelta < -0.01 || transparentDelta < -0.05) {
    return 'worse edges/mask';
  }

  if (edgeDelta > 0.01) {
    return 'softer edges';
  }

  return 'acceptable';
}

async function main() {
  const orientedImagePath =
    process.argv[2] ??
    path.join(
      process.cwd(),
      'data/wardrobe-images/75a2e29013a3c247c03ce1847f576e24ae67da36e6043cedb12c397224b2d4b7/original.jpg',
    );

  const rawBuffer = await fs.readFile(orientedImagePath);
  const prepared = await prepareUploadedImage(rawBuffer, 'image/jpeg');
  const processing1600 = await createProcessingImage(prepared, 1600);
  const processing2048 = await createProcessingImage(prepared, 2048);

  console.log(`Input: ${orientedImagePath}`);
  console.log(`Prepared: ${prepared.width}x${prepared.height}`);
  console.log(`Processing 1600: ${processing1600.width}x${processing1600.height}`);
  console.log(`Processing 2048: ${processing2048.width}x${processing2048.height}`);
  console.log('Warming model with 1600px run...');

  await runVariant(
    'warmup',
    processing1600.buffer,
    processing1600.mimeType,
    path.join(process.cwd(), 'data/benchmark-warmup.png'),
  );

  const outputDir = path.join(process.cwd(), 'data/benchmark-processing-resize');
  await fs.mkdir(outputDir, { recursive: true });

  const fullRes = await runVariant(
    'full-res',
    prepared.buffer,
    prepared.mimeType,
    path.join(outputDir, 'full-res.png'),
  );

  const resized1600 = await runVariant(
    '1600',
    processing1600.buffer,
    processing1600.mimeType,
    path.join(outputDir, '1600.png'),
  );

  const resized2048 = await runVariant(
    '2048',
    processing2048.buffer,
    processing2048.mimeType,
    path.join(outputDir, '2048.png'),
  );

  const results = [fullRes, resized1600, resized2048];

  console.log('\n| variant | input | output | backgroundRemoval | normalize | total | peak RSS | transparency | edge softness | visual |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---|---|---|');

  for (const result of results) {
    const visual = assessVisualQuality(result, fullRes);

    console.log(
      `| ${result.label} | ${result.inputSize.width}x${result.inputSize.height} | ${result.outputSize.width}x${result.outputSize.height} | ${result.backgroundRemovalMs}ms | ${result.normalizeMs}ms | ${result.totalMs}ms | ${result.peakRssMb.toFixed(0)} MB | ${(result.quality.transparentPixelRatio * 100).toFixed(1)}% | ${(result.quality.semiTransparentEdgeRatio * 100).toFixed(2)}% | ${visual} |`,
    );
  }

  console.log(`\nSaved outputs in ${outputDir}`);
  console.log(`Full-res bytes=${formatMb(fullRes.quality.outputBytes)}, 1600=${formatMb(resized1600.quality.outputBytes)}, 2048=${formatMb(resized2048.quality.outputBytes)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
