import fs from 'fs/promises';

import sharp from 'sharp';

import {
  updateWardrobeOriginalImage,
  updateWardrobeProcessedImage,
} from '../db/wardrobe-item-images-repository';
import { getImageStorage } from '../storage/local-image-storage';
import {
  buildOriginalImageKey,
  buildProcessedImageKey,
  buildWardrobeStoragePrefix,
} from '../storage/storage-key';
import { ensureDevFixtureImage } from './ensure-fixture-image';
import type { FixtureImageMetadata } from './fixture-image-types';

export async function copyDevFixtureImagesToWardrobeStorage({
  userId,
  itemId,
  fixture,
  uploadedAt,
}: {
  userId: string;
  itemId: string;
  fixture: FixtureImageMetadata;
  uploadedAt: string;
}): Promise<{ originalKey: string; processedKey: string }> {
  const fixturePath = await ensureDevFixtureImage(fixture);
  const processedBuffer = await fs.readFile(fixturePath);
  const prefix = buildWardrobeStoragePrefix(userId, itemId);
  const processedKey = buildProcessedImageKey(prefix);
  const originalKey = buildOriginalImageKey(prefix, '.jpg');
  const storage = getImageStorage();

  await storage.put(processedKey, processedBuffer, 'image/png');
  await updateWardrobeProcessedImage({
    userId,
    itemId,
    storageKey: processedKey,
    contentType: 'image/png',
    uploadedAt,
  });

  const originalBuffer = await sharp(processedBuffer)
    .flatten({ background: '#F5F5F5' })
    .jpeg({ quality: 90 })
    .toBuffer();

  await storage.put(originalKey, originalBuffer, 'image/jpeg');
  await updateWardrobeOriginalImage({
    userId,
    itemId,
    storageKey: originalKey,
    contentType: 'image/jpeg',
    uploadedAt,
  });

  return { originalKey, processedKey };
}
