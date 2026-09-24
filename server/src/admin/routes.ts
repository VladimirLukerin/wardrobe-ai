import { Router } from 'express';

import { adminAuthRouter } from './auth/admin-auth-routes';
import { adminAiRouter } from './ai/admin-ai-routes';
import { adminDashboardRouter } from './dashboard/admin-dashboard-routes';
import { adminSettingsRouter } from './settings/admin-settings-routes';
import { adminUsersRouter } from './users/admin-users-routes';

export const adminRouter = Router();

adminRouter.use('/auth', adminAuthRouter);
adminRouter.use('/', adminDashboardRouter);
adminRouter.use('/', adminAiRouter);
adminRouter.use('/', adminSettingsRouter);
adminRouter.use('/', adminUsersRouter);
