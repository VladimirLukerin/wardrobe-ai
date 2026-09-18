import type { DailyOutfitResponse } from '../db/daily-outfits-repository';

export type DailyGenerationReason = 'missing' | 'stale' | 'manual';

export type DailyGenerationSkipReason = 'cache_fresh' | 'disabled';

export type DailyGenerationDecision =
  | { action: 'provider'; reason: DailyGenerationReason }
  | { action: 'skip'; reason: 'cache_fresh'; outfit: DailyOutfitResponse }
  | { action: 'skip'; reason: 'disabled'; outfit?: DailyOutfitResponse };

export function resolveDailyGenerationDecision(params: {
  manual: boolean;
  force?: boolean;
  dailyStylistEnabled: boolean;
  existingOutfit: DailyOutfitResponse | null;
  isStale: boolean;
}): DailyGenerationDecision {
  if (!params.force && !params.dailyStylistEnabled) {
    if (params.existingOutfit) {
      return { action: 'skip', reason: 'disabled', outfit: params.existingOutfit };
    }

    return { action: 'skip', reason: 'disabled' };
  }

  if (params.manual || params.force) {
    return { action: 'provider', reason: 'manual' };
  }

  if (!params.existingOutfit) {
    return { action: 'provider', reason: 'missing' };
  }

  if (params.isStale) {
    return { action: 'provider', reason: 'stale' };
  }

  return { action: 'skip', reason: 'cache_fresh', outfit: params.existingOutfit };
}

export function logDailyGenerationSkipped(reason: DailyGenerationSkipReason): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log(`[DAILY AI] skipped reason=${reason}`);
}
