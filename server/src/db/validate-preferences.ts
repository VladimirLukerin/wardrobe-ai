const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
const SHOE_SIZES_EU = [
  '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48',
] as const;
const FIT_PREFERENCES = ['По фигуре', 'Обычная', 'Свободная'] as const;
const WEATHER_SENSITIVITIES = ['Часто мёрзну', 'Обычно', 'Мне часто жарко'] as const;
const STYLE_EXPERIMENTS = ['familiar', 'balanced', 'bold'] as const;
const WARDROBE_MODES = ['owned-only', 'allow-suggestions'] as const;

type LocationPlace = {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  region?: string;
};

export type ValidatedBodyParameters = {
  locationMode: 'auto' | 'manual';
  manualLocation: LocationPlace | null;
  autoLocation: (LocationPlace & { source: 'auto' }) | null;
  heightCm: string;
  topSize: (typeof CLOTHING_SIZES)[number] | null;
  bottomSize: (typeof CLOTHING_SIZES)[number] | null;
  shoeSize: (typeof SHOE_SIZES_EU)[number] | null;
  fitPreference: (typeof FIT_PREFERENCES)[number] | null;
  weatherSensitivity: (typeof WEATHER_SENSITIVITIES)[number] | null;
};

export type ValidatedStylistPreferences = {
  considerWeather: boolean;
  styleExperiment: (typeof STYLE_EXPERIMENTS)[number];
  wardrobeMode: (typeof WARDROBE_MODES)[number];
  avoidRepeatedOutfits: boolean;
};

function isLocationPlace(value: unknown): value is LocationPlace {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const location = value as LocationPlace;

  return (
    typeof location.name === 'string' &&
    typeof location.country === 'string' &&
    typeof location.latitude === 'number' &&
    Number.isFinite(location.latitude) &&
    typeof location.longitude === 'number' &&
    Number.isFinite(location.longitude) &&
    (location.region === undefined || typeof location.region === 'string')
  );
}

function isAutoLocation(value: unknown): value is LocationPlace & { source: 'auto' } {
  return isLocationPlace(value) && (value as { source?: string }).source === 'auto';
}

function isClothingSize(value: unknown): value is (typeof CLOTHING_SIZES)[number] {
  return typeof value === 'string' && CLOTHING_SIZES.includes(value as never);
}

function isShoeSize(value: unknown): value is (typeof SHOE_SIZES_EU)[number] {
  return typeof value === 'string' && SHOE_SIZES_EU.includes(value as never);
}

function isFitPreference(value: unknown): value is (typeof FIT_PREFERENCES)[number] {
  return typeof value === 'string' && FIT_PREFERENCES.includes(value as never);
}

function isWeatherSensitivity(value: unknown): value is (typeof WEATHER_SENSITIVITIES)[number] {
  return typeof value === 'string' && WEATHER_SENSITIVITIES.includes(value as never);
}

function isStyleExperiment(value: unknown): value is (typeof STYLE_EXPERIMENTS)[number] {
  return typeof value === 'string' && STYLE_EXPERIMENTS.includes(value as never);
}

function isWardrobeMode(value: unknown): value is (typeof WARDROBE_MODES)[number] {
  return typeof value === 'string' && WARDROBE_MODES.includes(value as never);
}

export function validateBodyParameters(value: unknown): ValidatedBodyParameters | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'object') {
    return null;
  }

  const data = value as Record<string, unknown>;
  const locationMode = data.locationMode === 'manual' ? 'manual' : 'auto';

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

export function validateStylistPreferences(value: unknown): ValidatedStylistPreferences | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'object') {
    return null;
  }

  const data = value as Record<string, unknown>;

  if (typeof data.considerWeather !== 'boolean') {
    return null;
  }

  if (!isStyleExperiment(data.styleExperiment)) {
    return null;
  }

  if (!isWardrobeMode(data.wardrobeMode)) {
    return null;
  }

  if (typeof data.avoidRepeatedOutfits !== 'boolean') {
    return null;
  }

  return {
    considerWeather: data.considerWeather,
    styleExperiment: data.styleExperiment,
    wardrobeMode: data.wardrobeMode,
    avoidRepeatedOutfits: data.avoidRepeatedOutfits,
  };
}

export const DISPLAY_NAME_MAX_LENGTH = 50;

export function validateDisplayName(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    return null;
  }

  return trimmed;
}
