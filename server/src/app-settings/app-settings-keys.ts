export const APP_SETTING_KEYS = [
  'daily_stylist_enabled',
  'paired_outfits_enabled',
  'photo_onboarding_enabled',
  'guest_ai_enabled',
  'guest_ai_daily_limit',
  'maintenance_message',
] as const;

export type AppSettingKey = (typeof APP_SETTING_KEYS)[number];

export type AppSettingValueType = 'boolean' | 'integer' | 'string';

export type AppSettingDefinition = {
  key: AppSettingKey;
  valueType: AppSettingValueType;
  defaultValue: boolean | number | string;
  description: string;
  clientSafe: boolean;
  minInteger?: number;
  maxInteger?: number;
  maxStringLength?: number;
};

export const APP_SETTING_DEFINITIONS: Record<AppSettingKey, AppSettingDefinition> = {
  daily_stylist_enabled: {
    key: 'daily_stylist_enabled',
    valueType: 'boolean',
    defaultValue: true,
    description: 'Allow new Daily Stylist AI generations server-wide.',
    clientSafe: true,
  },
  paired_outfits_enabled: {
    key: 'paired_outfits_enabled',
    valueType: 'boolean',
    defaultValue: true,
    description: 'Allow paired outfit AI suggestions.',
    clientSafe: true,
  },
  photo_onboarding_enabled: {
    key: 'photo_onboarding_enabled',
    valueType: 'boolean',
    defaultValue: true,
    description: 'Show first-time photo capture onboarding sheet in the mobile app.',
    clientSafe: true,
  },
  guest_ai_enabled: {
    key: 'guest_ai_enabled',
    valueType: 'boolean',
    defaultValue: true,
    description: 'Allow guest (unverified) accounts to use paid AI flows.',
    clientSafe: true,
  },
  guest_ai_daily_limit: {
    key: 'guest_ai_daily_limit',
    valueType: 'integer',
    defaultValue: 20,
    description: 'Reserved daily guest AI cap (informational for clients; enforcement uses rate limits).',
    clientSafe: true,
    minInteger: 0,
    maxInteger: 1000,
  },
  maintenance_message: {
    key: 'maintenance_message',
    valueType: 'string',
    defaultValue: '',
    description: 'Optional admin-only maintenance note (not exposed on /app-config).',
    clientSafe: false,
    maxStringLength: 500,
  },
};

export function isAppSettingKey(value: string): value is AppSettingKey {
  return (APP_SETTING_KEYS as readonly string[]).includes(value);
}
