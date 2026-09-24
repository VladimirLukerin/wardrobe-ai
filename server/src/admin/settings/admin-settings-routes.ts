import type { Request, Response } from 'express';
import { Router } from 'express';

import { getAllAppSettings, updateAppSetting, AppSettingValidationError } from '../../app-settings/app-settings-service';
import { isAppSettingKey } from '../../app-settings/app-settings-keys';
import { recordAdminAudit } from '../audit/admin-audit';
import { requireAdminRole, requireAdminSession } from '../middleware/require-admin-session';

export const adminSettingsRouter = Router();

adminSettingsRouter.get(
  '/settings',
  requireAdminSession,
  requireAdminRole('viewer'),
  (_req: Request, res: Response) => {
    res.json({ settings: getAllAppSettings() });
  },
);

adminSettingsRouter.put(
  '/settings/:key',
  requireAdminSession,
  requireAdminRole('admin'),
  (req: Request, res: Response) => {
    const keyParam = req.params.key;
    const key = Array.isArray(keyParam) ? keyParam[0] : keyParam;

    if (!key || !isAppSettingKey(key)) {
      res.status(400).json({ error: 'Unknown setting key.' });
      return;
    }

    if (typeof req.body !== 'object' || req.body === null || !('value' in req.body)) {
      res.status(400).json({ error: 'Request body must include value.' });
      return;
    }

    const before = getAllAppSettings().find((entry) => entry.key === key)?.value;

    try {
      const updated = updateAppSetting({
        key,
        value: (req.body as { value: unknown }).value,
        updatedByAdminId: req.adminUser!.id,
      });

      recordAdminAudit(req, {
        adminUserId: req.adminUser!.id,
        action: 'admin.setting.update',
        targetType: 'app_setting',
        targetId: key,
        metadata: {
          before,
          after: updated.value,
        },
      });

      res.json({ setting: updated });
    } catch (error) {
      if (error instanceof AppSettingValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }

      throw error;
    }
  },
);
