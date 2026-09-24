import crypto from 'crypto';

import { getDatabase } from './database';
import { generateSessionToken, hashSessionToken } from './token-hash';
import type { DbUser } from './users-repository';

export type DbSession = {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string | null;
};

export function createSessionForUser(userId: string): { token: string; session: DbSession } {
  const db = getDatabase();
  const now = new Date().toISOString();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const sessionId = crypto.randomUUID();

    try {
      db.prepare(
        `INSERT INTO sessions (
          id, user_id, token_hash, created_at, expires_at
        ) VALUES (?, ?, ?, ?, NULL)`,
      ).run(sessionId, userId, tokenHash, now);

      const session = db
        .prepare('SELECT * FROM sessions WHERE id = ?')
        .get(sessionId) as DbSession | undefined;

      if (!session) {
        throw new Error('Failed to load created session.');
      }

      return { token, session };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('UNIQUE constraint failed: sessions.token_hash')) {
        continue;
      }

      throw error;
    }
  }

  throw new Error('Failed to create session.');
}

export function findSessionByTokenHash(tokenHash: string): DbSession | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT * FROM sessions WHERE token_hash = ?')
    .get(tokenHash) as DbSession | undefined;

  return row ?? null;
}

export function deleteSessionByToken(token: string): boolean {
  const db = getDatabase();
  const tokenHash = hashSessionToken(token);
  const result = db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);

  return result.changes > 0;
}

export function deleteSessionsForUser(userId: string): number {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);

  return result.changes;
}

export function deleteOtherSessionsForUser(userId: string, currentToken: string): number {
  const db = getDatabase();
  const currentTokenHash = hashSessionToken(currentToken);
  const result = db
    .prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?')
    .run(userId, currentTokenHash);

  return result.changes;
}

export function findUserBySessionToken(token: string): DbUser | null {
  const tokenHash = hashSessionToken(token);
  const session = findSessionByTokenHash(tokenHash);

  if (!session) {
    return null;
  }

  if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) {
    return null;
  }

  const db = getDatabase();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) as
    | DbUser
    | undefined;

  return user ?? null;
}
