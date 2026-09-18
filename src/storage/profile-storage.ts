import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CLOTHING_SIZES,
  EMPTY_BODY_PARAMETERS,
  FIT_PREFERENCES,
  SHOE_SIZES_EU,
  WEATHER_SENSITIVITIES,
  type AutoLocation,
  type BodyParameters,
  type ClothingSize,
  type FitPreference,
  type LocationMode,
  type ManualLocation,
  type ShoeSizeEu,
  type WeatherSensitivity,
} from '@/constants/body-parameters';
import {
  DEFAULT_ACCOUNT_PROFILE,
  DEFAULT_DISPLAY_NAME,
  type AccountProfile,
} from '@/constants/account-profile';
import {
  DEFAULT_STYLIST_PREFERENCES,
  STYLE_EXPERIMENTS,
  WARDROBE_MODES,
  type StylistPreferences,
  type StyleExperiment,
  type WardrobeMode,
} from '@/constants/stylist-preferences';
import { isValidPublicId } from '@/utils/public-id';

const PROFILE_BODY_PARAMETERS_KEY = '@wardrobe-ai/profile/body-parameters';
const PROFILE_STYLIST_PREFERENCES_KEY = '@wardrobe-ai/profile/stylist-preferences';
const PROFILE_ACCOUNT_KEY = '@wardrobe-ai/profile/account';

function isLocationPlace(value: unknown): value is ManualLocation {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const location = value as ManualLocation;

  return (
    typeof location.name === 'string' &&
    typeof location.country === 'string' &&
    typeof location.latitude === 'number' &&
    typeof location.longitude === 'number' &&
    (location.region === undefined || typeof location.region === 'string')
  );
}

function isAutoLocation(value: unknown): value is AutoLocation {
  return isLocationPlace(value) && (value as AutoLocation).source === 'auto';
}

function isClothingSize(value: unknown): value is ClothingSize {
  return typeof value === 'string' && CLOTHING_SIZES.includes(value as ClothingSize);
}

function isShoeSize(value: unknown): value is ShoeSizeEu {
  return typeof value === 'string' && SHOE_SIZES_EU.includes(value as ShoeSizeEu);
}

function isFitPreference(value: unknown): value is FitPreference {
  return typeof value === 'string' && FIT_PREFERENCES.includes(value as FitPreference);
}

function isWeatherSensitivity(value: unknown): value is WeatherSensitivity {
  return (
    typeof value === 'string' && WEATHER_SENSITIVITIES.includes(value as WeatherSensitivity)
  );
}

function parseBodyParameters(raw: unknown): BodyParameters | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const data = raw as Partial<BodyParameters>;
  const locationMode: LocationMode = data.locationMode === 'manual' ? 'manual' : 'auto';

  return {
    locationMode,
    manualLocation: isLocationPlace(data.manualLocation) ? data.manualLocation : null,
    autoLocation: isAutoLocation(data.autoLocation) ? data.autoLocation : null,
    heightCm: typeof data.heightCm === 'string' ? data.heightCm : '',
    topSize: isClothingSize(data.topSize) ? data.topSize : null,
    bottomSize: isClothingSize(data.bottomSize) ? data.bottomSize : null,
    shoeSize: isShoeSize(data.shoeSize) ? data.shoeSize : null,
    fitPreference: isFitPreference(data.fitPreference) ? data.fitPreference : null,
    weatherSensitivity: isWeatherSensitivity(data.weatherSensitivity)
      ? data.weatherSensitivity
      : null,
  };
}

export async function loadProfileBodyParameters(): Promise<BodyParameters> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_BODY_PARAMETERS_KEY);

    if (!raw) {
      return EMPTY_BODY_PARAMETERS;
    }

    const parsed = parseBodyParameters(JSON.parse(raw));

    return parsed ?? EMPTY_BODY_PARAMETERS;
  } catch {
    return EMPTY_BODY_PARAMETERS;
  }
}

export async function saveProfileBodyParameters(parameters: BodyParameters): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILE_BODY_PARAMETERS_KEY, JSON.stringify(parameters));
  } catch {
    // Keep in-memory state even if persistence fails.
  }
}

