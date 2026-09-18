import type { Request, Response } from 'express';
import { Router } from 'express';

import { normalizeEmail } from '../auth/normalize-email';
import {
  checkPasswordLoginRateLimit,
  getPasswordLoginClientIp,
  recordPasswordLoginAttempt,
  recordPasswordLoginFailure,
  resetPasswordLoginEmailFailures,
  respondPasswordLoginRateLimited,
} from '../auth/password-login-rate-limit';
import { hashPassword, validatePasswordInput, verifyPassword } from '../auth/password';
import { requireAuth } from '../middleware/auth';
import {
  getPasswordCredential,
  hasPasswordCredential,
  setPasswordCredential,
  updatePasswordCredential,
} from '../db/password-credentials-repository';
import {
  createSessionForUser,
  deleteOtherSessionsForUser,
} from '../db/sessions-repository';
import { toUserResponse } from '../db/users-repository';

const passwordMeRouter = Router();

function sendPasswordValidationError(res: Response, message: string): void {
  res.status(400).json({ error: message });
}

passwordMeRouter.post('/password', requireAuth, async (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!req.authUser.emailVerified || !req.authUser.email) {
    res.status(400).json({
      error: 'Чтобы использовать пароль, сначала подключите email.',
    });
    return;
  }

  if (hasPasswordCredential(req.authUser.id)) {
    res.status(409).json({
      error: 'Пароль уже установлен.',
      code: 'PASSWORD_ALREADY_SET',
    });
    return;
  }

  const validated = validatePasswordInput(req.body?.password);

  if (!validated.ok) {
    sendPasswordValidationError(res, validated.message);
    return;
  }

  try {
    const material = await hashPassword(validated.password);

    setPasswordCredential({
      userId: req.authUser.id,
      passwordHash: material.passwordHash,
      passwordSalt: material.passwordSalt,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to set password:', error);
    res.status(500).json({ error: 'Не удалось сохранить пароль.' });
  }
});

passwordMeRouter.put('/password', requireAuth, async (req: Request, res: Response) => {
  if (!req.authUser || !req.authSessionToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const currentValidated = validatePasswordInput(req.body?.currentPassword);

  if (!currentValidated.ok) {
    res.status(400).json({
      error: 'Текущий пароль указан неверно.',
      code: 'INVALID_CURRENT_PASSWORD',
    });
    return;
  }

  const newValidated = validatePasswordInput(req.body?.newPassword);

  if (!newValidated.ok) {
    sendPasswordValidationError(res, newValidated.message);
    return;
  }

  const credential = getPasswordCredential(req.authUser.id);

  if (!credential) {
    res.status(400).json({
      error: 'Текущий пароль указан неверно.',
      code: 'INVALID_CURRENT_PASSWORD',
    });
    return;
  }

  try {
    const isCurrentValid = await verifyPassword(currentValidated.password, credential);

    if (!isCurrentValid) {
      res.status(400).json({
        error: 'Текущий пароль указан неверно.',
        code: 'INVALID_CURRENT_PASSWORD',
      });
      return;
    }

    const material = await hashPassword(newValidated.password);
    const updated = updatePasswordCredential({
      userId: req.authUser.id,
      passwordHash: material.passwordHash,
      passwordSalt: material.passwordSalt,
    });

    if (!updated) {
      res.status(500).json({ error: 'Не удалось сохранить пароль.' });
      return;
    }

    deleteOtherSessionsForUser(req.authUser.id, req.authSessionToken);

    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to change password:', error);
    res.status(500).json({ error: 'Не удалось сохранить пароль.' });
  }
});

export { passwordMeRouter };
