import type { Request, Response } from 'express';
import { Router } from 'express';

import { createSessionForUser, deleteSessionByToken } from '../db/sessions-repository';
import { createAnonymousUser, toUserResponse } from '../db/users-repository';
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

export { authRouter };
