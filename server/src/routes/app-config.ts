import type { Request, Response } from 'express';
import { Router } from 'express';

import { getClientAppConfig } from '../app-settings/app-settings-service';

export const appConfigRouter = Router();

appConfigRouter.get('/app-config', (_req: Request, res: Response) => {
  res.json(getClientAppConfig());
});
