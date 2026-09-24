export function getWeatherSymbolName(weatherCode: number): {
  ios: string;
  android: string;
  web: string;
} {
  if (weatherCode === 0) {
    return { ios: 'sun.max.fill', android: 'wb_sunny', web: 'wb_sunny' };
  }

  if (weatherCode >= 1 && weatherCode <= 3) {
    return { ios: 'cloud.fill', android: 'cloud', web: 'cloud' };
  }

  if (weatherCode === 45 || weatherCode === 48) {
    return { ios: 'cloud.fog.fill', android: 'foggy', web: 'foggy' };
  }

  if (weatherCode >= 51 && weatherCode <= 67) {
    return { ios: 'cloud.rain.fill', android: 'rainy', web: 'rainy' };
  }

  if (weatherCode >= 71 && weatherCode <= 86) {
    return { ios: 'cloud.snow.fill', android: 'ac_unit', web: 'ac_unit' };
  }

  if (weatherCode >= 95 && weatherCode <= 99) {
    return { ios: 'cloud.bolt.rain.fill', android: 'thunderstorm', web: 'thunderstorm' };
  }

  return { ios: 'cloud.sun.fill', android: 'partly_cloudy_day', web: 'partly_cloudy_day' };
}
