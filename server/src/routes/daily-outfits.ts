import type { Request, Response } from 'express';
import { Router } from 'express';

import { getDailyOutfitForDate } from '../db/daily-outfits-repository';
import { requireAuth } from '../middleware/auth';

const dailyOutfitsRouter = Router();

function isLocalDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

dailyOutfitsRouter.get('/daily-outfits/today', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const localDateParam = req.query.localDate;
  const localDate =
    typeof localDateParam === 'string' && isLocalDate(localDateParam)
      ? localDateParam
      : new Date().toISOString().slice(0, 10);

  const outfit = getDailyOutfitForDate(req.authUser.id, localDate);

  if (!outfit) {
    res.status(404).json({ error: 'Daily outfit not found.' });
    return;
  }

  res.json({ outfit });
});

export { dailyOutfitsRouter };
