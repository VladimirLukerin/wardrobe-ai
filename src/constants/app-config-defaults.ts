export type ClientAppConfig = {
  dailyStylistEnabled: boolean;
  pairedOutfitsEnabled: boolean;
  photoOnboardingEnabled: boolean;
  guestAiEnabled: boolean;
  guestAiDailyLimit: number;
};

export const DEFAULT_CLIENT_APP_CONFIG: ClientAppConfig = {
  dailyStylistEnabled: true,
  pairedOutfitsEnabled: true,
  photoOnboardingEnabled: true,
  guestAiEnabled: true,
  guestAiDailyLimit: 20,
};

export const APP_CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;
