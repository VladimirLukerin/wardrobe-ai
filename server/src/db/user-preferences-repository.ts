import { getDatabase } from './database';
import type { ValidatedBodyParameters, ValidatedStylistPreferences } from './validate-preferences';
import { findUserById } from './users-repository';

export type DbUserPreferences = {
  user_id: string;
  body_parameters_json: string;
  stylist_preferences_json: string;
  updated_at: string;
};

export type PreferencesResponse = {
  displayName: string | null;
  bodyParameters: ValidatedBodyParameters | null;
  stylistPreferences: ValidatedStylistPreferences | null;
  updatedAt: string | null;
};

function parseStoredBodyParameters(raw: string): ValidatedBodyParameters | null {
  try {
    return JSON.parse(raw) as ValidatedBodyParameters;
  } catch {
    return null;
  }
}

function parseStoredStylistPreferences(raw: string): ValidatedStylistPreferences | null {
  try {
    return JSON.parse(raw) as ValidatedStylistPreferences;
  } catch {
    return null;
  }
}

export function findUserPreferences(userId: string): DbUserPreferences | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT * FROM user_preferences WHERE user_id = ?')
    .get(userId) as DbUserPreferences | undefined;

  return row ?? null;
}

export function getPreferencesResponse(userId: string): PreferencesResponse {
  const user = findUserById(userId);
  const preferences = findUserPreferences(userId);

  if (!preferences) {
    return {
      displayName: user?.display_name ?? null,
      bodyParameters: null,
      stylistPreferences: null,
      updatedAt: null,
    };
  }

  return {
    displayName: user?.display_name ?? null,
    bodyParameters: parseStoredBodyParameters(preferences.body_parameters_json),
    stylistPreferences: parseStoredStylistPreferences(preferences.stylist_preferences_json),
    updatedAt: preferences.updated_at,
  };
}

export function upsertUserPreferences({
  userId,
  bodyParameters,
  stylistPreferences,
  updatedAt,
}: {
  userId: string;
  bodyParameters: ValidatedBodyParameters;
  stylistPreferences: ValidatedStylistPreferences;
  updatedAt: string;
}): PreferencesResponse {
  const db = getDatabase();

  db.prepare(
    `INSERT INTO user_preferences (
      user_id, body_parameters_json, stylist_preferences_json, updated_at
    ) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      body_parameters_json = excluded.body_parameters_json,
      stylist_preferences_json = excluded.stylist_preferences_json,
      updated_at = excluded.updated_at`,
  ).run(
    userId,
    JSON.stringify(bodyParameters),
    JSON.stringify(stylistPreferences),
    updatedAt,
  );

  return getPreferencesResponse(userId);
}
