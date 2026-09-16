export function getWeatherCodeLabel(weatherCode: number): string {
  if (weatherCode === 0) {
    return 'Ясно';
  }

  if (weatherCode >= 1 && weatherCode <= 3) {
    return 'Облачно';
  }

  if (weatherCode === 45 || weatherCode === 48) {
    return 'Туман';
  }

  if (weatherCode >= 51 && weatherCode <= 57) {
    return 'Морось';
  }

  if (weatherCode >= 61 && weatherCode <= 67) {
    return 'Дождь';
  }

  if (weatherCode >= 71 && weatherCode <= 77) {
    return 'Снег';
  }

  if (weatherCode >= 80 && weatherCode <= 82) {
    return 'Ливень';
  }

  if (weatherCode >= 85 && weatherCode <= 86) {
    return 'Снегопад';
  }

  if (weatherCode >= 95 && weatherCode <= 99) {
    return 'Гроза';
  }

  return 'Переменная погода';
}

export function formatWeatherTemperature(value: number): string {
  const rounded = Math.round(value);

  if (rounded > 0) {
    return `+${rounded}°`;
  }

  return `${rounded}°`;
}

export function formatOutfitWeatherLine(
  weather: {
    temperatureC: number;
    apparentTemperatureC: number;
    weatherCode: number;
  },
  locationName?: string,
): string {
  const conditions = getWeatherCodeLabel(weather.weatherCode).toLowerCase();
  const summary = `${formatWeatherTemperature(weather.temperatureC)} · ощущается как ${formatWeatherTemperature(weather.apparentTemperatureC)} · ${conditions}`;

  if (locationName) {
    return `${locationName} · ${summary}`;
  }

  return summary;
}
