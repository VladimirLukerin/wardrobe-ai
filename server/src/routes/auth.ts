import type { Request, Response } from 'express';
import { Router } from 'express';

import { createSessionForUser, deleteSessionByToken } from '../db/sessions-repository';
import {
  createAnonymousUser,
  toUserResponse,
  updateUserDisplayName,
} from '../db/users-repository';
import { DISPLAY_NAME_MAX_LENGTH, validateDisplayName } from '../db/validate-preferences';
import { requireAuth } from '../middleware/auth';

const authRouter = Router();

authRouter.post('/anonymous', (req, res) => {
  try {
    const displayName =
      typeof req.body?.displayName === 'string' && req.body.displayName.trim().length > 0
        ? req.body.displayName.trim()
        : null;

    const user = createAnonymousUser(displayName);
    const { token } = createSessionForUser(user.id);

    res.status(201).json({
      user: toUserResponse(user),
      token,
    });
  } catch (error) {
    console.error('Failed to create anonymous account:', error);
    res.status(500).json({ error: 'Не удалось создать аккаунт.' });
  }
});

authRouter.post('/logout', requireAuth, (req, res) => {
  const authorizationHeader = req.headers.authorization;
  const token =
    authorizationHeader?.startsWith('Bearer ')
      ? authorizationHeader.slice('Bearer '.length).trim()
      : '';

  if (token) {
    deleteSessionByToken(token);
  }

  res.status(204).send();
});

export function meHandler(req: Request, res: Response): void {
  res.json({
    user: req.authUser,
  });
}

// Only displayName is editable here; email/phone change exclusively through their verify flows.
export function patchMeHandler(req: Request, res: Response): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (typeof req.body?.displayName !== 'string') {
    res.status(400).json({ error: 'Укажите имя.' });
    return;
  }

  const displayName = validateDisplayName(req.body.displayName);

  if (!displayName) {
    res.status(400).json({
      error: `Имя должно быть от 1 до ${DISPLAY_NAME_MAX_LENGTH} символов.`,
    });
    return;
  }

  try {
    const updated = updateUserDisplayName(req.authUser.id, displayName);

    if (!updated) {
      res.status(404).json({ error: 'Пользователь не найден.' });
      return;
    }

    res.json({ user: toUserResponse(updated) });
  } catch (error) {
    console.error('Failed to update display name:', error);
    res.status(500).json({ error: 'Не удалось сохранить имя.' });
  }
}

export { authRouter };
