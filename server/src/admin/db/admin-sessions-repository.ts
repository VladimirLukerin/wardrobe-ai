import crypto from 'crypto';

import { generateSessionToken, hashSessionToken } from '../../db/token-hash';
import { getDatabase } from '../../db/database';
import { getAdminSessionTtlMs } from '../admin-config';
import {
  findAdminIdentityByUserId,
  type AdminUserIdentity,
} from './admin-identity-repository';

export type DbAdminSession = {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  last_seen_at: string;
};

export function createAdminSession(userId: string): { token: string; session: DbAdminSession } {
  const db = getDatabase();
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + getAdminSessionTtlMs()).toISOString();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const sessionId = crypto.randomUUID();

    try {
      db.prepare(
        `INSERT INTO admin_sessions (
          id, user_id, token_hash, created_at, expires_at, last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(sessionId, userId, tokenHash, nowIso, expiresAt, nowIso);

      const session = db
        .prepare('SELECT * FROM admin_sessions WHERE id = ?')
        .get(sessionId) as DbAdminSession | undefined;

      if (!session) {
        throw new Error('Failed to load created admin session.');
      }

      return { token, session };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('UNIQUE constraint failed: admin_sessions.token_hash')) {
        continue;
      }

      throw error;
    }
  }

  throw new Error('Failed to create admin session.');
}

export function findAdminSessionByToken(token: string): DbAdminSession | null {
  const db = getDatabase();
  const tokenHash = hashSessionToken(token);
  const row = db
    .prepare('SELECT * FROM admin_sessions WHERE token_hash = ?')
    .get(tokenHash) as DbAdminSession | undefined;

  return row ?? null;
}

export function deleteAdminSessionByToken(token: string): boolean {
  const db = getDatabase();
  const tokenHash = hashSessionToken(token);
  const result = db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash);

  return result.changes > 0;
}

export function touchAdminSession(sessionId: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare('UPDATE admin_sessions SET last_seen_at = ? WHERE id = ?').run(now, sessionId);
}

export function findAdminIdentityBySessionToken(token: string): AdminUserIdentity | null {
  const session = findAdminSessionByToken(token);

  if (!session) {
    return null;
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    deleteAdminSessionByToken(token);
    return null;
  }

  const identity = findAdminIdentityByUserId(session.user_id);

  if (!identity) {
    return null;
  }

  touchAdminSession(session.id);
  return identity;
}

/** @deprecated Use findAdminIdentityBySessionToken */
export const findAdminUserBySessionToken = findAdminIdentityBySessionToken;
