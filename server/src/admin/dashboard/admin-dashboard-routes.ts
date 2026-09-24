import type { Request, Response } from 'express';
import { Router } from 'express';

import { recordAdminAudit } from '../audit/admin-audit';
import { requireAdminRole, requireAdminSession } from '../middleware/require-admin-session';
import { getAdminDashboardMetrics } from './admin-dashboard-service';

export const adminDashboardRouter = Router();

adminDashboardRouter.get(
  '/dashboard',
  requireAdminSession,
  requireAdminRole('viewer'),
  (req: Request, res: Response) => {
    const metrics = getAdminDashboardMetrics();

    recordAdminAudit(req, {
      adminUserId: req.adminUser?.id ?? null,
      action: 'admin.dashboard.view',
    });

    res.json(metrics);
  },
);
