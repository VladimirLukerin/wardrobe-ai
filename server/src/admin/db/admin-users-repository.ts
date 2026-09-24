import crypto from 'crypto';

import { normalizeEmail } from '../../auth/normalize-email';
import { getDatabase } from '../../db/database';
import type { AdminRole } from '../admin-config';
import { isAdminRole } from '../admin-config';
import { serializeAdminPasswordHash } from '../admin-password';

export type DbAdminUser = {
  id: string;
  email: string;
  password_hash: string;
  role: AdminRole;
  is_active: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

export type AdminUserIdentity = {
  id: string;
  email: string;
  role: AdminRole;
  createdAt: string;
  lastLoginAt: string | null;
};

export function toAdminUserIdentity(row: DbAdminUser): AdminUserIdentity {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export function findAdminUserById(id: string): DbAdminUser | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id) as DbAdminUser | undefined;
  return row ?? null;
}

export function findAdminUserByEmail(email: string): DbAdminUser | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT * FROM admin_users WHERE email = ?')
    .get(email) as DbAdminUser | undefined;
  return row ?? null;
}

export async function createAdminUser({
  email,
  password,
  role,
}: {
  email: string;
  password: string;
  role: AdminRole;
}): Promise<DbAdminUser> {
  const normalized = normalizeEmail(email);

  if (!normalized.ok) {
    throw new Error('Invalid admin email.');
  }

  if (!isAdminRole(role)) {
    throw new Error('Invalid admin role.');
  }

  const db = getDatabase();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const passwordHash = await serializeAdminPasswordHash(password);

  try {
    db.prepare(
      `INSERT INTO admin_users (
        id, email, password_hash, role, is_active, created_at, updated_at, last_login_at
      ) VALUES (?, ?, ?, ?, 1, ?, ?, NULL)`,
    ).run(id, normalized.email, passwordHash, role, now, now);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('UNIQUE constraint failed: admin_users.email')) {
      throw new Error('Admin email already exists.');
    }

    throw error;
  }

  const created = findAdminUserById(id);

  if (!created) {
    throw new Error('Failed to load created admin user.');
  }

  return created;
}

export function markAdminUserLogin(adminUserId: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare('UPDATE admin_users SET last_login_at = ?, updated_at = ? WHERE id = ?').run(
    now,
    now,
    adminUserId,
  );
}

export function setAdminUserActive(adminUserId: string, isActive: boolean): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare('UPDATE admin_users SET is_active = ?, updated_at = ? WHERE id = ?').run(
    isActive ? 1 : 0,
    now,
    adminUserId,
  );
}

export function setAdminUserRole(adminUserId: string, role: AdminRole): DbAdminUser {
  if (!isAdminRole(role)) {
    throw new Error('Invalid admin role.');
  }

  const existing = findAdminUserById(adminUserId);

  if (!existing) {
    throw new Error('Admin user not found.');
  }

  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare('UPDATE admin_users SET role = ?, updated_at = ? WHERE id = ?').run(
    role,
    now,
    adminUserId,
  );

  const updated = findAdminUserById(adminUserId);

  if (!updated) {
    throw new Error('Admin user not found.');
  }

  return updated;
}

export function setAdminUserRoleByEmail(email: string, role: AdminRole): DbAdminUser {
  const normalized = normalizeEmail(email);

  if (!normalized.ok) {
    throw new Error('Invalid admin email.');
  }

  const existing = findAdminUserByEmail(normalized.email);

  if (!existing) {
    throw new Error('Admin user not found.');
  }

  return setAdminUserRole(existing.id, role);
}
