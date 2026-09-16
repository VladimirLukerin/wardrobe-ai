import type { PhotoBackgroundSignal } from './photo-decision';

export class PhotoProcessingGuardError extends Error {
  readonly reason: string;
  readonly statusCode: number;

  constructor(message: string, reason: string, statusCode = 400) {
    super(message);
    this.name = 'PhotoProcessingGuardError';
    this.reason = reason;
    this.statusCode = statusCode;
  }
}

export function logPhotoValidationStarted(): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log('[PHOTO] validation+recognition started');
}

type PhotoDecisionLog = {
  clothingCount: number;
  confidence: number;
  background: PhotoBackgroundSignal;
  decision: 'accept' | 'reject';
  reason: string;
};

export function logPhotoDecision(log: PhotoDecisionLog): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log(
    `[PHOTO DECISION] clothingCount=${log.clothingCount} confidence=${log.confidence.toFixed(2)} background=${log.background} decision=${log.decision} reason=${log.reason}`,
  );
}

export function logBackgroundRemovalSkipped(): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log('[BACKGROUND REMOVAL] skipped');
}

export function logBackgroundRemovalStarted(provider: 'local' | 'removebg'): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log(`[BACKGROUND REMOVAL] provider=${provider} started`);
}

export function logBackgroundRemovalSuccess(
  provider: 'local' | 'removebg',
  durationMs: number,
): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log(`[BACKGROUND REMOVAL] provider=${provider} success durationMs=${durationMs}`);
}

export function logBackgroundRemovalError(provider: 'local' | 'removebg', message: string): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log(`[BACKGROUND REMOVAL] provider=${provider} error=${message}`);
}

export function logPhotoTiming(phase: string, durationMs: number): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log(`[PHOTO TIMING] ${phase}=${durationMs}ms`);
}

export function logPhotoTimingTotal(durationMs: number): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log(`[PHOTO TIMING] total=${durationMs}ms`);
}

export function logPhotoImageSizes(
  prepared: { width: number; height: number },
  processing: { width: number; height: number },
): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log(
    `[PHOTO IMAGE] prepared=${prepared.width}x${prepared.height} processing=${processing.width}x${processing.height}`,
  );
}

export function logPrimaryItem(clothingCount: number, primaryItemClear: boolean): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log(`[PRIMARY ITEM] count=${clothingCount} clear=${primaryItemClear}`);
}

export function logPrimaryCrop(
  bbox: 'valid' | 'invalid',
  paddingRatio: number,
): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log(`[PRIMARY CROP] bbox=${bbox} padding=${Math.round(paddingRatio * 100)}%`);
}

export function logPrimaryCropSizes(
  input: { width: number; height: number },
  output: { width: number; height: number },
): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log(`[PRIMARY CROP] input=${input.width}x${input.height} output=${output.width}x${output.height}`);
}
