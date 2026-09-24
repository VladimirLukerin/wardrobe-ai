import {
  buildLocalImageFingerprint,
  localImageFileExists,
} from '@/utils/wardrobe-local-image-path';

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

export type WardrobeItemImageSourceKind = 'processed' | 'original' | 'missing';

export function getWardrobeItemImageSourceKind(
  item: WardrobeItemImageFields & LegacyWardrobeItemImageFields & { id?: string },
): WardrobeItemImageSourceKind {
  if (item.processedImageUri && localImageFileExists(item.processedImageUri)) {
    return 'processed';
  }

  if (item.originalImageUri && localImageFileExists(item.originalImageUri)) {
    return 'original';
  }

  if (item.uri && localImageFileExists(item.uri)) {
    return 'original';
  }

  return 'missing';
}

export function getWardrobeItemDisplayImageUri(
  item: WardrobeItemImageFields & LegacyWardrobeItemImageFields & { id?: string },
): string {
  if (item.processedImageUri && localImageFileExists(item.processedImageUri)) {
    return item.processedImageUri;
  }

  if (item.originalImageUri && localImageFileExists(item.originalImageUri)) {
    return item.originalImageUri;
  }

  if (item.uri && localImageFileExists(item.uri)) {
    return item.uri;
  }

  return '';
}

export function getWardrobeItemImageVersion(
  item: WardrobeItemImageFields & LegacyWardrobeItemImageFields,
): string {
  const processedFingerprint = item.processedImageUri
    ? buildLocalImageFingerprint(item.processedImageUri)
    : null;
  const originalFingerprint = item.originalImageUri
    ? buildLocalImageFingerprint(item.originalImageUri)
    : null;

  return `${processedFingerprint ?? 'none'}|${originalFingerprint ?? 'none'}`;
}

export function buildWardrobeImageExtraData(
  items: Array<WardrobeItemImageFields & LegacyWardrobeItemImageFields & { id: string }>,
): string {
  return items.map((item) => `${item.id}:${getWardrobeItemImageVersion(item)}`).join('|');
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
