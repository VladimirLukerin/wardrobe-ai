import type { Request, Response } from 'express';
import { Router } from 'express';

import {
  checkEmailLookupRateLimit,
  getEmailLookupClientIp,
  respondEmailLookupRateLimited,
} from '../auth/email-lookup-rate-limit';
import { normalizeEmail } from '../auth/normalize-email';
import { hasPasswordCredential } from '../db/password-credentials-repository';
import { findUserByVerifiedEmail } from '../db/users-repository';

const emailLookupRouter = Router();

emailLookupRouter.post('/email/lookup', (req: Request, res: Response) => {
  const normalized = normalizeEmail(req.body?.email);

  if (!normalized.ok) {
    res.status(400).json({ error: 'Введите корректный email.' });
    return;
  }

  const ip = getEmailLookupClientIp(req);
  const rateLimit = checkEmailLookupRateLimit(normalized.email, ip);

  if (!rateLimit.allowed) {
    respondEmailLookupRateLimited(res, rateLimit.retryAfterSeconds);
    return;
  }

  const targetUser = findUserByVerifiedEmail(normalized.email);

  if (!targetUser) {
    res.json({
      exists: false,
      hasPassword: false,
    });
    return;
  }

  res.json({
    exists: true,
    hasPassword: hasPasswordCredential(targetUser.id),
  });
});

export { emailLookupRouter };
