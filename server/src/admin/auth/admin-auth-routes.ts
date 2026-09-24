import type { Request, Response } from 'express';
import { Router } from 'express';

import { normalizeEmail } from '../../auth/normalize-email';
import { validatePasswordInput } from '../../auth/password';
import {
  checkAdminLoginRateLimit,
  getAdminLoginClientIp,
  recordAdminLoginAttempt,
  recordAdminLoginFailure,
  resetAdminLoginEmailFailures,
  respondAdminLoginRateLimited,
} from '../auth/admin-login-rate-limit';
import { verifyAdminPassword } from '../admin-password';
import { recordAdminAudit } from '../audit/admin-audit';
import {
  createAdminSession,
  deleteAdminSessionByToken,
} from '../db/admin-sessions-repository';
import {
  findAdminUserByEmail,
  markAdminUserLogin,
  toAdminUserIdentity,
} from '../db/admin-users-repository';
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

  const adminUser = findAdminUserByEmail(normalized.email);

  if (!adminUser || adminUser.is_active !== 1) {
    recordAdminLoginFailure(normalized.email, ip);
    recordAdminAudit(req, {
      adminUserId: adminUser?.id ?? null,
      action: 'admin.login.failure',
      metadata: { reason: adminUser && adminUser.is_active !== 1 ? 'inactive' : 'unknown_account' },
    });
    respondInvalidAdminCredentials(res);
    return;
  }

  try {
    const isValid = await verifyAdminPassword(passwordValidated.password, {
      password_hash: adminUser.password_hash,
      password_salt: adminUser.password_salt,
    });

    if (!isValid) {
      recordAdminLoginFailure(normalized.email, ip);
      recordAdminAudit(req, {
        adminUserId: adminUser.id,
        action: 'admin.login.failure',
        metadata: { reason: 'invalid_password' },
      });
      respondInvalidAdminCredentials(res);
      return;
    }

    resetAdminLoginEmailFailures(normalized.email);
    markAdminUserLogin(adminUser.id);

    const { token } = createAdminSession(adminUser.id);

    recordAdminAudit(req, {
      adminUserId: adminUser.id,
      action: 'admin.login.success',
    });

    res.json({
      token,
      admin: toAdminUserIdentity(adminUser),
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
