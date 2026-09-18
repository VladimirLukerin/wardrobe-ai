import {
  upsertDailyOutfit,
  type DailyOutfitResponse,
} from '../db/daily-outfits-repository';
import { getPreferencesResponse } from '../db/user-preferences-repository';
import { buildPersonPairedOutfitContext } from '../paired-outfits/build-person-context';
import type { SuggestOutfitsLocation } from '../suggest-outfits';
import {
  generateOutfitSuggestionsFromBody,
  hasMinimumWardrobeForOutfit,
} from '../suggest-outfits';
import { buildDailyOutfitInputSignature } from './build-daily-outfit-input-signature';
import {
  AiProviderRateLimitError,
  AI_PROVIDER_RATE_LIMIT_CODE,
  AI_PROVIDER_RATE_LIMIT_MESSAGE,
} from '../outfit-ai/provider-rate-limit';

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
}: {
  userId: string;
  localDate: string;
  location: SuggestOutfitsLocation | null;
  force?: boolean;
}): Promise<DailyOutfitResponse> {
  const inFlightKey = `${userId}:${localDate}`;
  const existing = regenerationInFlight.get(inFlightKey);

  if (existing) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[DAILY REGEN] dedup');
    }

    return existing;
  }

  const generationPromise = generateAndStoreDailyOutfitInternal({
    userId,
    localDate,
    location,
    force,
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
}: {
  userId: string;
  localDate: string;
  location: SuggestOutfitsLocation | null;
  force: boolean;
}): Promise<DailyOutfitResponse> {
  const preferences = getPreferencesResponse(userId);

  if (!force && !preferences.stylistPreferences?.dailyStylistEnabled) {
    throw new DailyOutfitGenerationError(403, 'Daily stylist is disabled.');
  }

  const person = buildPersonPairedOutfitContext(userId);

  if (!hasMinimumWardrobeForOutfit(person.wardrobe)) {
    throw new DailyOutfitGenerationError(422, 'Недостаточно вещей для daily outfit.');
  }

  const requestBody = {
    wardrobe: person.wardrobe,
    stylistPreferences: person.stylistPreferences,
    userParameters: person.userParameters,
    behavioralContext: person.behavioralContext,
    location,
  };

  const { outfits, weather } = await generateOutfitSuggestionsFromBody(requestBody, { userId }).catch(
    (error) => {
      if (error instanceof AiProviderRateLimitError) {
        throw new DailyOutfitGenerationError(429, AI_PROVIDER_RATE_LIMIT_MESSAGE, {
          code: AI_PROVIDER_RATE_LIMIT_CODE,
          retryAfterSeconds: error.retryAfterSeconds,
        });
      }

      throw error;
    },
  );
  const outfit = outfits.find((candidate) => candidate.itemIds.length >= 2);

  if (!outfit) {
    throw new DailyOutfitGenerationError(502, 'Не удалось сгенерировать daily outfit.');
  }

  const inputSignature = buildDailyOutfitInputSignature({
    userId,
    localDate,
    locationOverride: location,
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[DAILY OUTFIT] generated user=${userId.slice(0, 8)} date=${localDate} items=${outfit.itemIds.length}`,
    );
  }

  return upsertDailyOutfit({
    userId,
    localDate,
    itemIds: outfit.itemIds,
    description: outfit.description,
    weather,
    inputSignature,
  });
}
