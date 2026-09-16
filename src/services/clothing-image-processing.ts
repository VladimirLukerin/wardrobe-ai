import { File, Paths } from 'expo-file-system';
import { fetch } from 'expo/fetch';

import { PROCESS_CLOTHING_IMAGE_ENDPOINT } from '@/config/api';

export type ClothingImageProcessingResult = {
  processedImageUri: string;
};

export class ClothingImageProcessingError extends Error {
  readonly code: 'network' | 'server';

  constructor(code: 'network' | 'server', message?: string) {
    super(message);
    this.name = 'ClothingImageProcessingError';
    this.code = code;
  }
}

function isNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    return (
      message.includes('network request failed') ||
      message.includes('failed to fetch') ||
      message.includes('network error') ||
      message.includes('timeout')
    );
  }

  return false;
}

function createProcessedImageFile(): File {
  return new File(Paths.document, `wardrobe-processed-${Date.now()}.png`);
}

/**
 * Removes the clothing photo background via backend and saves PNG locally.
 */
export async function processClothingImage(
  imageUri: string,
): Promise<ClothingImageProcessingResult> {
  if (!imageUri) {
    throw new ClothingImageProcessingError('server', 'Image URI is required');
  }

  const sourceFile = new File(imageUri);
  const formData = new FormData();

  formData.append('image', sourceFile);

  let response: Response;

  try {
    response = await fetch(PROCESS_CLOTHING_IMAGE_ENDPOINT, {
      method: 'POST',
      body: formData,
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      throw new ClothingImageProcessingError('network');
    }

    console.error('Failed to process clothing image:', error);
    throw new ClothingImageProcessingError('server');
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (!response.ok) {
    console.error('Clothing image processing failed with status:', response.status);
    throw new ClothingImageProcessingError('server');
  }

  if (!contentType.includes('image/png')) {
    console.error('Clothing image processing returned unexpected content-type:', contentType);
    throw new ClothingImageProcessingError('server');
  }

  try {
    const bytes = await response.bytes();

    if (bytes.byteLength === 0) {
      throw new ClothingImageProcessingError('server');
    }

    const processedFile = createProcessedImageFile();
    processedFile.write(bytes);

    if (!processedFile.exists || processedFile.size === 0) {
      throw new ClothingImageProcessingError('server');
    }

    return {
      processedImageUri: processedFile.uri,
    };
  } catch (error) {
    if (error instanceof ClothingImageProcessingError) {
      throw error;
    }

    console.error('Failed to save processed clothing image:', error);
    throw new ClothingImageProcessingError('server');
  }
}
