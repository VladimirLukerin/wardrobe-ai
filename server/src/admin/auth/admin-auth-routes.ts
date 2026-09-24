import type { Request, Response } from 'express';
import { Router } from 'express';

import { normalizeEmail } from '../../auth/normalize-email';
import { validatePasswordInput, verifyPassword } from '../../auth/password';
import { getPasswordCredential } from '../../db/password-credentials-repository';
import { findUserByVerifiedEmail } from '../../db/users-repository';
import {
  checkAdminLoginRateLimit,
  getAdminLoginClientIp,
  recordAdminLoginAttempt,
  recordAdminLoginFailure,
  resetAdminLoginEmailFailures,
  respondAdminLoginRateLimited,
} from '../auth/admin-login-rate-limit';
import { recordAdminAudit } from '../audit/admin-audit';
import {
  createAdminSession,
  deleteAdminSessionByToken,
} from '../db/admin-sessions-repository';
import {
  findAdminIdentityByVerifiedEmail,
  toAdminUserIdentity,
} from '../db/admin-identity-repository';
import { requireAdminSession } from '../middleware/require-admin-session';

export const adminAuthRouter = Router();

function respondInvalidAdminCredentials(res: Response): void {
  res.status(401).json({
    error: 'Неверный email или пароль.',
    code: 'INVALID_ADMIN_CREDENTIALS',
  });
}

adminAuthRouter.post('/login', async (req: Request, res: Response) => {
  const normalized = normalizeEmail(req.body?.email);

  if (!normalized.ok) {
    respondInvalidAdminCredentials(res);
    return;
  }

  const passwordValidated = validatePasswordInput(req.body?.password);

  if (!passwordValidated.ok) {
    respondInvalidAdminCredentials(res);
    return;
  }

  const ip = getAdminLoginClientIp(req);
  const rateLimit = checkAdminLoginRateLimit(normalized.email, ip);

  if (!rateLimit.allowed) {
    respondAdminLoginRateLimited(res, rateLimit.retryAfterSeconds);
    return;
  }

  recordAdminLoginAttempt(ip);

  const targetUser = findUserByVerifiedEmail(normalized.email);
  const credential = targetUser ? getPasswordCredential(targetUser.id) : null;
  const adminIdentity = findAdminIdentityByVerifiedEmail(normalized.email);

  if (!targetUser || !credential || !adminIdentity) {
    recordAdminLoginFailure(normalized.email, ip);
    recordAdminAudit(req, {
      adminUserId: targetUser?.id ?? null,
      action: 'admin.login.failure',
      metadata: { reason: 'invalid_credentials' },
    });
    respondInvalidAdminCredentials(res);
    return;
  }

  try {
    const isValid = await verifyPassword(passwordValidated.password, credential);

    if (!isValid) {
      recordAdminLoginFailure(normalized.email, ip);
      recordAdminAudit(req, {
        adminUserId: targetUser.id,
        action: 'admin.login.failure',
        metadata: { reason: 'invalid_password' },
      });
      respondInvalidAdminCredentials(res);
      return;
    }

    resetAdminLoginEmailFailures(normalized.email);

    const { token } = createAdminSession(targetUser.id);

    recordAdminAudit(req, {
      adminUserId: targetUser.id,
      action: 'admin.login.success',
    });

    res.json({
      token,
      admin: adminIdentity,
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminAuthRouter.post('/logout', requireAdminSession, (req: Request, res: Response) => {
  const token = req.adminSessionToken;

  if (token) {
    deleteAdminSessionByToken(token);
  }

  recordAdminAudit(req, {
    adminUserId: req.adminUser?.id ?? null,
    action: 'admin.logout',
  });

  res.status(204).send();
});

adminAuthRouter.get('/me', requireAdminSession, (req: Request, res: Response) => {
  if (!req.adminUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  res.json({ admin: req.adminUser });
});
