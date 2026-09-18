import type { PairedMatchingMode } from '@/constants/paired-outfit';
import { familyMemberPairedOutfitsEndpoint } from '@/config/api';
import type { OutfitWeather, SuggestOutfitsLocation } from '@/services/outfit-suggestions';
import { AccountApiError } from '@/services/account';
import {
  ClientNetworkError,
  isServerUnavailableStatus,
  logExpectedNetworkFailure,
  performFetch,
  throwIfServerUnavailable,
} from '@/utils/network-error';

export type PairedOutfitPersonResult = {
  itemIds: string[];
};

export type PairedOutfitResult = {
  personA: PairedOutfitPersonResult;
  personB: PairedOutfitPersonResult;
  pairExplanation: string;
  weather: OutfitWeather | null;
};

export type FetchPairedOutfitsInput = {
  occasion: string;
  matchingMode: PairedMatchingMode;
  location: SuggestOutfitsLocation | null;
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

function parsePairedOutfitResponse(data: unknown): PairedOutfitResult {
  if (typeof data !== 'object' || data === null) {
    throw new AccountApiError(500, 'Некорректный ответ сервера.');
  }

  const payload = data as Record<string, unknown>;

  if (typeof payload.error === 'string') {
    throw new AccountApiError(500, payload.error);
  }

  const personA = payload.personA;
  const personB = payload.personB;

  if (typeof personA !== 'object' || personA === null || typeof personB !== 'object' || personB === null) {
    throw new AccountApiError(500, 'Некорректный ответ сервера.');
  }

  const personARecord = personA as Record<string, unknown>;
  const personBRecord = personB as Record<string, unknown>;
  const personAItemIds = Array.isArray(personARecord.itemIds)
    ? personARecord.itemIds.filter((id): id is string => typeof id === 'string')
    : [];
  const personBItemIds = Array.isArray(personBRecord.itemIds)
    ? personBRecord.itemIds.filter((id): id is string => typeof id === 'string')
    : [];

  if (personAItemIds.length === 0 || personBItemIds.length === 0) {
    throw new AccountApiError(422, 'Недостаточно вещей для совместного образа');
  }

  return {
    personA: { itemIds: personAItemIds },
    personB: { itemIds: personBItemIds },
    pairExplanation:
      typeof payload.pairExplanation === 'string' ? payload.pairExplanation.trim() : '',
    weather: parseWeather(payload.weather),
  };
}

export async function fetchPairedOutfits(
  token: string,
  memberPublicId: string,
  input: FetchPairedOutfitsInput,
): Promise<PairedOutfitResult> {
  const response = await performFetch(familyMemberPairedOutfitsEndpoint(memberPublicId), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      occasion: input.occasion,
      matchingMode: input.matchingMode,
      location: input.location,
    }),
  });

  throwIfServerUnavailable('PAIRED OUTFIT API', response);

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}`;
    const code =
      payload &&
      typeof payload === 'object' &&
      'code' in payload &&
      typeof payload.code === 'string'
        ? payload.code
        : null;

    if (isServerUnavailableStatus(response.status)) {
      logExpectedNetworkFailure('PAIRED OUTFIT API', `status ${response.status}`);
      throw new ClientNetworkError();
    }

    throw new AccountApiError(response.status, message, code);
  }

  return parsePairedOutfitResponse(payload);
}
