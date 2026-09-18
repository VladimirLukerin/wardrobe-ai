import type { Request, Response } from 'express';
import { Router } from 'express';

import { getSavedOutfitsSnapshot, syncSavedOutfits } from '../db/saved-outfits-repository';
import {
  validateSavedOutfitDeleteItem,
  validateSavedOutfitSyncItem,
} from '../db/validate-saved-outfit';
import { requireAuth } from '../middleware/auth';

const outfitsRouter = Router();

outfitsRouter.get('/outfits', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const snapshot = getSavedOutfitsSnapshot(req.authUser.id);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[STATS AUDIT] DB outfits=${snapshot.outfits.length}`);
  }

  res.json(snapshot);
});

outfitsRouter.post('/outfits/sync', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const rawOutfits = Array.isArray(req.body?.outfits) ? req.body.outfits : [];
  const rawDeletedOutfits = Array.isArray(req.body?.deletedOutfits) ? req.body.deletedOutfits : [];

  const outfits = [];

  for (const rawOutfit of rawOutfits) {
    const validated = validateSavedOutfitSyncItem(rawOutfit);

    if (!validated) {
      res.status(400).json({ error: 'Invalid saved outfit payload.' });
      return;
    }

    outfits.push(validated);
  }

  const deletedOutfits = [];

  for (const rawDeletedOutfit of rawDeletedOutfits) {
    const validated = validateSavedOutfitDeleteItem(rawDeletedOutfit);

    if (!validated) {
      res.status(400).json({ error: 'Invalid saved outfit delete payload.' });
      return;
    }

    deletedOutfits.push(validated);
  }

  try {
    if (outfits.length > 0) {
      console.log(`[OUTFITS SYNC] push ${outfits.length}`);
    }

    if (deletedOutfits.length > 0) {
      console.log(`[OUTFITS SYNC] delete ${deletedOutfits.length}`);
    }

    const snapshot = syncSavedOutfits({
      userId: req.authUser.id,
      outfits,
      deletedOutfits,
    });

    res.json(snapshot);
  } catch (error) {
    console.error('Failed to sync saved outfits:', error);
    res.status(500).json({ error: 'Не удалось синхронизировать образы.' });
  }
});

export { outfitsRouter };
