import {
  getDailyOutfitForDate,
  upsertDailyOutfit,
  type DailyOutfitResponse,
} from '../db/daily-outfits-repository';
import { getPreferencesResponse } from '../db/user-preferences-repository';
import { buildPersonPairedOutfitContext } from '../paired-outfits/build-person-context';
import type { SuggestOutfitsLocation } from '../suggest-outfits';
import { hasMinimumWardrobeForOutfit } from '../suggest-outfits';
import {
  buildDailyOutfitInputSignature,
  isDailyOutfitInputSignatureStale,
} from './build-daily-outfit-input-signature';
import { generateDailyOutfitWithAi } from './generate-daily-outfit-ai';
import {
  logDailyGenerationSkipped,
  resolveDailyGenerationDecision,
} from './resolve-daily-generation';
import {
  AiProviderRateLimitError,
  AI_PROVIDER_RATE_LIMIT_CODE,
  AI_PROVIDER_RATE_LIMIT_MESSAGE,
} from '../outfit-ai/provider-rate-limit';
import { AiRateLimitExceededError } from '../ai-request-rate-limit';

export class DailyOutfitGenerationError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly retryAfterSeconds?: number;

  constructor(
    status: number,
    message: string,
    options?: { code?: string; retryAfterSeconds?: number },
  ) {
    super(message);
    this.name = 'DailyOutfitGenerationError';
    this.status = status;
    this.code = options?.code;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

const regenerationInFlight = new Map<string, Promise<DailyOutfitResponse>>();

export async function generateAndStoreDailyOutfit({
  userId,
  localDate,
  location,
  force = false,
  manual = false,
}: {
  userId: string;
  localDate: string;
  location: SuggestOutfitsLocation | null;
  force?: boolean;
  manual?: boolean;
}): Promise<DailyOutfitResponse> {
  const inFlightKey = `${userId}:${localDate}`;
  const existing = regenerationInFlight.get(inFlightKey);

  if (existing) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DAILY AI] dedup scope=${inFlightKey}`);
    }

    return existing;
  }

  const generationPromise = generateAndStoreDailyOutfitInternal({
    userId,
    localDate,
    location,
    force,
    manual,
  }).finally(() => {
    regenerationInFlight.delete(inFlightKey);
  });

  regenerationInFlight.set(inFlightKey, generationPromise);

  return generationPromise;
}

async function generateAndStoreDailyOutfitInternal({
  userId,
  localDate,
  location,
  force,
  manual,
}: {
  userId: string;
  localDate: string;
  location: SuggestOutfitsLocation | null;
  force: boolean;
  manual: boolean;
}): Promise<DailyOutfitResponse> {
  const preferences = getPreferencesResponse(userId);
  const dailyStylistEnabled = preferences.stylistPreferences?.dailyStylistEnabled ?? false;
  const existingOutfit = getDailyOutfitForDate(userId, localDate);
  const isStale = existingOutfit
    ? isDailyOutfitInputSignatureStale(userId, localDate, existingOutfit.inputSignature)
    : false;

  const decision = resolveDailyGenerationDecision({
    manual,
    force,
    dailyStylistEnabled,
    existingOutfit,
    isStale,
  });

  if (decision.action === 'skip') {
    logDailyGenerationSkipped(decision.reason);

    if (decision.reason === 'disabled') {
      if (decision.outfit) {
        return decision.outfit;
      }

      throw new DailyOutfitGenerationError(403, 'Daily stylist is disabled.');
    }

    return decision.outfit;
  }

  const person = buildPersonPairedOutfitContext(userId);

  if (!hasMinimumWardrobeForOutfit(person.wardrobe)) {
    throw new DailyOutfitGenerationError(422, 'Недостаточно вещей для daily outfit.');
  }

  const { itemIds, description, weather } = await generateDailyOutfitWithAi({
    userId,
    wardrobe: person.wardrobe,
    stylistPreferences: person.stylistPreferences,
    userParameters: person.userParameters,
    behavioralContext: person.behavioralContext,
    location,
    reason: decision.reason,
  }).catch((error) => {
    if (error instanceof AiProviderRateLimitError) {
      throw new DailyOutfitGenerationError(429, AI_PROVIDER_RATE_LIMIT_MESSAGE, {
        code: AI_PROVIDER_RATE_LIMIT_CODE,
        retryAfterSeconds: error.retryAfterSeconds,
      });
    }

    if (error instanceof AiRateLimitExceededError) {
      throw new DailyOutfitGenerationError(429, 'Слишком много AI-запросов. Попробуйте чуть позже.', {
        code: 'rate_limited',
        retryAfterSeconds: error.retryAfterSeconds,
      });
    }

    throw error;
  });

  if (itemIds.length < 2) {
    throw new DailyOutfitGenerationError(502, 'Не удалось сгенерировать daily outfit.');
  }

  const inputSignature = buildDailyOutfitInputSignature({
    userId,
    localDate,
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[DAILY OUTFIT] generated user=${userId.slice(0, 8)} date=${localDate} items=${itemIds.length}`,
    );
  }

  return upsertDailyOutfit({
    userId,
    localDate,
    itemIds,
    description,
    weather,
    inputSignature,
  });
}

export function getDailyRegenerationInFlightCountForTests(): number {
  return regenerationInFlight.size;
}

export function clearDailyRegenerationInFlightForTests(): void {
  regenerationInFlight.clear();
}
