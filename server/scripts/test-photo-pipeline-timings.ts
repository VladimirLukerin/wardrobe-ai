import fs from 'node:fs/promises';
import path from 'node:path';

import 'dotenv/config';
import sharp from 'sharp';

import { normalizeProcessedClothingImage } from '../src/normalize-processed-image';
import { removeBackgroundLocally } from '../src/providers/local-background-removal';
import { createProcessingImage } from '../src/photo-processing/create-processing-image';
import { prepareUploadedImage } from '../src/photo-processing/prepare-uploaded-image';
import { validateAndRecognizeClothingPhoto } from '../src/photo-processing/photo-validation-recognition';

async function readMetadata(label: string, buffer: Buffer) {
  const metadata = await sharp(buffer).metadata();

  console.log(
    `${label}: ${metadata.width}x${metadata.height}, orientation=${metadata.orientation ?? 'none'}`,
  );

  return metadata;
}

async function main() {
  const totalStartedAt = Date.now();

  const orientedImagePath =
    process.argv[2] ??
    path.join(
      process.cwd(),
      'data/wardrobe-images/75a2e29013a3c247c03ce1847f576e24ae67da36e6043cedb12c397224b2d4b7/original.jpg',
    );

  const rawBuffer = await fs.readFile(orientedImagePath);
  const rawMetadata = await sharp(rawBuffer).metadata();

  console.log(`Input: ${orientedImagePath}`);
  console.log(
    `Raw EXIF orientation=${rawMetadata.orientation ?? 1}, stored=${rawMetadata.width}x${rawMetadata.height}`,
  );

  const prepareStartedAt = Date.now();
  const prepared = await prepareUploadedImage(rawBuffer, 'image/jpeg');
  const prepareMs = Date.now() - prepareStartedAt;
  console.log(`[PHOTO TIMING] prepare=${prepareMs}ms`);
  console.log(`Prepared dimensions: ${prepared.width}x${prepared.height}`);

  if (prepared.height <= prepared.width) {
    console.error('FAIL orientation: expected portrait height > width after prepare');
    process.exitCode = 1;
  } else {
    console.log('PASS orientation: portrait dimensions after EXIF normalize');
  }

  const processingResizeStartedAt = Date.now();
  const processing = await createProcessingImage(prepared);
  const processingResizeMs = Date.now() - processingResizeStartedAt;
  console.log(`[PHOTO TIMING] processingResize=${processingResizeMs}ms`);

  let openAiMs = 0;

  if (process.env.OPENAI_API_KEY) {
    const openAiStartedAt = Date.now();
    const recognition = await validateAndRecognizeClothingPhoto(prepared.buffer, prepared.mimeType);
    openAiMs = Date.now() - openAiStartedAt;
    console.log(`[PHOTO TIMING] openai=${openAiMs}ms`);
    console.log(
      `OpenAI item: pattern=${recognition.item?.pattern ?? 'null'}, printDescription=${recognition.item?.printDescription ?? 'null'}`,
    );
  } else {
    console.log('OPENAI_API_KEY missing, skipping openai timing');
  }

  const backgroundRemovalStartedAt = Date.now();
  const removedBackground = await removeBackgroundLocally(processing.buffer, processing.mimeType);
  const backgroundRemovalMs = Date.now() - backgroundRemovalStartedAt;
  console.log(`[PHOTO TIMING] backgroundRemoval=${backgroundRemovalMs}ms`);

  await readMetadata('Processed PNG', removedBackground);

  const normalizeStartedAt = Date.now();
  const normalized = await normalizeProcessedClothingImage(removedBackground);
  const normalizeMs = Date.now() - normalizeStartedAt;
  console.log(`[PHOTO TIMING] normalize=${normalizeMs}ms`);

  const normalizedMetadata = await readMetadata('Normalized PNG', normalized);

  if ((normalizedMetadata.height ?? 0) <= (normalizedMetadata.width ?? 0)) {
    console.error('FAIL orientation: processed image is not portrait');
    process.exitCode = 1;
  } else {
    console.log('PASS orientation: processed image stays portrait');
  }

  const outputPath = path.join(process.cwd(), 'data/test-oriented-background-removal.png');
  await fs.writeFile(outputPath, normalized);
  console.log(`Saved: ${outputPath}`);

  console.log(`[PHOTO TIMING] total=${Date.now() - totalStartedAt}ms`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
