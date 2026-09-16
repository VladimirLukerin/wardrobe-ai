import AsyncStorage from '@react-native-async-storage/async-storage';

import { HOME_CACHE_TTL_MS } from '@/constants/home-cache';
import type { OutfitWeather } from '@/services/outfit-suggestions';

const WEATHER_CACHE_KEY = '@wardrobe-ai/cache/weather';

export type CachedWeatherEntry = {
  data: OutfitWeather;
  locationKey: string;
  fetchedAt: number;
};

function parseWeather(value: unknown): OutfitWeather | null {
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

function parseCachedWeatherEntry(raw: unknown): CachedWeatherEntry | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const entry = raw as Partial<CachedWeatherEntry>;
  const data = parseWeather(entry.data);

  if (
    !data ||
    typeof entry.locationKey !== 'string' ||
    entry.locationKey.trim().length === 0 ||
    typeof entry.fetchedAt !== 'number'
  ) {
    return null;
  }

  return {
    data,
    locationKey: entry.locationKey,
    fetchedAt: entry.fetchedAt,
  };
}

export function isWeatherCacheFresh(fetchedAt: number, now: number = Date.now()): boolean {
  return now - fetchedAt < HOME_CACHE_TTL_MS;
}

export async function loadWeatherCache(): Promise<CachedWeatherEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(WEATHER_CACHE_KEY);

    if (!raw) {
      return null;
    }

    return parseCachedWeatherEntry(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveWeatherCache(entry: CachedWeatherEntry): Promise<void> {
  try {
    await AsyncStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Keep in-memory state even if persistence fails.
  }
}
