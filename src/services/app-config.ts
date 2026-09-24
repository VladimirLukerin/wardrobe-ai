import { APP_CONFIG_ENDPOINT } from '@/config/api';
import {
  APP_CONFIG_CACHE_TTL_MS,
  DEFAULT_CLIENT_APP_CONFIG,
  type ClientAppConfig,
} from '@/constants/app-config-defaults';

let cachedConfig: ClientAppConfig = DEFAULT_CLIENT_APP_CONFIG;
let cachedAt = 0;
let inFlight: Promise<ClientAppConfig> | null = null;

function parseClientAppConfig(body: unknown): ClientAppConfig | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const data = body as Record<string, unknown>;

  if (
    typeof data.dailyStylistEnabled !== 'boolean' ||
    typeof data.pairedOutfitsEnabled !== 'boolean' ||
    typeof data.photoOnboardingEnabled !== 'boolean' ||
    typeof data.guestAiEnabled !== 'boolean' ||
    typeof data.guestAiDailyLimit !== 'number'
  ) {
    return null;
  }

  return {
    dailyStylistEnabled: data.dailyStylistEnabled,
    pairedOutfitsEnabled: data.pairedOutfitsEnabled,
    photoOnboardingEnabled: data.photoOnboardingEnabled,
    guestAiEnabled: data.guestAiEnabled,
    guestAiDailyLimit: data.guestAiDailyLimit,
  };
}

export function getCachedAppConfig(): ClientAppConfig {
  return cachedConfig;
}

export async function fetchAppConfig(options?: { force?: boolean }): Promise<ClientAppConfig> {
  const now = Date.now();

  if (!options?.force && now - cachedAt < APP_CONFIG_CACHE_TTL_MS) {
    return cachedConfig;
  }

  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    try {
      const response = await fetch(APP_CONFIG_ENDPOINT);

      if (!response.ok) {
        return cachedConfig;
      }

      const parsed = parseClientAppConfig(await response.json());

      if (parsed) {
        cachedConfig = parsed;
        cachedAt = Date.now();
      }

      return cachedConfig;
    } catch {
      return cachedConfig;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function resetAppConfigCacheForTests(): void {
  cachedConfig = DEFAULT_CLIENT_APP_CONFIG;
  cachedAt = 0;
  inFlight = null;
}
