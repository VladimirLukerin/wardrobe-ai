import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import 'dotenv/config';

import { validateAndRecognizeClothingPhoto } from '../src/photo-processing/photo-validation-recognition';
import { createProcessingImage } from '../src/photo-processing/create-processing-image';
import { prepareUploadedImage } from '../src/photo-processing/prepare-uploaded-image';

type WorkerResult = {
  model: 'small' | 'medium';
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

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatModelSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function runWorker(model: 'small' | 'medium', imagePath: string, outputPath: string): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      ['tsx', 'scripts/test-model-comparison-worker.ts', model, imagePath, outputPath],
      {
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: 'development' },
        stdio: ['ignore', 'pipe', 'inherit'],
      },
    );

    let stdout = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.on('error', reject);

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker ${model} exited with code ${code}`));
        return;
      }

      const line = stdout
        .trim()
        .split('\n')
        .find((entry) => entry.startsWith('{'));

      if (!line) {
        reject(new Error(`Worker ${model} returned no JSON`));
        return;
      }

      resolve(JSON.parse(line) as WorkerResult);
    });
  });
}

function assessVisualQuality(candidate: WorkerResult, baseline: WorkerResult): string {
  const edgeDelta =
    candidate.quality.semiTransparentEdgeRatio - baseline.quality.semiTransparentEdgeRatio;
  const transparentDelta =
    candidate.quality.transparentPixelRatio - baseline.quality.transparentPixelRatio;

  if (!candidate.quality.hasTransparency) {
    return 'bad (no transparency)';
  }

  if (Math.abs(edgeDelta) <= 0.004 && Math.abs(transparentDelta) <= 0.02) {
    return '≈ medium';
  }

  if (edgeDelta < -0.015 || transparentDelta < -0.05) {
    return 'worse edges/mask';
  }

  if (edgeDelta > 0.015) {
    return 'softer edges';
  }

  return 'acceptable';
}

function assessDetailNotes(candidate: WorkerResult, baseline: WorkerResult): string {
  const visual = assessVisualQuality(candidate, baseline);

  if (visual === '≈ medium') {
    return 'collar/sleeves/print OK';
  }

  if (visual === 'acceptable' || visual === 'softer edges') {
    return 'minor edge differences';
  }

  return 'check collar/sleeves/holes';
}

async function main() {
  const imagePath =
    process.argv[2] ??
    path.join(
      process.cwd(),
      'data/wardrobe-images/75a2e29013a3c247c03ce1847f576e24ae67da36e6043cedb12c397224b2d4b7/original.jpg',
    );

  const outputDir = path.join(process.cwd(), 'data/benchmark-model-comparison');
  await fs.mkdir(outputDir, { recursive: true });

  console.log(`Input: ${imagePath}`);
  console.log('Pipeline: EXIF normalize -> processing@1600 -> background removal -> normalize');
  console.log('Running each model in an isolated process (concurrency=1)...\n');

  let openAiMs = 0;

  if (process.env.OPENAI_API_KEY) {
    const rawBuffer = await fs.readFile(imagePath);
    const prepared = await prepareUploadedImage(rawBuffer, 'image/jpeg');
    const openAiStartedAt = Date.now();
    await validateAndRecognizeClothingPhoto(prepared.buffer, prepared.mimeType);
    openAiMs = Date.now() - openAiStartedAt;
    console.log(`Shared OpenAI timing (same for both models): ${openAiMs}ms\n`);
  } else {
    console.log('OPENAI_API_KEY missing, total pipeline uses bg+normalize only.\n');
  }

  const medium = await runWorker(
    'medium',
    imagePath,
    path.join(outputDir, 'medium-1600.png'),
  );

  console.log(`Finished medium@1600: bg=${medium.backgroundRemovalMs}ms peakRSS=${medium.peakRssMb.toFixed(0)}MB`);

  const small = await runWorker(
    'small',
    imagePath,
    path.join(outputDir, 'small-1600.png'),
  );

  console.log(`Finished small@1600: bg=${small.backgroundRemovalMs}ms peakRSS=${small.peakRssMb.toFixed(0)}MB\n`);

  const sharedPrepareMs = medium.prepareMs;
  const sharedProcessingResizeMs = medium.processingResizeMs;

  function totalPipelineMs(result: WorkerResult): number {
    return sharedPrepareMs + sharedProcessingResizeMs + openAiMs + result.bgNormalizeTotalMs;
  }

  console.log('| metric | medium@1600 | small@1600 |');
  console.log('|---|---:|---:|');
  console.log(`| model size | ${formatModelSize(medium.modelSizeBytes)} | ${formatModelSize(small.modelSizeBytes)} |`);
  console.log(`| processing input | ${medium.processingSize.width}x${medium.processingSize.height} | ${small.processingSize.width}x${small.processingSize.height} |`);
  console.log(`| output size | ${medium.outputSize.width}x${medium.outputSize.height} | ${small.outputSize.width}x${small.outputSize.height} |`);
  console.log(`| backgroundRemoval | ${medium.backgroundRemovalMs} ms | ${small.backgroundRemovalMs} ms |`);
  console.log(`| normalize | ${medium.normalizeMs} ms | ${small.normalizeMs} ms |`);
  console.log(`| bg + normalize | ${medium.bgNormalizeTotalMs} ms | ${small.bgNormalizeTotalMs} ms |`);
  console.log(`| total photo pipeline | ${totalPipelineMs(medium)} ms | ${totalPipelineMs(small)} ms |`);
  console.log(`| peak RSS | ${medium.peakRssMb.toFixed(0)} MB | ${small.peakRssMb.toFixed(0)} MB |`);
  console.log(`| output bytes | ${formatMb(medium.quality.outputBytes)} | ${formatMb(small.quality.outputBytes)} |`);
  console.log(
    `| transparency | ${(medium.quality.transparentPixelRatio * 100).toFixed(1)}% | ${(small.quality.transparentPixelRatio * 100).toFixed(1)}% |`,
  );
  console.log(
    `| edge softness | ${(medium.quality.semiTransparentEdgeRatio * 100).toFixed(2)}% | ${(small.quality.semiTransparentEdgeRatio * 100).toFixed(2)}% |`,
  );
  console.log(`| visual quality | baseline | ${assessVisualQuality(small, medium)} |`);
  console.log(`| detail check | baseline | ${assessDetailNotes(small, medium)} |`);

  console.log(`\nSaved: ${medium.outputPath}`);
  console.log(`Saved: ${small.outputPath}`);

  if (small.peakRssMb > 800) {
    console.log('\nRISK: small@1600 peak RSS is still >800 MB — risky on a 1 GB RAM server.');
  }

  if (medium.peakRssMb > 800) {
    console.log('RISK: medium@1600 peak RSS is still >800 MB — risky on a 1 GB RAM server.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
