import type { Request, Response } from 'express';

import { getCurrentWeather } from './providers/weather';

function parseCoordinates(body: unknown): { latitude: number; longitude: number } | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const payload = body as Record<string, unknown>;
  const latitude = payload.latitude;
  const longitude = payload.longitude;

  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return { latitude, longitude };
}

export async function currentWeatherHandler(req: Request, res: Response): Promise<void> {
  try {
    const coordinates = parseCoordinates(req.body);

    if (!coordinates) {
      res.status(400).json({ error: 'Некорректные координаты.' });
      return;
    }

    const weather = await getCurrentWeather(coordinates);

    res.json({ weather });
  } catch (error) {
    console.error('Failed to fetch current weather:', error);
    res.status(502).json({ error: 'Не удалось получить погоду.' });
  }
}
