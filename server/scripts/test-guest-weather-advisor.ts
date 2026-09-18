import { buildGuestWeatherAdvice } from '../src/outfit-ai/guest-weather-advisor';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function testCold(): void {
  const advice = buildGuestWeatherAdvice({
    temperatureC: 4,
    apparentTemperatureC: 2,
    precipitationMm: 0,
    windSpeedKmh: 8,
    weatherCode: 3,
  });

  assert(advice.includes('прохладно'), advice);
  console.log('OK cold');
}

function testHot(): void {
  const advice = buildGuestWeatherAdvice({
    temperatureC: 30,
    apparentTemperatureC: 32,
    precipitationMm: 0,
    windSpeedKmh: 5,
    weatherCode: 1,
  });

  assert(advice.includes('жарко'), advice);
  console.log('OK hot');
}

function testRain(): void {
  const advice = buildGuestWeatherAdvice({
    temperatureC: 12,
    apparentTemperatureC: 10,
    precipitationMm: 2,
    windSpeedKmh: 10,
    weatherCode: 61,
  });

  assert(advice.toLowerCase().includes('дожд'), advice);
  console.log('OK rain');
}

function testWind(): void {
  const advice = buildGuestWeatherAdvice({
    temperatureC: 14,
    apparentTemperatureC: 12,
    precipitationMm: 0,
    windSpeedKmh: 30,
    weatherCode: 2,
  });

  assert(advice.toLowerCase().includes('ветр'), advice);
  console.log('OK wind');
}

function testColdAndRain(): void {
  const advice = buildGuestWeatherAdvice({
    temperatureC: 3,
    apparentTemperatureC: 1,
    precipitationMm: 4,
    windSpeedKmh: 18,
    weatherCode: 63,
  });

  assert(advice.includes('прохладно'), advice);
  assert(advice.toLowerCase().includes('дожд'), advice);
  console.log('OK cold + rain');
}

function testWeatherMissingFallback(): void {
  const advice = buildGuestWeatherAdvice({});

  assert(advice.includes('Добавьте вещи'), advice);
  console.log('OK weather missing fallback');
}

function main(): void {
  testCold();
  testHot();
  testRain();
  testWind();
  testColdAndRain();
  testWeatherMissingFallback();
  console.log('All guest weather advisor tests passed.');
}

main();
