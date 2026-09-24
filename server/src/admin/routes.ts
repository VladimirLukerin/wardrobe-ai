import { Router } from 'express';

import { adminAuthRouter } from './auth/admin-auth-routes';
import { adminUsersRouter } from './users/admin-users-routes';

export const adminRouter = Router();

adminRouter.use('/auth', adminAuthRouter);
adminRouter.use('/', adminUsersRouter);
