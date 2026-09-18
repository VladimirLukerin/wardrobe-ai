import {
  DEV_DAILY_OUTFIT_GENERATE_ENDPOINT,
  PAIRED_OUTFITS_ENDPOINT,
  dailyOutfitTodayEndpoint,
  savedPairedOutfitEndpoint,
} from '@/config/api';
import type { PairedMatchingMode } from '@/constants/paired-outfit';
import type { OutfitWeather } from '@/services/outfit-suggestions';
import { AccountApiError } from '@/services/account';
import {
  ClientNetworkError,
  isServerUnavailableStatus,
  logExpectedNetworkFailure,
  performFetch,
  throwIfServerUnavailable,
} from '@/utils/network-error';

export type SavedPairedOutfitMember = {
  publicId: string;
  displayName: string | null;
  accessAvailable: boolean;
};

export type SavedPairedOutfit = {
  id: string;
  member: SavedPairedOutfitMember;
  occasion: string;
  matchingMode: string;
  ownerItemIds: string[];
  memberItemIds: string[];
  explanation: string;
  createdAt: string;
  updatedAt: string;
};

export type SavePairedOutfitInput = {
  memberPublicId: string;
  occasion: string;
  matchingMode: PairedMatchingMode;
  ownerItemIds: string[];
  memberItemIds: string[];
  explanation: string;
};

export type DailyOutfit = {
  id: string;
  localDate: string;
  itemIds: string[];
  description: string;
  weather: OutfitWeather | null;
  inputSignature: string;
  generatedAt: string;
};

async function parseJsonResponse<T>(response: Response): Promise<T> {
  throwIfServerUnavailable('API', response);

  const payload = (await response.json().catch(() => null)) as T | { error?: string } | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}`;

    if (isServerUnavailableStatus(response.status)) {
      logExpectedNetworkFailure('API', `status ${response.status}`);
      throw new ClientNetworkError();
    }

    throw new AccountApiError(response.status, message);
  }

  return payload as T;
}

function parseSavedPairedOutfit(value: unknown): SavedPairedOutfit | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const outfit = value as Record<string, unknown>;
  const member = outfit.member;

  if (typeof outfit.id !== 'string' || typeof outfit.occasion !== 'string' || typeof outfit.matchingMode !== 'string') {
    return null;
  }

  if (typeof member !== 'object' || member === null) {
    return null;
  }

  const memberRecord = member as Record<string, unknown>;
  const ownerItemIds = Array.isArray(outfit.ownerItemIds)
    ? outfit.ownerItemIds.filter((id): id is string => typeof id === 'string')
    : [];
  const memberItemIds = Array.isArray(outfit.memberItemIds)
    ? outfit.memberItemIds.filter((id): id is string => typeof id === 'string')
    : [];

  return {
    id: outfit.id,
    member: {
      publicId: typeof memberRecord.publicId === 'string' ? memberRecord.publicId : '',
      displayName:
        typeof memberRecord.displayName === 'string' ? memberRecord.displayName : null,
      accessAvailable: memberRecord.accessAvailable === true,
    },
    occasion: outfit.occasion,
    matchingMode: outfit.matchingMode,
    ownerItemIds,
    memberItemIds,
    explanation: typeof outfit.explanation === 'string' ? outfit.explanation : '',
    createdAt: typeof outfit.createdAt === 'string' ? outfit.createdAt : '',
    updatedAt: typeof outfit.updatedAt === 'string' ? outfit.updatedAt : '',
  };
}

export async function fetchSavedPairedOutfits(token: string): Promise<SavedPairedOutfit[]> {
  const response = await performFetch(PAIRED_OUTFITS_ENDPOINT, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await parseJsonResponse<{ outfits: unknown[] }>(response);

  return payload.outfits
    .map((entry) => parseSavedPairedOutfit(entry))
    .filter((entry): entry is SavedPairedOutfit => entry !== null);
}

export async function fetchSavedPairedOutfit(
  token: string,
  outfitId: string,
): Promise<SavedPairedOutfit> {
  const response = await performFetch(savedPairedOutfitEndpoint(outfitId), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await parseJsonResponse<{ outfit: unknown }>(response);
  const outfit = parseSavedPairedOutfit(payload.outfit);

  if (!outfit) {
    throw new AccountApiError(500, 'Некорректный ответ сервера.');
  }

  return outfit;
}

export async function savePairedOutfit(
  token: string,
  input: SavePairedOutfitInput,
): Promise<SavedPairedOutfit> {
  const response = await performFetch(PAIRED_OUTFITS_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  const payload = await parseJsonResponse<{ outfit: unknown }>(response);
  const outfit = parseSavedPairedOutfit(payload.outfit);

  if (!outfit) {
    throw new AccountApiError(500, 'Некорректный ответ сервера.');
  }

  return outfit;
}

export async function deleteSavedPairedOutfit(token: string, outfitId: string): Promise<void> {
  const response = await performFetch(savedPairedOutfitEndpoint(outfitId), {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  await parseJsonResponse<{ ok: true }>(response);
}

function parseDailyOutfit(value: unknown): DailyOutfit | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const outfit = value as Record<string, unknown>;
  const itemIds = Array.isArray(outfit.itemIds)
    ? outfit.itemIds.filter((id): id is string => typeof id === 'string')
    : [];

  if (itemIds.length === 0 || typeof outfit.description !== 'string') {
    return null;
  }

  const weatherRaw = outfit.weather;
  let weather: OutfitWeather | null = null;

  if (weatherRaw && typeof weatherRaw === 'object') {
    const weatherRecord = weatherRaw as Record<string, unknown>;

    if (
      typeof weatherRecord.temperatureC === 'number' &&
      typeof weatherRecord.apparentTemperatureC === 'number' &&
      typeof weatherRecord.precipitationMm === 'number' &&
      typeof weatherRecord.weatherCode === 'number' &&
      typeof weatherRecord.windSpeedKmh === 'number'
    ) {
      weather = {
        temperatureC: weatherRecord.temperatureC,
        apparentTemperatureC: weatherRecord.apparentTemperatureC,
        precipitationMm: weatherRecord.precipitationMm,
        weatherCode: weatherRecord.weatherCode,
        windSpeedKmh: weatherRecord.windSpeedKmh,
      };
    }
  }

  return {
    id: typeof outfit.id === 'string' ? outfit.id : 'daily-outfit',
    localDate: typeof outfit.localDate === 'string' ? outfit.localDate : '',
    itemIds,
    description: outfit.description,
    weather,
    inputSignature: typeof outfit.inputSignature === 'string' ? outfit.inputSignature : '',
    generatedAt: typeof outfit.generatedAt === 'string' ? outfit.generatedAt : '',
  };
}

export async function fetchTodayDailyOutfit(
  token: string,
  localDate: string,
): Promise<DailyOutfit | null> {
  const response = await performFetch(dailyOutfitTodayEndpoint(localDate), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  const payload = await parseJsonResponse<{ outfit: unknown }>(response);
  return parseDailyOutfit(payload.outfit);
}

export async function generateDevDailyOutfit(
  token: string,
  localDate: string,
): Promise<DailyOutfit> {
  const response = await performFetch(DEV_DAILY_OUTFIT_GENERATE_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ localDate }),
  });

  const payload = await parseJsonResponse<{ outfit: unknown }>(response);
  const outfit = parseDailyOutfit(payload.outfit);

  if (!outfit) {
    throw new AccountApiError(500, 'Некорректный ответ сервера.');
  }

  return outfit;
}
