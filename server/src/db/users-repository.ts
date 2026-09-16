import crypto from 'crypto';

import { getDatabase } from './database';
import { generatePublicId } from './public-id';

export type DbUser = {
  id: string;
  public_id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  email_verified: number;
  phone_verified: number;
  created_at: string;
  updated_at: string;
};

export type UserResponse = {
  id: string;
  publicId: string;
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  createdAt: string;
};

export function toUserResponse(user: DbUser): UserResponse {
  return {
    id: user.id,
    publicId: user.public_id,
    displayName: user.display_name,
    email: user.email,
    emailVerified: user.email_verified === 1,
    phone: user.phone,
    phoneVerified: user.phone_verified === 1,
    createdAt: user.created_at,
  };
}

export function updateUserDisplayName(userId: string, displayName: string | null): DbUser | null {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare('UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?').run(
    displayName,
    now,
    userId,
  );

  return findUserById(userId);
}

export function findUserById(id: string): DbUser | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as DbUser | undefined;

  return row ?? null;
}

export function findUserByVerifiedEmail(email: string): DbUser | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT * FROM users WHERE email = ? AND email_verified = 1')
    .get(email) as DbUser | undefined;

  return row ?? null;
}

export function linkVerifiedEmailToUser(userId: string, email: string): DbUser | null {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE users
     SET email = ?, email_verified = 1, updated_at = ?
     WHERE id = ?`,
  ).run(email, now, userId);

  return findUserById(userId);
}

export function findUserByVerifiedPhone(phone: string): DbUser | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT * FROM users WHERE phone = ? AND phone_verified = 1')
    .get(phone) as DbUser | undefined;

  return row ?? null;
}

export function setVerifiedPhone(userId: string, phone: string): DbUser | null {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE users
     SET phone = ?, phone_verified = 1, updated_at = ?
     WHERE id = ?`,
  ).run(phone, now, userId);

  return findUserById(userId);
}

export function createAnonymousUser(displayName: string | null): DbUser {
  const db = getDatabase();
  const now = new Date().toISOString();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id = crypto.randomUUID();
    const publicId = generatePublicId();

    try {
      db.prepare(
        `INSERT INTO users (
          id, public_id, display_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?)`,
      ).run(id, publicId, displayName, now, now);

      const created = findUserById(id);

      if (!created) {
        throw new Error('Failed to load created user.');
      }

      return created;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('UNIQUE constraint failed: users.public_id')) {
        continue;
      }

      throw error;
    }
  }

  throw new Error('Failed to generate unique publicId.');
}
