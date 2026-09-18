import { buildDailyInputSignature } from '../db/daily-outfits-repository';
import { getPreferencesResponse } from '../db/user-preferences-repository';
import { getActiveWardrobeItemsForUser } from '../db/wardrobe-items-repository';
import type { ValidatedBodyParameters } from '../db/validate-preferences';
import type { SuggestOutfitsLocation } from '../suggest-outfits';

export type BuildDailyOutfitInputSignatureParams = {
  userId: string;
  localDate: string;
  locationOverride?: SuggestOutfitsLocation | null;
};

type NormalizedLocationPlace = {
  latitude: number;
  longitude: number;
  name: string;
  country: string;
  region: string;
};

function normalizeLocationPlace(
  place: {
    latitude: number;
    longitude: number;
    name: string;
    country?: string;
    region?: string;
  } | null,
): NormalizedLocationPlace | null {
  if (!place) {
    return null;
  }

  return {
    latitude: place.latitude,
    longitude: place.longitude,
    name: place.name,
    country: place.country ?? '',
    region: place.region ?? '',
  };
}

function resolveActiveLocation(body: ValidatedBodyParameters | null): SuggestOutfitsLocation | null {
  if (!body) {
    return null;
  }

  if (body.locationMode === 'manual' && body.manualLocation) {
    return {
      latitude: body.manualLocation.latitude,
      longitude: body.manualLocation.longitude,
      name: body.manualLocation.name,
    };
  }

  if (body.autoLocation) {
    return {
      latitude: body.autoLocation.latitude,
      longitude: body.autoLocation.longitude,
      name: body.autoLocation.name,
    };
  }

  return null;
}

function buildLocationPreferences(body: ValidatedBodyParameters | null) {
  if (!body) {
    return {
      locationMode: 'auto' as const,
      manualLocation: null,
      autoLocation: null,
    };
  }

  return {
    locationMode: body.locationMode,
    manualLocation: normalizeLocationPlace(body.manualLocation),
    autoLocation: normalizeLocationPlace(body.autoLocation),
  };
}

export function buildDailyOutfitInputSignature({
  userId,
  localDate,
  locationOverride,
}: BuildDailyOutfitInputSignatureParams): string {
  const wardrobe = getActiveWardrobeItemsForUser(userId);
  const preferences = getPreferencesResponse(userId);
  const body = preferences.bodyParameters;
  const stylist = preferences.stylistPreferences;
  const considerWeather = stylist?.considerWeather ?? true;
  const locationPreferences = buildLocationPreferences(body);
  const activeLocation = locationOverride ?? resolveActiveLocation(body);

  return buildDailyInputSignature({
    localDate,
    wardrobe: wardrobe
      .map((item) => ({ id: item.id, updatedAt: item.updatedAt }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    stylistPreferences: {
      considerWeather,
      styleExperiment: stylist?.styleExperiment ?? 'balanced',
      wardrobeMode: stylist?.wardrobeMode ?? 'owned-only',
      avoidRepeatedOutfits: stylist?.avoidRepeatedOutfits ?? true,
    },
    bodyParameters: {
      fitPreference: body?.fitPreference ?? null,
      weatherSensitivity: body?.weatherSensitivity ?? null,
    },
    locationPreferences,
    weatherLocation:
      considerWeather && activeLocation
        ? {
            latitude: activeLocation.latitude,
            longitude: activeLocation.longitude,
            name: activeLocation.name ?? '',
          }
        : null,
  });
}

export function isDailyOutfitInputSignatureStale(
  userId: string,
  localDate: string,
  storedSignature: string,
  locationOverride?: SuggestOutfitsLocation | null,
): boolean {
  const currentSignature = buildDailyOutfitInputSignature({
    userId,
    localDate,
    locationOverride,
  });
  const stale = currentSignature !== storedSignature;

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DAILY SIGNATURE] stale=${stale}`);
  }

  return stale;
}
