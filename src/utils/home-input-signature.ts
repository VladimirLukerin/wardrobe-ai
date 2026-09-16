import type { FitPreference, WeatherSensitivity } from '@/constants/body-parameters';
import type { StylistPreferences } from '@/constants/stylist-preferences';
import type { WardrobeItem } from '@/contexts/wardrobe-context';
import type { OutfitWeather, SuggestOutfitsLocation } from '@/services/outfit-suggestions';
import {
  buildBehavioralContext,
  buildBehavioralContextSignature,
} from '@/utils/build-stylist-context';
import {
  normalizeLastWornAtForSignature,
  type WearHistoryLookup,
} from '@/utils/build-wardrobe-suggestion-payload';

import { buildLocationKey } from '@/utils/home-location-key';
import type { SavedOutfit } from '@/constants/saved-outfit';
import type { WearEvent } from '@/constants/wear-event';

export type HomeInputSignatureParams = {
  wardrobe: WardrobeItem[];
  stylistPreferences: StylistPreferences;
  userParameters: {
    fitPreference: FitPreference | null;
    weatherSensitivity: WeatherSensitivity | null;
  };
  location: SuggestOutfitsLocation | null;
  weather: OutfitWeather | null;
  wearHistory: WearHistoryLookup;
  savedOutfits: SavedOutfit[];
  wearEvents: WearEvent[];
};

function serializeWardrobeItem(item: WardrobeItem, wearHistory: WearHistoryLookup): string {
  const printDescription = item.printDescription ?? '';
  const wearCount = wearHistory.getItemWearCount(item.id);
  const lastWornPart = normalizeLastWornAtForSignature(
    wearHistory.getItemLastWornAt(item.id) ?? null,
  );

  return [
    item.id,
    item.name,
    item.category,
    item.color,
    item.pattern,
    printDescription,
    item.style,
    item.isFavorite === true ? '1' : '0',
    wearCount,
    lastWornPart,
  ].join(':');
}

export function normalizeWeatherForSignature(weather: OutfitWeather | null): string {
  if (!weather) {
    return 'none';
  }

  return [
    Math.round(weather.temperatureC),
    Math.round(weather.apparentTemperatureC),
    Math.round(weather.precipitationMm * 10) / 10,
    weather.weatherCode,
    Math.round(weather.windSpeedKmh),
  ].join('|');
}

export function buildHomeInputSignature({
  wardrobe,
  stylistPreferences,
  userParameters,
  location,
  weather,
  wearHistory,
  savedOutfits,
  wearEvents,
}: HomeInputSignatureParams): string {
  const wardrobePart = [...wardrobe]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((item) => serializeWardrobeItem(item, wearHistory))
    .join(';');

  const locationPart = location ? buildLocationKey(location) : 'none';
  const weatherPart = stylistPreferences.considerWeather
    ? normalizeWeatherForSignature(weather)
    : 'off';

  const behavioralContext = buildBehavioralContext({
    wardrobe,
    savedOutfits,
    wearEvents,
    wearHistory,
    avoidRepeatedOutfits: stylistPreferences.avoidRepeatedOutfits,
  });

  const behavioralPart = buildBehavioralContextSignature(behavioralContext);

  return [
    wardrobePart,
    stylistPreferences.styleExperiment,
    stylistPreferences.considerWeather ? '1' : '0',
    stylistPreferences.avoidRepeatedOutfits ? '1' : '0',
    stylistPreferences.wardrobeMode,
    userParameters.weatherSensitivity ?? 'none',
    userParameters.fitPreference ?? 'none',
    locationPart,
    weatherPart,
    behavioralPart,
  ].join('||');
}
