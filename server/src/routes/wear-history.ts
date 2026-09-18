import type { Request, Response } from 'express';
import { Router } from 'express';

import { getSavedOutfitsSnapshot } from '../db/saved-outfits-repository';
import { getWearHistorySnapshot, syncWearEvents } from '../db/wear-events-repository';
import {
  validateWearEventDeleteItem,
  validateWearEventSyncItem,
} from '../db/validate-wear-event';
import { requireAuth } from '../middleware/auth';

const wearHistoryRouter = Router();

wearHistoryRouter.get('/wear-history', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const snapshot = getWearHistorySnapshot(req.authUser.id);

  if (process.env.NODE_ENV !== 'production') {
    const outfitsSnapshot = getSavedOutfitsSnapshot(req.authUser.id);
    console.log(
      `[STATS AUDIT] DB wear=${snapshot.events.length} outfits=${outfitsSnapshot.outfits.length}`,
    );
  }

  res.json(snapshot);
});

wearHistoryRouter.post('/wear-history/sync', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const rawEvents = Array.isArray(req.body?.events) ? req.body.events : [];
  const rawDeletedEvents = Array.isArray(req.body?.deletedEvents) ? req.body.deletedEvents : [];

  const events = [];

  for (const rawEvent of rawEvents) {
    const validated = validateWearEventSyncItem(rawEvent);

    if (!validated) {
      res.status(400).json({ error: 'Invalid wear event payload.' });
      return;
    }

    events.push(validated);
  }

  const deletedEvents = [];

  for (const rawDeletedEvent of rawDeletedEvents) {
    const validated = validateWearEventDeleteItem(rawDeletedEvent);

    if (!validated) {
      res.status(400).json({ error: 'Invalid wear event delete payload.' });
      return;
    }

    deletedEvents.push(validated);
  }

  try {
    if (events.length > 0) {
      console.log(`[WEAR SYNC] push ${events.length}`);
    }

    if (deletedEvents.length > 0) {
      console.log(`[WEAR SYNC] delete ${deletedEvents.length}`);
    }

    const snapshot = syncWearEvents({
      userId: req.authUser.id,
      events,
      deletedEvents,
    });

    res.json(snapshot);
  } catch (error) {
    console.error('Failed to sync wear history:', error);
    res.status(500).json({ error: 'Не удалось синхронизировать историю носки.' });
  }
});

export { wearHistoryRouter };
