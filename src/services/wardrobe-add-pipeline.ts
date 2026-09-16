import type { WardrobeItemImageFields } from '@/constants/wardrobe-item';

import { processClothingImage } from '@/services/clothing-image-processing';

export type WardrobePhotoPipelineResult = WardrobeItemImageFields;

/**
 * Initial photo capture step for the add-item flow.
 */
export async function prepareWardrobePhotoForAdd(
  imageUri: string,
): Promise<WardrobePhotoPipelineResult> {
  return {
    originalImageUri: imageUri,
    imageProcessingStatus: 'idle',
  };
}

/**
 * Runs background removal before the item is saved to the wardrobe.
 */
export async function runWardrobePhotoProcessing(
  imageUri: string,
): Promise<WardrobePhotoPipelineResult> {
  const originalImageUri = imageUri;

  try {
    const { processedImageUri } = await processClothingImage(originalImageUri);

    return {
      originalImageUri,
      processedImageUri,
      imageProcessingStatus: 'completed',
    };
  } catch {
    return {
      originalImageUri,
      imageProcessingStatus: 'failed',
    };
  }
}
