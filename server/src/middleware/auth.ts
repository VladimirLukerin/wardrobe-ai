import type { NextFunction, Request, Response } from 'express';

import { findUserBySessionToken } from '../db/sessions-repository';
import { toUserResponse, type UserResponse } from '../db/users-repository';

declare global {
  namespace Express {
    interface Request {
      authUser?: UserResponse;
      authSessionToken?: string;
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

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    next();
    return;
  }

  const user = findUserBySessionToken(token);

  if (user) {
    req.authUser = toUserResponse(user);
    req.authSessionToken = token;
  }

  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = findUserBySessionToken(token);

  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  req.authUser = toUserResponse(user);
  req.authSessionToken = token;
  next();
}
