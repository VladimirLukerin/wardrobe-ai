import type { Request, Response } from 'express';
import { Router } from 'express';

import {
  getWardrobeSnapshot,
  syncWardrobeItems,
} from '../db/wardrobe-items-repository';
import {
  validateWardrobeDeleteItem,
  validateWardrobeSyncItem,
} from '../db/validate-wardrobe-item';
import { requireAuth } from '../middleware/auth';

const wardrobeRouter = Router();

wardrobeRouter.get('/wardrobe', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  res.json(getWardrobeSnapshot(req.authUser.id));
});

wardrobeRouter.post('/wardrobe/sync', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
  const rawDeletedItems = Array.isArray(req.body?.deletedItems) ? req.body.deletedItems : [];

  const items = [];
  for (const rawItem of rawItems) {
    const validated = validateWardrobeSyncItem(rawItem);

    if (!validated) {
      res.status(400).json({ error: 'Invalid wardrobe item payload.' });
      return;
    }

    items.push(validated);
  }

  const deletedItems = [];
  for (const rawDeletedItem of rawDeletedItems) {
    const validated = validateWardrobeDeleteItem(rawDeletedItem);

    if (!validated) {
      res.status(400).json({ error: 'Invalid wardrobe delete payload.' });
      return;
    }

    deletedItems.push(validated);
  }

  try {
    if (items.length > 0) {
      console.log(`[WARDROBE SYNC] push ${items.length}`);
    }

    if (deletedItems.length > 0) {
      console.log(`[WARDROBE SYNC] delete ${deletedItems.length}`);
    }

    const snapshot = syncWardrobeItems({
      userId: req.authUser.id,
      items,
      deletedItems,
    });

    res.json(snapshot);
  } catch (error) {
    console.error('Failed to sync wardrobe:', error);
    res.status(500).json({ error: 'Не удалось синхронизировать гардероб.' });
  }
});

export { wardrobeRouter };
