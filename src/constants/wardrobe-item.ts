export type ImageProcessingStatus = 'idle' | 'processing' | 'completed' | 'failed';

export const IMAGE_PROCESSING_STATUSES = [
  'idle',
  'processing',
  'completed',
  'failed',
] as const satisfies readonly ImageProcessingStatus[];

export type WardrobeItemImageFields = {
  originalImageUri: string;
  processedImageUri?: string;
  imageProcessingStatus: ImageProcessingStatus;
};

/** @deprecated Legacy field kept for in-memory compatibility during migration. */
export type LegacyWardrobeItemImageFields = {
  uri?: string;
};

import { localImageFileExists } from '@/utils/wardrobe-local-image-path';

const loggedDisplayImageItems = new Set<string>();

export function getWardrobeItemDisplayImageUri(
  item: WardrobeItemImageFields & LegacyWardrobeItemImageFields & { id?: string },
): string {
  if (item.processedImageUri && localImageFileExists(item.processedImageUri)) {
    if (__DEV__ && item.id && !loggedDisplayImageItems.has(item.id)) {
      loggedDisplayImageItems.add(item.id);
      console.log('[IMAGE CLIENT] display=processed');
    }

    return item.processedImageUri;
  }

  if (item.originalImageUri && localImageFileExists(item.originalImageUri)) {
    if (__DEV__ && item.id && !loggedDisplayImageItems.has(item.id)) {
      loggedDisplayImageItems.add(item.id);
      console.log('[IMAGE CLIENT] display=original');
    }

    return item.originalImageUri;
  }

  if (item.uri && localImageFileExists(item.uri)) {
    if (__DEV__ && item.id && !loggedDisplayImageItems.has(item.id)) {
      loggedDisplayImageItems.add(item.id);
      console.log('[IMAGE CLIENT] display=original');
    }

    return item.uri;
  }

  if (__DEV__ && item.id && !loggedDisplayImageItems.has(item.id)) {
    loggedDisplayImageItems.add(item.id);
    console.log('[IMAGE CLIENT] display=missing');
  }

  return '';
}

export function normalizeWardrobeItemImageFields(
  item: WardrobeItemImageFields & LegacyWardrobeItemImageFields,
): WardrobeItemImageFields {
  const originalImageUri = item.originalImageUri ?? item.uri ?? '';

  return {
    originalImageUri,
    processedImageUri: item.processedImageUri,
    imageProcessingStatus: item.imageProcessingStatus ?? 'idle',
  };
}
