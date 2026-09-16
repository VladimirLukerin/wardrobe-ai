import { File, Paths } from 'expo-file-system';
import { fetch } from 'expo/fetch';

import { PROCESS_CLOTHING_IMAGE_ENDPOINT } from '@/config/api';
import {
  getPhotoGuardRejectMessage,
  isPhotoGuardRejectReason,
  type PhotoGuardRejectReason,
} from '@/constants/photo-guard-reason';
import {
  MOCK_WARDROBE_DEFAULTS,
  WARDROBE_CATEGORIES,
  WARDROBE_COLORS,
  WARDROBE_PATTERNS,
  WARDROBE_STYLES,
} from '@/constants/wardrobe-options';
import { buildClothingDisplayName } from '@/utils/build-clothing-display-name';
import { getAuthToken } from '@/storage/auth-token-storage';

export type ClothingImageProcessingResult = {
  name: string;
  baseName: string;
  category: string;
  color: string;
  pattern: string;
  printDescription: string | null;
  style: string;
  confidence: number;
  processedImageUri: string;
};

export class ClothingImageProcessingError extends Error {
  readonly code: 'network' | 'server' | 'photo_guard' | 'background_removal' | 'unauthorized';
  readonly photoGuardReason?: PhotoGuardRejectReason;

  constructor(
    code: 'network' | 'server' | 'photo_guard' | 'background_removal' | 'unauthorized',
    message?: string,
    photoGuardReason?: PhotoGuardRejectReason,
  ) {
    super(message);
    this.name = 'ClothingImageProcessingError';
    this.code = code;
    this.photoGuardReason = photoGuardReason;
  }

  static isPhotoGuardReject(error: unknown): error is ClothingImageProcessingError {
    return error instanceof ClothingImageProcessingError && error.code === 'photo_guard';
  }

  static isBackgroundRemoval(error: unknown): error is ClothingImageProcessingError {
    return error instanceof ClothingImageProcessingError && error.code === 'background_removal';
  }
}

type CachedProcessingEntry = {
  promise?: Promise<ClothingImageProcessingResult>;
  result?: ClothingImageProcessingResult;
};

const processingCache = new Map<string, CachedProcessingEntry>();

function pickOption<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === 'string' && options.includes(value as T) ? (value as T) : fallback;
}

