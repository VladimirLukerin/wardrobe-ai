import type { Request, Response } from 'express';
import { Router } from 'express';

import { recordAdminAudit } from '../audit/admin-audit';
import { requireAdminRole, requireAdminSession } from '../middleware/require-admin-session';
import {
  getAdminUserDetail,
  listAdminUserFamily,
  listAdminUserOutfits,
  listAdminUsers,
  listAdminUserWardrobe,
  listAdminUserWearHistory,
} from './admin-users-service';

export const adminUsersRouter = Router();

adminUsersRouter.use(requireAdminSession);
adminUsersRouter.use(requireAdminRole('viewer'));

adminUsersRouter.get('/users', (req: Request, res: Response) => {
  const accountType = req.query.accountType;

  if (
    accountType !== undefined &&
    accountType !== 'guest' &&
    accountType !== 'protected'
  ) {
    res.status(400).json({ error: 'Invalid accountType filter.' });
    return;
  }

  const result = listAdminUsers({
    q: req.query.q,
    accountType,
    limit: req.query.limit,
    cursor: req.query.cursor,
  });

  recordAdminAudit(req, {
    adminUserId: req.adminUser?.id ?? null,
    action: 'admin.users.list',
    metadata: {
      resultCount: result.items.length,
      hasQuery: typeof req.query.q === 'string' && req.query.q.trim().length > 0,
      accountType: typeof accountType === 'string' ? accountType : null,
    },
  });

  res.json(result);
});

function routeParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

adminUsersRouter.get('/users/:userId', (req: Request, res: Response) => {
  const detail = getAdminUserDetail(routeParam(req.params.userId));

  if (!detail) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  recordAdminAudit(req, {
    adminUserId: req.adminUser?.id ?? null,
    action: 'admin.user.view',
    targetType: 'user',
    targetId: detail.account.id,
  });

  res.json(detail);
});

adminUsersRouter.get('/users/:userId/wardrobe', (req: Request, res: Response) => {
  const result = listAdminUserWardrobe(routeParam(req.params.userId), req.query.limit, req.query.cursor);

  if (!result) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  res.json(result);
});

adminUsersRouter.get('/users/:userId/outfits', (req: Request, res: Response) => {
  const result = listAdminUserOutfits(routeParam(req.params.userId), req.query.limit, req.query.cursor);

  if (!result) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  res.json(result);
});

adminUsersRouter.get('/users/:userId/wear-history', (req: Request, res: Response) => {
  const result = listAdminUserWearHistory(routeParam(req.params.userId), req.query.limit, req.query.cursor);

  if (!result) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  res.json(result);
});

adminUsersRouter.get('/users/:userId/family', (req: Request, res: Response) => {
  const result = listAdminUserFamily(routeParam(req.params.userId), req.query.limit, req.query.cursor);

  if (!result) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  res.json(result);
});