function isStyleExperiment(value: unknown): value is StyleExperiment {
  return typeof value === 'string' && STYLE_EXPERIMENTS.includes(value as StyleExperiment);
}

function isWardrobeMode(value: unknown): value is WardrobeMode {
  return typeof value === 'string' && WARDROBE_MODES.includes(value as WardrobeMode);
}

function parseStylistPreferences(raw: unknown): StylistPreferences | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const data = raw as Partial<StylistPreferences>;

  return {
    considerWeather:
      typeof data.considerWeather === 'boolean'
        ? data.considerWeather
        : DEFAULT_STYLIST_PREFERENCES.considerWeather,
    styleExperiment: isStyleExperiment(data.styleExperiment)
      ? data.styleExperiment
      : DEFAULT_STYLIST_PREFERENCES.styleExperiment,
    wardrobeMode: isWardrobeMode(data.wardrobeMode)
      ? data.wardrobeMode
      : DEFAULT_STYLIST_PREFERENCES.wardrobeMode,
    avoidRepeatedOutfits:
      typeof data.avoidRepeatedOutfits === 'boolean'
        ? data.avoidRepeatedOutfits
        : DEFAULT_STYLIST_PREFERENCES.avoidRepeatedOutfits,
    dailyStylistEnabled:
      typeof data.dailyStylistEnabled === 'boolean'
        ? data.dailyStylistEnabled
        : DEFAULT_STYLIST_PREFERENCES.dailyStylistEnabled,
    dailyStylistTime:
      typeof data.dailyStylistTime === 'string' && /^\d{2}:\d{2}$/.test(data.dailyStylistTime)
        ? data.dailyStylistTime
        : DEFAULT_STYLIST_PREFERENCES.dailyStylistTime,
    timezone:
      typeof data.timezone === 'string' && data.timezone.trim().length > 0
        ? data.timezone.trim()
        : DEFAULT_STYLIST_PREFERENCES.timezone,
  };
}

export async function loadProfileStylistPreferences(): Promise<StylistPreferences> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_STYLIST_PREFERENCES_KEY);

    if (!raw) {
      return DEFAULT_STYLIST_PREFERENCES;
    }

    const parsed = parseStylistPreferences(JSON.parse(raw));

    return parsed ?? DEFAULT_STYLIST_PREFERENCES;
  } catch {
    return DEFAULT_STYLIST_PREFERENCES;
  }
}

export async function saveProfileStylistPreferences(
  preferences: StylistPreferences,
): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILE_STYLIST_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Keep in-memory state even if persistence fails.
  }
}

function parseAccountProfile(raw: unknown): AccountProfile | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const data = raw as Partial<AccountProfile>;
  const displayName =
    typeof data.displayName === 'string' && data.displayName.trim().length > 0
      ? data.displayName.trim()
      : DEFAULT_DISPLAY_NAME;

  const publicId =
    typeof data.publicId === 'string' && isValidPublicId(data.publicId)
      ? data.publicId
      : undefined;
  const serverUserId =
    typeof data.serverUserId === 'string' && data.serverUserId.trim().length > 0
      ? data.serverUserId.trim()
      : undefined;
  const localUserId = typeof data.localUserId === 'string' ? data.localUserId : '';

  if (publicId || localUserId || displayName) {
    return {
      localUserId: publicId ?? localUserId,
      displayName,
      publicId,
      serverUserId,
    };
  }

  return null;
}

export async function loadProfileAccount(): Promise<AccountProfile> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_ACCOUNT_KEY);

    if (raw) {
      const parsed = parseAccountProfile(JSON.parse(raw));

      if (parsed) {
        return parsed;
      }
    }
  } catch {
    // Fall through to create a new local account profile.
  }

  return {
    ...DEFAULT_ACCOUNT_PROFILE,
    displayName: DEFAULT_DISPLAY_NAME,
  };
}

export async function saveProfileAccount(account: AccountProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILE_ACCOUNT_KEY, JSON.stringify(account));
  } catch {
    // Keep in-memory state even if persistence fails.
  }
}
