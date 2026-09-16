import fs from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import { removeBackgroundLocally } from '../src/providers/local-background-removal';

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function readMemoryUsage() {
  const usage = process.memoryUsage();

  return {
    rss: usage.rss,
    heapUsed: usage.heapUsed,
    external: usage.external,
  };
}

async function hasTransparentPixels(pngBuffer: Buffer): Promise<boolean> {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });

  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 255) {
      return true;
    }
  }

  void info;
  return false;
}

async function runOnce(label: string, imageBuffer: Buffer, mimeType: string) {
  const memoryBefore = readMemoryUsage();
  const startedAt = Date.now();
  const result = await removeBackgroundLocally(imageBuffer, mimeType);
  const durationMs = Date.now() - startedAt;
  const memoryAfter = readMemoryUsage();
  const transparent = await hasTransparentPixels(result);

  console.log(`\n${label}`);
  console.log(`  durationMs=${durationMs}`);
  console.log(`  outputBytes=${result.byteLength}`);
  console.log(`  transparentBackground=${transparent}`);
  console.log(
    `  memory rss=${formatMb(memoryBefore.rss)} -> ${formatMb(memoryAfter.rss)}, heap=${formatMb(memoryBefore.heapUsed)} -> ${formatMb(memoryAfter.heapUsed)}`,
  );

  return { durationMs, result, transparent };
}

async function main() {
  const imagePath =
    process.argv[2] ??
    path.join(
      process.cwd(),
      'data/wardrobe-images/c2f445b7380170f49f05ecd93d93d68a01986774a785495ca4496a146a43e31f/original.jpg',
    );

  const imageBuffer = await fs.readFile(imagePath);
  const outputPath = path.join(process.cwd(), 'data/test-local-background-removal.png');

  console.log(`Input: ${imagePath}`);
  console.log(`Input size: ${formatMb(imageBuffer.byteLength)}`);
  console.log('Model: @imgly/background-removal-node medium (~80 MB assets)');

  const first = await runOnce('First run (cold start)', imageBuffer, 'image/jpeg');
  const second = await runOnce('Second run (warm cache)', imageBuffer, 'image/jpeg');

  await fs.writeFile(outputPath, first.result);
  console.log(`\nSaved sample output: ${outputPath}`);
  console.log(`First run: ${first.durationMs}ms, second run: ${second.durationMs}ms`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
