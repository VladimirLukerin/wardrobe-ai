import type { Request, Response } from 'express';
import { Router } from 'express';

import {
  getPreferencesResponse,
  upsertUserPreferences,
} from '../db/user-preferences-repository';
import { updateUserDisplayName } from '../db/users-repository';
import {
  validateBodyParameters,
  validateDisplayName,
  validateStylistPreferences,
} from '../db/validate-preferences';
import { requireAuth } from '../middleware/auth';

const preferencesRouter = Router();

preferencesRouter.get('/preferences', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  res.json(getPreferencesResponse(req.authUser.id));
});

preferencesRouter.put('/preferences', requireAuth, (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const displayName = validateDisplayName(req.body?.displayName);
  const bodyParameters = validateBodyParameters(req.body?.bodyParameters);
  const stylistPreferences = validateStylistPreferences(req.body?.stylistPreferences);

  if (req.body?.displayName !== undefined && req.body?.displayName !== null && !displayName) {
    res.status(400).json({ error: 'Invalid displayName.' });
    return;
  }

  if (req.body?.bodyParameters !== undefined && req.body?.bodyParameters !== null && !bodyParameters) {
    res.status(400).json({ error: 'Invalid bodyParameters.' });
    return;
  }

  if (
    req.body?.stylistPreferences !== undefined &&
    req.body?.stylistPreferences !== null &&
    !stylistPreferences
  ) {
    res.status(400).json({ error: 'Invalid stylistPreferences.' });
    return;
  }

  if (!bodyParameters || !stylistPreferences) {
    res.status(400).json({ error: 'bodyParameters and stylistPreferences are required.' });
    return;
  }

  try {
    if (displayName !== null) {
      updateUserDisplayName(req.authUser.id, displayName);
    }

    const updatedAt = new Date().toISOString();
    const response = upsertUserPreferences({
      userId: req.authUser.id,
      bodyParameters,
      stylistPreferences,
      updatedAt,
    });

    console.log('[PREFERENCES SYNC] push');

    res.json(response);
  } catch (error) {
    console.error('Failed to update user preferences:', error);
    res.status(500).json({ error: 'Не удалось сохранить настройки.' });
  }
});

export { preferencesRouter };
