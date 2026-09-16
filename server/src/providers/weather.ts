const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_REQUEST_TIMEOUT_MS = 8000;

export type CurrentWeather = {
  temperatureC: number;
  apparentTemperatureC: number;
  precipitationMm: number;
  weatherCode: number;
  windSpeedKmh: number;
};

type GetCurrentWeatherInput = {
  latitude: number;
  longitude: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseCurrentWeatherPayload(payload: unknown): CurrentWeather {
  if (!isRecord(payload) || !isRecord(payload.current)) {
    throw new Error('Invalid Open-Meteo response shape');
  }

  const current = payload.current;
  const temperatureC = parseNumber(current.temperature_2m);
  const apparentTemperatureC = parseNumber(current.apparent_temperature);
  const precipitationMm = parseNumber(current.precipitation);
  const weatherCode = parseNumber(current.weather_code);
  const windSpeedKmh = parseNumber(current.wind_speed_10m);

  if (
    temperatureC === null ||
    apparentTemperatureC === null ||
    precipitationMm === null ||
    weatherCode === null ||
    windSpeedKmh === null
  ) {
    throw new Error('Incomplete Open-Meteo current weather data');
  }

  return {
    temperatureC,
    apparentTemperatureC,
    precipitationMm,
    weatherCode,
    windSpeedKmh,
  };
}

export async function getCurrentWeather({
  latitude,
  longitude,
}: GetCurrentWeatherInput): Promise<CurrentWeather> {
  const url = new URL(OPEN_METEO_FORECAST_URL);

  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('current', 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m');
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(WEATHER_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();

  return parseCurrentWeatherPayload(payload);
}
