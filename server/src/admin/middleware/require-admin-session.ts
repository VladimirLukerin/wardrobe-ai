import type { NextFunction, Request, Response } from 'express';

import { adminRoleMeetsRequirement } from '../admin-config';
import { findAdminIdentityBySessionToken } from '../db/admin-sessions-repository';
import { type AdminUserIdentity } from '../db/admin-identity-repository';

declare global {
  namespace Express {
    interface Request {
      adminUser?: AdminUserIdentity;
      adminSessionToken?: string;
    }
  }
}

function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();

  return token.length > 0 ? token : null;
}

export function requireAdminSession(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const adminUser = findAdminIdentityBySessionToken(token);

  if (!adminUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  req.adminUser = adminUser;
  req.adminSessionToken = token;
  next();
}

export function requireAdminRole(minimumRole: 'viewer' | 'admin' | 'owner') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.adminUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!adminRoleMeetsRequirement(req.adminUser.role, minimumRole)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    next();
  };
}
