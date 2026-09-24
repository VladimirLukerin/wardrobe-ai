export type GuestWeatherInput = {
  temperatureC?: number | null;
  apparentTemperatureC?: number | null;
  precipitationMm?: number | null;
  windSpeedKmh?: number | null;
  weatherCode?: number | null;
};

function hasWeatherData(input: GuestWeatherInput): boolean {
  return (
    typeof input.temperatureC === 'number' ||
    typeof input.apparentTemperatureC === 'number' ||
    typeof input.precipitationMm === 'number' ||
    typeof input.windSpeedKmh === 'number' ||
    typeof input.weatherCode === 'number'
  );
}

function getEffectiveTemperature(input: GuestWeatherInput): number | null {
  if (typeof input.apparentTemperatureC === 'number') {
    return input.apparentTemperatureC;
  }

  if (typeof input.temperatureC === 'number') {
    return input.temperatureC;
  }

  return null;
}

function isRainy(input: GuestWeatherInput): boolean {
  if (typeof input.precipitationMm === 'number' && input.precipitationMm >= 0.5) {
    return true;
  }

  if (typeof input.weatherCode !== 'number') {
    return false;
  }

  return input.weatherCode >= 51 && input.weatherCode <= 67;
}

function isWindy(input: GuestWeatherInput): boolean {
  return typeof input.windSpeedKmh === 'number' && input.windSpeedKmh >= 25;
}

export function buildGuestWeatherAdvice(input: GuestWeatherInput): string {
  if (!hasWeatherData(input)) {
    return 'Добавьте вещи в гардероб, чтобы Wardrobe AI подобрал конкретный образ под вашу погоду.';
  }

  const apparent = getEffectiveTemperature(input);
  const parts: string[] = [];

  if (apparent !== null && apparent <= 10) {
    parts.push(
      'Сегодня прохладно. Лучше выбрать свитер или худи, лёгкую куртку и закрытую обувь.',
    );
  } else if (apparent !== null && apparent >= 24) {
    parts.push('Сегодня жарко. Подойдёт лёгкий верх, шорты или лёгкие брюки и лёгкая обувь.');
  } else if (apparent !== null) {
    parts.push('Сегодня комфортная погода. Подойдёт лёгкий верх, брюки или джинсы и удобная обувь.');
  }

  if (isRainy(input)) {
    parts.push('Возможен дождь. Лучше выбрать закрытую обувь и верхний слой, защищающий от осадков.');
  }

  if (isWindy(input)) {
    parts.push('Будет ветрено — добавьте верхний слой или лёгкую куртку.');
  }

  if (parts.length === 0) {
    return 'Добавьте вещи в гардероб, чтобы Wardrobe AI подобрал конкретный образ под вашу погоду.';
  }

  return parts.join(' ');
}

export function buildGuestHomeCta(wardrobeCount: number): string {
  if (wardrobeCount === 0) {
    return 'Добавьте вещи в гардероб, чтобы Wardrobe AI подобрал конкретный образ.';
  }

  if (wardrobeCount < 5) {
    return 'Добавьте ещё несколько вещей для персонального подбора образов.';
  }

  return 'Войдите в аккаунт, чтобы получать персональные образы от AI.';
}
