import fs from 'fs/promises';
import path from 'path';

import type { FixtureImageMetadata } from './fixture-image-types';
import { writeFixturePng } from './generate-fixture-image';
import { getDevFixtureImagesDir } from './paths';

export async function devFixtureImageExists(imageFileName: string): Promise<boolean> {
  const targetPath = path.join(getDevFixtureImagesDir(), imageFileName);

  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDevFixtureImage(metadata: FixtureImageMetadata): Promise<string> {
  const imagesDir = getDevFixtureImagesDir();
  await fs.mkdir(imagesDir, { recursive: true });

  const targetPath = path.join(imagesDir, metadata.image);

  if (await devFixtureImageExists(metadata.image)) {
    return targetPath;
  }

  await writeFixturePng(metadata, targetPath);

  return targetPath;
}

export async function generateDevFixtureImageIfMissing(
  metadata: FixtureImageMetadata,
): Promise<'created' | 'skipped'> {
  if (await devFixtureImageExists(metadata.image)) {
    return 'skipped';
  }

  await ensureDevFixtureImage(metadata);

  return 'created';
}