function parsePrintDescription(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function createProcessedImageFile(): File {
  return new File(Paths.document, `wardrobe-processed-${Date.now()}.png`);
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

async function createImageFingerprint(imageUri: string): Promise<string> {
  const sourceFile = new File(imageUri);

  return `${imageUri}:${sourceFile.size}`;
}

async function requestClothingProcessing(imageUri: string): Promise<ClothingImageProcessingResult> {
  const token = await getAuthToken();

  if (!token) {
    throw new ClothingImageProcessingError('unauthorized', 'Требуется авторизация');
  }

  const sourceFile = new File(imageUri);
  const formData = new FormData();

  formData.append('image', sourceFile);

  let response: Response;

  try {
    response = await fetch(PROCESS_CLOTHING_IMAGE_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      throw new ClothingImageProcessingError('network');
    }

    console.error('Failed to process clothing image:', error);
    throw new ClothingImageProcessingError('server');
  }

  const payload = (await response.json().catch(() => null)) as {
    accepted?: boolean;
    rejectReason?: string | null;
    rejectMessage?: string | null;
    confidence?: number;
    item?: {
      baseName?: string;
      category?: string;
      color?: string;
      pattern?: string;
      printDescription?: string | null;
      style?: string;
    } | null;
    processedImageBase64?: string;
    code?: string;
    error?: string;
  } | null;

  if (response.status === 401) {
    throw new ClothingImageProcessingError('unauthorized', 'Требуется авторизация');
  }

  if (!response.ok) {
    const message =
      payload && typeof payload.error === 'string' && payload.error.trim().length > 0
        ? payload.error
        : 'Не удалось обработать изображение.';

    if (payload?.code === 'background_removal') {
      throw new ClothingImageProcessingError('background_removal', message);
    }

    if (__DEV__) {
      console.error('Clothing image processing failed with status:', response.status, message);
    }

    throw new ClothingImageProcessingError('server', message);
  }

  if (!payload || typeof payload !== 'object') {
    throw new ClothingImageProcessingError('server');
  }

  if (payload.accepted === false) {
    const rejectReason = isPhotoGuardRejectReason(payload.rejectReason)
      ? payload.rejectReason
      : undefined;
    const rejectMessage =
      typeof payload.rejectMessage === 'string' && payload.rejectMessage.trim().length > 0
        ? payload.rejectMessage
        : getPhotoGuardRejectMessage(rejectReason);

    throw new ClothingImageProcessingError('photo_guard', rejectMessage, rejectReason);
  }

  if (payload.accepted !== true || !payload.item || typeof payload.processedImageBase64 !== 'string') {
    throw new ClothingImageProcessingError('server');
  }

  const baseName =
    typeof payload.item.baseName === 'string' && payload.item.baseName.trim().length > 0
      ? payload.item.baseName.trim()
      : MOCK_WARDROBE_DEFAULTS.baseName;
  const category = pickOption(payload.item.category, WARDROBE_CATEGORIES, MOCK_WARDROBE_DEFAULTS.category);
  const color = pickOption(payload.item.color, WARDROBE_COLORS, MOCK_WARDROBE_DEFAULTS.color);
  const pattern = pickOption(payload.item.pattern, WARDROBE_PATTERNS, MOCK_WARDROBE_DEFAULTS.pattern);
  const style = pickOption(payload.item.style, WARDROBE_STYLES, MOCK_WARDROBE_DEFAULTS.style);
  const printDescription = parsePrintDescription(payload.item.printDescription);
  const confidence =
    typeof payload.confidence === 'number' && Number.isFinite(payload.confidence)
      ? Math.min(1, Math.max(0, payload.confidence))
      : 0;

  const name =
    buildClothingDisplayName({
      baseName,
      color,
      pattern,
      printDescription,
    }) || MOCK_WARDROBE_DEFAULTS.name;

  try {
    const processedResponse = await fetch(`data:image/png;base64,${payload.processedImageBase64}`);
    const bytes = await processedResponse.bytes();

    if (bytes.byteLength === 0) {
      throw new ClothingImageProcessingError('server');
    }

    const processedFile = createProcessedImageFile();
    processedFile.write(bytes);

    if (!processedFile.exists || processedFile.size === 0) {
      throw new ClothingImageProcessingError('server');
    }

    return {
      name,
      baseName,
      category,
      color,
      pattern,
      printDescription,
      style,
      confidence,
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

/**
 * Validates, recognizes and processes a clothing photo via a single backend request.
 */
export async function processClothingImage(
  imageUri: string,
): Promise<ClothingImageProcessingResult> {
  if (!imageUri) {
    throw new ClothingImageProcessingError('server', 'Image URI is required');
  }

  const fingerprint = await createImageFingerprint(imageUri);
  const existing = processingCache.get(fingerprint);

  if (existing?.promise) {
    return existing.promise;
  }

  if (existing?.result) {
    return existing.result;
  }

  const entry: CachedProcessingEntry = {};
  processingCache.set(fingerprint, entry);

  const promise = requestClothingProcessing(imageUri)
    .then((result) => {
      entry.result = result;
      delete entry.promise;
      return result;
    })
    .catch((error) => {
      if (ClothingImageProcessingError.isPhotoGuardReject(error)) {
        entry.result = undefined;
      }

      delete entry.promise;
      throw error;
    });

  entry.promise = promise;
  return promise;
}

export function clearClothingImageProcessingCache(imageUri?: string): void {
  if (!imageUri) {
    processingCache.clear();
    return;
  }

  void createImageFingerprint(imageUri).then((fingerprint) => {
    processingCache.delete(fingerprint);
  });
}
