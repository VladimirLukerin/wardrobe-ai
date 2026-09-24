import { fetch } from 'expo/fetch';

import { CURRENT_WEATHER_ENDPOINT } from '@/config/api';
import type { OutfitWeather } from '@/services/outfit-suggestions';
import { isNetworkFailure, warnNetworkFailure } from '@/utils/network-error';

export type CurrentWeatherErrorCode = 'network' | 'server';

export class CurrentWeatherError extends Error {
  readonly code: CurrentWeatherErrorCode;

  constructor(code: CurrentWeatherErrorCode, message?: string) {
    super(message);
    this.name = 'CurrentWeatherError';
    this.code = code;
  }
}

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

/**
 * Resolves with weather data, or null when the server answered but without usable weather.
 * Throws CurrentWeatherError('network') when the server is unreachable and
 * CurrentWeatherError('server') for HTTP errors / malformed payloads.
 */
export async function fetchCurrentWeather(input: {
  latitude: number;
  longitude: number;
}): Promise<OutfitWeather | null> {
  let response: Response;

  try {
    response = await fetch(CURRENT_WEATHER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      warnNetworkFailure('WEATHER', error);
      throw new CurrentWeatherError('network');
    }

    console.error('Failed to fetch current weather:', error);
    throw new CurrentWeatherError('server');
  }

  let payload: Record<string, unknown> | null;

  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload) {
    if (__DEV__) {
      console.warn(`[WEATHER] server responded with status ${response.status}`);
    }

    throw new CurrentWeatherError('server');
  }

  return parseWeather(payload.weather);
}
