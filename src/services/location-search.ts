import type { ManualLocation } from '@/constants/body-parameters';

const GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/search';
const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 5;

type GeocodingApiResult = {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
};

type GeocodingApiResponse = {
  results?: GeocodingApiResult[];
};

export function formatCityLabel(location: ManualLocation) {
  return `${location.name}, ${location.country}`;
}

export async function searchCities(
  query: string,
  signal?: AbortSignal,
): Promise<ManualLocation[]> {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < MIN_QUERY_LENGTH) {
    return [];
  }

  const url = `${GEOCODING_API}?name=${encodeURIComponent(trimmedQuery)}&count=${MAX_RESULTS}&language=ru&format=json`;

  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error('City search request failed');
  }

  const data = (await response.json()) as GeocodingApiResponse;

  if (!data.results?.length) {
    return [];
  }

  return data.results.map((result) => ({
    name: result.name,
    country: result.country,
    latitude: result.latitude,
    longitude: result.longitude,
    region: result.admin1 || undefined,
  }));
}

const REVERSE_GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/reverse';

export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
): Promise<ManualLocation> {
  const url = `${REVERSE_GEOCODING_API}?latitude=${latitude}&longitude=${longitude}&language=ru`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Reverse geocoding request failed');
  }

  const data = (await response.json()) as GeocodingApiResponse;
  const result = data.results?.[0];

  if (result) {
    const region = result.admin1 || undefined;

    return {
      name: result.name,
      country: result.country,
      latitude,
      longitude,
      region,
    };
  }

  return {
    name: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
    country: 'Неизвестно',
    latitude,
    longitude,
  };
}

export { MIN_QUERY_LENGTH as CITY_SEARCH_MIN_QUERY_LENGTH, MAX_RESULTS as CITY_SEARCH_MAX_RESULTS };
