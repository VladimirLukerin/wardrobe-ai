import { hashPassword, verifyPassword, type StoredPasswordCredential } from '../auth/password';

type SerializedAdminPassword = {
  passwordHash: string;
  passwordSalt: string;
};

export async function serializeAdminPasswordHash(password: string): Promise<string> {
  const material = await hashPassword(password);
  const payload: SerializedAdminPassword = {
    passwordHash: material.passwordHash,
    passwordSalt: material.passwordSalt,
  };

  return JSON.stringify(payload);
}

export async function verifyAdminPassword(password: string, stored: string): Promise<boolean> {
  let parsed: SerializedAdminPassword;

  try {
    parsed = JSON.parse(stored) as SerializedAdminPassword;
  } catch {
    return false;
  }

  if (!parsed.passwordHash || !parsed.passwordSalt) {
    return false;
  }

  const credential: StoredPasswordCredential = {
    password_hash: parsed.passwordHash,
    password_salt: parsed.passwordSalt,
  };

  return verifyPassword(password, credential);
}
