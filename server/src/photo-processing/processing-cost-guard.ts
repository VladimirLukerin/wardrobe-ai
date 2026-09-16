import { createHash } from 'crypto';

import type { ClothingItemMetadata, PhotoRejectReason } from './photo-decision';

const CACHE_TTL_MS = 15 * 60 * 1000;

export type PhotoProcessingSuccessResult = {
  accepted: true;
  rejectReason: null;
  confidence: number;
  item: ClothingItemMetadata;
  processedImage: Buffer;
};

export type PhotoProcessingRejectResult = {
  accepted: false;
  rejectReason: PhotoRejectReason;
  rejectMessage: string;
  confidence: number;
  item: null;
};

export type PhotoProcessingResult = PhotoProcessingSuccessResult | PhotoProcessingRejectResult;

type CacheEntry = {
  expiresAt: number;
  promise?: Promise<PhotoProcessingResult>;
  result?: PhotoProcessingResult;
};

const processingCache = new Map<string, CacheEntry>();

export function createImageFingerprint(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function runCachedImageProcessing(
  fingerprint: string,
  processor: () => Promise<PhotoProcessingResult>,
): Promise<PhotoProcessingResult> {
  const now = Date.now();
  const existing = processingCache.get(fingerprint);

  if (existing && existing.expiresAt > now) {
    if (existing.promise) {
      return existing.promise;
    }

    if (existing.result) {
      if (existing.result.accepted) {
        return {
          ...existing.result,
          processedImage: Buffer.from(existing.result.processedImage),
        };
      }

      return existing.result;
    }
  }

  const entry: CacheEntry = {
    expiresAt: now + CACHE_TTL_MS,
  };

  processingCache.set(fingerprint, entry);

  const promise = processor().then((result) => {
    entry.result = result;
    delete entry.promise;
    return result;
  });

  entry.promise = promise;
  return promise;
}
