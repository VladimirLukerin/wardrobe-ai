import {
  APP_SETTING_DEFINITIONS,
  APP_SETTING_KEYS,
  isAppSettingKey,
  type AppSettingDefinition,
  type AppSettingKey,
} from './app-settings-keys';
import { readAllAppSettingRows, readAppSettingRow, upsertAppSettingRow } from './app-settings-repository';

export class AppSettingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppSettingValidationError';
  }
}

export type AppSettingEntry = {
  key: AppSettingKey;
  value: boolean | number | string;
  valueType: AppSettingDefinition['valueType'];
  description: string;
  clientSafe: boolean;
  updatedAt: string | null;
  updatedByAdminId: string | null;
};

function parseStoredValue(definition: AppSettingDefinition, valueJson: string): boolean | number | string {
  let parsed: unknown;

  try {
    parsed = JSON.parse(valueJson) as unknown;
  } catch {
    throw new AppSettingValidationError(`Invalid stored JSON for ${definition.key}.`);
  }

  if (definition.valueType === 'boolean') {
    if (typeof parsed !== 'boolean') {
      throw new AppSettingValidationError(`Setting ${definition.key} must be boolean.`);
    }

    return parsed;
  }

  if (definition.valueType === 'integer') {
    if (typeof parsed !== 'number' || !Number.isInteger(parsed)) {
      throw new AppSettingValidationError(`Setting ${definition.key} must be an integer.`);
    }

    const min = definition.minInteger ?? Number.MIN_SAFE_INTEGER;
    const max = definition.maxInteger ?? Number.MAX_SAFE_INTEGER;

    if (parsed < min || parsed > max) {
      throw new AppSettingValidationError(`Setting ${definition.key} must be between ${min} and ${max}.`);
    }

    return parsed;
  }

  if (typeof parsed !== 'string') {
    throw new AppSettingValidationError(`Setting ${definition.key} must be a string.`);
  }

  const maxLength = definition.maxStringLength ?? 500;

  if (parsed.length > maxLength) {
    throw new AppSettingValidationError(`Setting ${definition.key} must be at most ${maxLength} characters.`);
  }

  return parsed;
}

export function validateAppSettingValue(
  key: AppSettingKey,
  value: unknown,
): boolean | number | string {
  const definition = APP_SETTING_DEFINITIONS[key];

  if (definition.valueType === 'boolean') {
    if (typeof value !== 'boolean') {
      throw new AppSettingValidationError(`Setting ${key} must be boolean.`);
    }

    return value;
  }

  if (definition.valueType === 'integer') {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new AppSettingValidationError(`Setting ${key} must be an integer.`);
    }

    const min = definition.minInteger ?? Number.MIN_SAFE_INTEGER;
    const max = definition.maxInteger ?? Number.MAX_SAFE_INTEGER;

    if (value < min || value > max) {
      throw new AppSettingValidationError(`Setting ${key} must be between ${min} and ${max}.`);
    }

    return value;
  }

  if (typeof value !== 'string') {
    throw new AppSettingValidationError(`Setting ${key} must be a string.`);
  }

  const maxLength = definition.maxStringLength ?? 500;

  if (value.length > maxLength) {
    throw new AppSettingValidationError(`Setting ${key} must be at most ${maxLength} characters.`);
  }

  return value;
}

export function getAppSetting(key: AppSettingKey): boolean | number | string {
  const definition = APP_SETTING_DEFINITIONS[key];
  const row = readAppSettingRow(key);

  if (!row) {
    return definition.defaultValue;
  }

  return parseStoredValue(definition, row.valueJson);
}

export function getAllAppSettings(): AppSettingEntry[] {
  const rowsByKey = new Map(readAllAppSettingRows().map((row) => [row.key, row]));

  return APP_SETTING_KEYS.map((key) => {
    const definition = APP_SETTING_DEFINITIONS[key];
    const row = rowsByKey.get(key);
    const value = row ? parseStoredValue(definition, row.valueJson) : definition.defaultValue;

    return {
      key,
      value,
      valueType: definition.valueType,
      description: definition.description,
      clientSafe: definition.clientSafe,
      updatedAt: row?.updatedAt ?? null,
      updatedByAdminId: row?.updatedByAdminId ?? null,
    };
  });
}

export function updateAppSetting(params: {
  key: AppSettingKey;
  value: unknown;
  updatedByAdminId: string;
}): AppSettingEntry {
  if (!isAppSettingKey(params.key)) {
    throw new AppSettingValidationError('Unknown setting key.');
  }

  const validated = validateAppSettingValue(params.key, params.value);
  upsertAppSettingRow({
    key: params.key,
    valueJson: JSON.stringify(validated),
    updatedByAdminId: params.updatedByAdminId,
  });

  return getAllAppSettings().find((entry) => entry.key === params.key)!;
}

export type ClientAppConfig = {
  dailyStylistEnabled: boolean;
  pairedOutfitsEnabled: boolean;
  photoOnboardingEnabled: boolean;
  guestAiEnabled: boolean;
  guestAiDailyLimit: number;
};

export function getClientAppConfig(): ClientAppConfig {
  return {
    dailyStylistEnabled: getAppSetting('daily_stylist_enabled') as boolean,
    pairedOutfitsEnabled: getAppSetting('paired_outfits_enabled') as boolean,
    photoOnboardingEnabled: getAppSetting('photo_onboarding_enabled') as boolean,
    guestAiEnabled: getAppSetting('guest_ai_enabled') as boolean,
    guestAiDailyLimit: getAppSetting('guest_ai_daily_limit') as number,
  };
}

export function isDailyStylistFeatureEnabled(): boolean {
  return getAppSetting('daily_stylist_enabled') as boolean;
}

export function arePairedOutfitsEnabled(): boolean {
  return getAppSetting('paired_outfits_enabled') as boolean;
}

export function isGuestAiEnabledForUser(user: { emailVerified: boolean; phoneVerified: boolean }): boolean {
  if (user.emailVerified || user.phoneVerified) {
    return true;
  }

  return getAppSetting('guest_ai_enabled') as boolean;
}
