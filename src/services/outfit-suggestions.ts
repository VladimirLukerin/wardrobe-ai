import { shortenOutfitDescription } from '@/utils/outfit-description';
import { fetch } from 'expo/fetch';

import { SUGGEST_OUTFITS_ENDPOINT } from '@/config/api';
import {
  logStylistContextDiagnostics,
  type BehavioralContextPayload,
  type StylistContextPayload,
  type StylistUserParameters,
} from '@/utils/build-stylist-context';
import type { StylistPreferences } from '@/constants/stylist-preferences';
import type { WardrobeSuggestionItemPayload } from '@/utils/build-wardrobe-suggestion-payload';
import { getAuthToken } from '@/storage/auth-token-storage';
import {
  AI_PROVIDER_RATE_LIMIT_RETRY_HINT,
  AI_PROVIDER_RATE_LIMIT_USER_MESSAGE,
  AI_RATE_LIMIT_USER_MESSAGE,
} from '@/utils/ai-rate-limit-error';
import { isNetworkFailure, warnNetworkFailure } from '@/utils/network-error';

export type OutfitSuggestion = {
  id: string;
  title: string;
  itemIds: string[];
  description: string;
};

export type OutfitWeather = {
  temperatureC: number;
  apparentTemperatureC: number;
  precipitationMm: number;
  weatherCode: number;
  windSpeedKmh: number;
};

export type SuggestOutfitsLocation = {
  latitude: number;
  longitude: number;
  name?: string;
};

export type SuggestOutfitsResult = {
  outfits: OutfitSuggestion[];
  weather: OutfitWeather | null;
};

export type OutfitSuggestionErrorCode = 'network' | 'server' | 'rate_limited' | 'provider_rate_limited';

export class OutfitSuggestionError extends Error {
  readonly code: OutfitSuggestionErrorCode;

  constructor(code: OutfitSuggestionErrorCode, message?: string) {
    super(message);
    this.name = 'OutfitSuggestionError';
    this.code = code;
  }
}

export type SuggestOutfitsInput = {
  selectedItemId?: string;
  stylistContext: StylistContextPayload;
};

export type {
  BehavioralContextPayload,
  StylistContextPayload,
  StylistUserParameters,
  WardrobeSuggestionItemPayload,
};

function parseWeather(value: unknown): OutfitWeather | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const weather = value as Record<string, unknown>;

  if (
    typeof weather.temperatureC !== 'number' ||
    typeof weather.apparentTemperatureC !== 'number' ||
    typeof weather.precipitationMm !== 'number' ||
    typeof weather.weatherCode !== 'number' ||
    typeof weather.windSpeedKmh !== 'number'
  ) {
    return null;
  }

  return {
    temperatureC: weather.temperatureC,
    apparentTemperatureC: weather.apparentTemperatureC,
    precipitationMm: weather.precipitationMm,
    weatherCode: weather.weatherCode,
    windSpeedKmh: weather.windSpeedKmh,
  };
}

function parseSuggestOutfitsResponse(data: unknown): SuggestOutfitsResult {
  if (typeof data !== 'object' || data === null) {
    throw new OutfitSuggestionError('server');
  }

  const payload = data as Record<string, unknown>;

  if (typeof payload.error === 'string') {
    throw new OutfitSuggestionError('server', payload.error);
  }

  if (!Array.isArray(payload.outfits)) {
    throw new OutfitSuggestionError('server');
  }

  const outfits: OutfitSuggestion[] = payload.outfits
    .map((entry, index) => {
      if (typeof entry !== 'object' || entry === null) {
        return null;
      }

      const outfit = entry as Record<string, unknown>;
      const itemIds = Array.isArray(outfit.itemIds)
        ? outfit.itemIds.filter((id): id is string => typeof id === 'string')
        : [];

      if (itemIds.length === 0) {
        return null;
      }

      return {
        id:
          typeof outfit.id === 'string' && outfit.id.trim().length > 0
            ? outfit.id.trim()
            : `outfit-${index + 1}`,
        title:
          typeof outfit.title === 'string' && outfit.title.trim().length > 0
            ? outfit.title.trim()
            : `Образ ${index + 1}`,
        itemIds,
        description: typeof outfit.description === 'string' ? shortenOutfitDescription(outfit.description) : '',
      };
    })
    .filter((outfit): outfit is OutfitSuggestion => outfit !== null);

  return {
    outfits,
    weather: parseWeather(payload.weather),
  };
}

export async function suggestOutfits({
  selectedItemId,
  stylistContext,
}: SuggestOutfitsInput): Promise<SuggestOutfitsResult> {
  logStylistContextDiagnostics(stylistContext);

  const token = await getAuthToken();

  let response: Response;

  try {
    response = await fetch(SUGGEST_OUTFITS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        ...(selectedItemId ? { selectedItemId } : {}),
        wardrobe: stylistContext.wardrobe,
        stylistPreferences: stylistContext.stylistPreferences,
        userParameters: stylistContext.userParameters,
        behavioralContext: stylistContext.behavioralContext,
        location: stylistContext.location,
        // Legacy top-level fields for backward compatibility with older server builds.
        styleExperiment: stylistContext.stylistPreferences.styleExperiment,
        considerWeather: stylistContext.stylistPreferences.considerWeather,
        weatherSensitivity: stylistContext.userParameters.weatherSensitivity,
      }),
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      warnNetworkFailure('SUGGEST OUTFITS', error);
      throw new OutfitSuggestionError('network');
    }

    // Not a connectivity problem: surface it as a real error for developers.
    console.error('Failed to suggest outfits:', error);
    throw new OutfitSuggestionError('server');
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    if (__DEV__) {
      console.warn(`[SUGGEST OUTFITS] invalid JSON response (status ${response.status})`);
    }

    throw new OutfitSuggestionError('server');
  }

  if (!response.ok) {
    if (__DEV__) {
      console.warn(`[SUGGEST OUTFITS] server responded with status ${response.status}`);
    }

    if (response.status === 429 && payload && typeof payload === 'object') {
      if ('code' in payload && payload.code === 'rate_limited') {
        throw new OutfitSuggestionError('rate_limited', AI_RATE_LIMIT_USER_MESSAGE);
      }

      if ('code' in payload && payload.code === 'ai_provider_rate_limited') {
        const retryAfterSeconds =
          'retryAfterSeconds' in payload && typeof payload.retryAfterSeconds === 'number'
            ? payload.retryAfterSeconds
            : undefined;
        const message =
          retryAfterSeconds && retryAfterSeconds > 0
            ? `${AI_PROVIDER_RATE_LIMIT_USER_MESSAGE} ${AI_PROVIDER_RATE_LIMIT_RETRY_HINT}`
            : AI_PROVIDER_RATE_LIMIT_USER_MESSAGE;

        throw new OutfitSuggestionError('provider_rate_limited', message);
      }
    }

    throw new OutfitSuggestionError('server');
  }

  return parseSuggestOutfitsResponse(payload);
}
