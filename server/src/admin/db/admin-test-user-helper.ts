import { hashPassword } from '../../auth/password';
import { normalizeEmail } from '../../auth/normalize-email';
import { setPasswordCredential } from '../../db/password-credentials-repository';
import {
  createAnonymousUser,
  findUserById,
  linkVerifiedEmailToUser,
} from '../../db/users-repository';
import type { AdminRole } from '../admin-config';
import { setUserAdminActive, setUserAdminRoleByEmail } from './admin-identity-repository';

export type TestUserWithAdminAccess = {
  id: string;
  email: string;
  role: AdminRole;
  updated_at: string;
};

export async function createTestUserWithAdminAccess({
  email,
  password,
  role,
}: {
  email: string;
  password: string;
  role: AdminRole;
}): Promise<TestUserWithAdminAccess> {
  const normalized = normalizeEmail(email);

  if (!normalized.ok) {
    throw new Error('Invalid admin email.');
  }

  const user = createAnonymousUser(null);
  linkVerifiedEmailToUser(user.id, normalized.email);

  const material = await hashPassword(password);
  setPasswordCredential({
    userId: user.id,
    passwordHash: material.passwordHash,
    passwordSalt: material.passwordSalt,
  });

  const identity = setUserAdminRoleByEmail(normalized.email, role);

  if (!identity) {
    throw new Error('Failed to grant admin role.');
  }

  const refreshed = findUserById(user.id);

  if (!refreshed) {
    throw new Error('Failed to load test user.');
  }

  return {
    id: user.id,
    email: identity.email,
    role: identity.role,
    updated_at: refreshed.updated_at,
  };
}

export { setUserAdminActive, setUserAdminRoleByEmail };
