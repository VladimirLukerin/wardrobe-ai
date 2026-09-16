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

export function getWardrobeItemDisplayImageUri(
  item: WardrobeItemImageFields & LegacyWardrobeItemImageFields,
): string {
  return item.processedImageUri ?? item.originalImageUri ?? item.uri ?? '';
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
