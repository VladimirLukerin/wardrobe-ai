import crypto from 'crypto';

import { getDatabase } from './database';
import type { CurrentWeather } from '../providers/weather';

export type DbDailyOutfit = {
  user_id: string;
  local_date: string;
  outfit_id: string;
  item_ids_json: string;
  description: string;
  weather_context_json: string | null;
  input_signature: string;
  generated_at: string;
};

export type DailyOutfitResponse = {
  id: string;
  localDate: string;
  itemIds: string[];
  description: string;
  weather: CurrentWeather | null;
  inputSignature: string;
  generatedAt: string;
};

function parseItemIds(value: string): string[] {
  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.filter((entry): entry is string => typeof entry === 'string');
    }
  } catch {
    // Ignore malformed JSON.
  }

  return [];
}

function parseWeatherContext(value: string | null): CurrentWeather | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as CurrentWeather;

    if (
      typeof parsed.temperatureC === 'number' &&
      typeof parsed.apparentTemperatureC === 'number' &&
      typeof parsed.precipitationMm === 'number' &&
      typeof parsed.weatherCode === 'number' &&
      typeof parsed.windSpeedKmh === 'number'
    ) {
      return parsed;
    }
  } catch {
    // Ignore malformed JSON.
  }

  return null;
}

function toResponse(row: DbDailyOutfit): DailyOutfitResponse {
  return {
    id: row.outfit_id,
    localDate: row.local_date,
    itemIds: parseItemIds(row.item_ids_json),
    description: row.description,
    weather: parseWeatherContext(row.weather_context_json),
    inputSignature: row.input_signature,
    generatedAt: row.generated_at,
  };
}

export function getDailyOutfitForDate(userId: string, localDate: string): DailyOutfitResponse | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT * FROM daily_outfits WHERE user_id = ? AND local_date = ?')
    .get(userId, localDate) as DbDailyOutfit | undefined;

  if (!row) {
    return null;
  }

  return toResponse(row);
}

export function upsertDailyOutfit({
  userId,
  localDate,
  itemIds,
  description,
  weather,
  inputSignature,
}: {
  userId: string;
  localDate: string;
  itemIds: string[];
  description: string;
  weather: CurrentWeather | null;
  inputSignature: string;
}): DailyOutfitResponse {
  const db = getDatabase();
  const now = new Date().toISOString();
  const outfitId = crypto.randomUUID();

  db.prepare(
    `INSERT INTO daily_outfits (
      user_id, local_date, outfit_id, item_ids_json, description,
      weather_context_json, input_signature, generated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, local_date) DO UPDATE SET
      outfit_id = excluded.outfit_id,
      item_ids_json = excluded.item_ids_json,
      description = excluded.description,
      weather_context_json = excluded.weather_context_json,
      input_signature = excluded.input_signature,
      generated_at = excluded.generated_at`,
  ).run(
    userId,
    localDate,
    outfitId,
    JSON.stringify(itemIds),
    description,
    weather ? JSON.stringify(weather) : null,
    inputSignature,
    now,
  );

  const saved = getDailyOutfitForDate(userId, localDate);

  if (!saved) {
    throw new Error('Failed to upsert daily outfit.');
  }

  return saved;
}

export function buildDailyInputSignature(payload: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32);
}
