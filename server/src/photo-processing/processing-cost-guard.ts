import { createHash } from 'crypto';

import type { ClothingItemMetadata, PhotoRejectReason } from './photo-decision';

export const MAX_CACHE_ENTRIES = 75;
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

function isInFlight(entry: CacheEntry): boolean {
  return entry.promise !== undefined;
}

function cleanupExpiredEntries(now: number): void {
  for (const [fingerprint, entry] of processingCache) {
    if (entry.expiresAt <= now && !isInFlight(entry)) {
      processingCache.delete(fingerprint);
    }
  }
}

function enforceMaxCacheSize(): void {
  if (processingCache.size <= MAX_CACHE_ENTRIES) {
    return;
  }

  for (const [fingerprint, entry] of processingCache) {
    if (processingCache.size <= MAX_CACHE_ENTRIES) {
      break;
    }

    if (!isInFlight(entry)) {
      processingCache.delete(fingerprint);
    }
  }
}

function cloneCachedResult(result: PhotoProcessingResult): PhotoProcessingResult {
  if (result.accepted) {
    return {
      ...result,
      processedImage: Buffer.from(result.processedImage),
    };
  }

  return result;
}

export function createImageFingerprint(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function runCachedImageProcessing(
  fingerprint: string,
  processor: () => Promise<PhotoProcessingResult>,
): Promise<PhotoProcessingResult> {
  const now = Date.now();
  cleanupExpiredEntries(now);

  const existing = processingCache.get(fingerprint);

  if (existing && existing.expiresAt > now) {
    if (existing.promise) {
      return existing.promise;
    }

    if (existing.result) {
      return cloneCachedResult(existing.result);
    }
  }

  const entry: CacheEntry = {
    expiresAt: now + CACHE_TTL_MS,
  };

  processingCache.set(fingerprint, entry);
  enforceMaxCacheSize();

  const promise = processor()
    .then((result) => {
      entry.result = result;
      delete entry.promise;
      enforceMaxCacheSize();
      return result;
    })
    .catch((error) => {
      const current = processingCache.get(fingerprint);

      if (current === entry) {
        processingCache.delete(fingerprint);
      }

      throw error;
    });

  entry.promise = promise;
  return promise;
}

export function resetProcessingCacheForTests(): void {
  processingCache.clear();
}

export function getProcessingCacheSizeForTests(): number {
  return processingCache.size;
}

export function seedProcessingCacheEntryForTests(
  fingerprint: string,
  entry: { expiresAt: number; result?: PhotoProcessingResult },
): void {
  processingCache.set(fingerprint, {
    expiresAt: entry.expiresAt,
    result: entry.result,
  });
}

export function hasProcessingCacheEntryForTests(fingerprint: string): boolean {
  return processingCache.has(fingerprint);
}
