import type { Request, Response } from 'express';
import { Router } from 'express';

import { findUserById, findUserByPublicId } from '../db/users-repository';
import {
  DailyOutfitGenerationError,
  generateAndStoreDailyOutfit,
} from '../daily-outfits/generate-daily-outfit';
import { requireAuth } from '../middleware/auth';
import type { SuggestOutfitsLocation } from '../suggest-outfits';

const devDailyOutfitRouter = Router();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLocalDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseLocation(value: unknown): SuggestOutfitsLocation | null {
  if (!isRecord(value)) {
    return null;
  }

  const latitude = value.latitude;
  const longitude = value.longitude;

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
    name: typeof value.name === 'string' && value.name.trim().length > 0 ? value.name.trim() : undefined,
  };
}

function resolveTargetUserId(req: Request): string | null {
  if (!req.authUser) {
    return null;
  }

  const publicId = typeof req.body?.publicId === 'string' ? req.body.publicId.trim() : '';
  const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';

  if (publicId) {
    const user = findUserByPublicId(publicId);
    return user?.id ?? null;
  }

  if (userId) {
    const user = findUserById(userId);
    return user?.id ?? null;
  }

  return req.authUser.id;
}

devDailyOutfitRouter.post('/daily-outfit/generate', requireAuth, async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found.' });
    return;
  }

  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const targetUserId = resolveTargetUserId(req);

  if (!targetUserId) {
    res.status(404).json({ error: 'Пользователь не найден.' });
    return;
  }

  const localDateRaw = typeof req.body?.localDate === 'string' ? req.body.localDate.trim() : '';
  const localDate = isLocalDate(localDateRaw) ? localDateRaw : new Date().toISOString().slice(0, 10);
  const location = parseLocation(req.body?.location);

  try {
    const outfit = await generateAndStoreDailyOutfit({
      userId: targetUserId,
      localDate,
      location,
      force: true,
    });

    res.json({ outfit });
  } catch (error) {
    if (error instanceof DailyOutfitGenerationError) {
      res.status(error.status).json({ error: error.message });
      return;
    }

    console.error('Failed to generate daily outfit:', error);
    res.status(500).json({ error: 'Не удалось сгенерировать daily outfit.' });
  }
});

export { devDailyOutfitRouter };
