import type { WeatherSensitivity } from '@/constants/body-parameters';
import type { StyleExperiment } from '@/constants/stylist-preferences';
import type { WardrobeItem } from '@/contexts/wardrobe-context';
import type { OutfitWeather, SuggestOutfitsLocation } from '@/services/outfit-suggestions';

import { buildLocationKey } from '@/utils/home-location-key';

export type HomeInputSignatureParams = {
  wardrobe: WardrobeItem[];
  styleExperiment: StyleExperiment;
  considerWeather: boolean;
  weatherSensitivity: WeatherSensitivity | null;
  location: SuggestOutfitsLocation | null;
  weather: OutfitWeather | null;
};

function serializeWardrobeItem(item: WardrobeItem): string {
  const printDescription = item.printDescription ?? '';

  return [
    item.id,
    item.name,
    item.category,
    item.color,
    item.pattern,
    printDescription,
    item.style,
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
  styleExperiment,
  considerWeather,
  weatherSensitivity,
  location,
  weather,
}: HomeInputSignatureParams): string {
  const wardrobePart = [...wardrobe]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(serializeWardrobeItem)
    .join(';');

  const locationPart = location ? buildLocationKey(location) : 'none';
  const weatherPart = considerWeather ? normalizeWeatherForSignature(weather) : 'off';

  return [
    wardrobePart,
    styleExperiment,
    considerWeather ? '1' : '0',
    weatherSensitivity ?? 'none',
    locationPart,
    weatherPart,
  ].join('||');
}
