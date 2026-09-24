import { normalizeEmail } from '../../auth/normalize-email';
import { getDatabase } from '../../db/database';
import type { DbUser } from '../../db/users-repository';
import { findUserById, findUserByVerifiedEmail } from '../../db/users-repository';
import type { AdminRole } from '../admin-config';
import { isAdminRole } from '../admin-config';

export type AdminUserIdentity = {
  id: string;
  email: string;
  role: AdminRole;
  createdAt: string;
  lastLoginAt: string | null;
};

type DbUserWithAdmin = DbUser & {
  admin_role: AdminRole | null;
  admin_is_active: number;
};

function readDbUser(row: Record<string, unknown>): DbUserWithAdmin {
  return row as DbUserWithAdmin;
}

function requireAdminRole(value: unknown): AdminRole | null {
  return typeof value === 'string' && isAdminRole(value) ? value : null;
}

export function toAdminUserIdentity(user: DbUserWithAdmin): AdminUserIdentity | null {
  const role = requireAdminRole(user.admin_role);

  if (!role || !user.email) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    role,
    createdAt: user.created_at,
    lastLoginAt: null,
  };
}

export function findAdminIdentityByUserId(userId: string): AdminUserIdentity | null {
  const user = findUserById(userId);

  if (!user) {
    return null;
  }

  const withAdmin = readDbUser(user as unknown as Record<string, unknown>);

  if (withAdmin.admin_is_active !== 1) {
    return null;
  }

  return toAdminUserIdentity(withAdmin);
}

export function findAdminIdentityByVerifiedEmail(email: string): AdminUserIdentity | null {
  const user = findUserByVerifiedEmail(email);

  if (!user) {
    return null;
  }

  const withAdmin = readDbUser(user as unknown as Record<string, unknown>);

  if (withAdmin.admin_is_active !== 1) {
    return null;
  }

  return toAdminUserIdentity(withAdmin);
}

export function setUserAdminRoleByEmail(
  email: string,
  role: AdminRole | null,
): AdminUserIdentity | null {
  const normalized = normalizeEmail(email);

  if (!normalized.ok) {
    throw new Error('Invalid admin email.');
  }

  const user = findUserByVerifiedEmail(normalized.email);

  if (!user) {
    throw new Error('User not found.');
  }

  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE users
     SET admin_role = ?, admin_is_active = 1, updated_at = ?
     WHERE id = ?`,
  ).run(role, now, user.id);

  if (role === null) {
    return null;
  }

  const identity = findAdminIdentityByUserId(user.id);

  if (!identity) {
    throw new Error('Failed to load updated admin identity.');
  }

  return identity;
}

export function setUserAdminActive(userId: string, isActive: boolean): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare('UPDATE users SET admin_is_active = ?, updated_at = ? WHERE id = ?').run(
    isActive ? 1 : 0,
    now,
    userId,
  );
}
