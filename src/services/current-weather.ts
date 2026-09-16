import { fetch } from 'expo/fetch';

import { CURRENT_WEATHER_ENDPOINT } from '@/config/api';
import type { OutfitWeather } from '@/services/outfit-suggestions';

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

export async function fetchCurrentWeather(input: {
  latitude: number;
  longitude: number;
}): Promise<OutfitWeather | null> {
  try {
    const response = await fetch(CURRENT_WEATHER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    const payload = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      return null;
    }

    return parseWeather(payload.weather);
  } catch {
    return null;
  }
}
