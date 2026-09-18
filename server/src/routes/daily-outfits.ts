import type { Request, Response } from 'express';
import { Router } from 'express';

import {
  DailyOutfitGenerationError,
  generateAndStoreDailyOutfit,
} from '../daily-outfits/generate-daily-outfit';
import { isDailyOutfitInputSignatureStale } from '../daily-outfits/build-daily-outfit-input-signature';
import { getDailyOutfitForDate } from '../db/daily-outfits-repository';
import { requireAuth } from '../middleware/auth';
import type { SuggestOutfitsLocation } from '../suggest-outfits';

const dailyOutfitsRouter = Router();

function isLocalDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseLocalDateParam(value: unknown): string | null {
  if (typeof value === 'string' && isLocalDate(value.trim())) {
    return value.trim();
  }

  return null;
}

function parseLocation(value: unknown): SuggestOutfitsLocation | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const latitude = record.latitude;
  const longitude = record.longitude;

  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
    name:
      typeof record.name === 'string' && record.name.trim().length > 0
        ? record.name.trim()
        : undefined,
  };
}

dailyOutfitsRouter.get('/daily-outfits/today', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const localDate = parseLocalDateParam(req.query.localDate) ?? new Date().toISOString().slice(0, 10);
  const outfit = getDailyOutfitForDate(req.authUser.id, localDate);

  if (!outfit) {
    res.status(404).json({ error: 'Daily outfit not found.' });
    return;
  }

  const isStale = isDailyOutfitInputSignatureStale(
    req.authUser.id,
    localDate,
    outfit.inputSignature,
  );

  res.json({
    outfit: {
      ...outfit,
      isStale,
    },
  });
});

dailyOutfitsRouter.post(
  '/daily-outfits/today/regenerate',
  requireAuth,
  async (req: Request, res: Response) => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const localDateRaw = typeof req.body?.localDate === 'string' ? req.body.localDate.trim() : '';
    const localDate = isLocalDate(localDateRaw) ? localDateRaw : new Date().toISOString().slice(0, 10);
    const location = parseLocation(req.body?.location);

    try {
      const outfit = await generateAndStoreDailyOutfit({
        userId: req.authUser.id,
        localDate,
        location,
      });

      res.json({
        outfit: {
          ...outfit,
          isStale: false,
        },
      });
    } catch (error) {
      if (error instanceof DailyOutfitGenerationError) {
        res.status(error.status).json({ error: error.message });
        return;
      }

      console.error('Failed to regenerate daily outfit:', error);
      res.status(500).json({ error: 'Не удалось перегенерировать daily outfit.' });
    }
  },
);

export { dailyOutfitsRouter };
