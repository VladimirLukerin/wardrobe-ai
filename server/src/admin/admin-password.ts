import { hashPassword, verifyPassword } from '../auth/password';

export type AdminPasswordMaterial = {
  passwordHash: string;
  passwordSalt: string;
};

export async function createAdminPasswordMaterial(password: string): Promise<AdminPasswordMaterial> {
  const material = await hashPassword(password);

  return {
    passwordHash: material.passwordHash,
    passwordSalt: material.passwordSalt,
  };
}

export type AdminPasswordCredential = {
  password_hash: string;
  password_salt: string | null;
};

function parseLegacyJsonCredential(storedHash: string): AdminPasswordMaterial | null {
  const trimmed = storedHash.trim();

  if (!trimmed.startsWith('{')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      passwordHash?: string;
      passwordSalt?: string;
    };

    if (
      typeof parsed.passwordHash === 'string' &&
      parsed.passwordHash.length > 0 &&
      typeof parsed.passwordSalt === 'string' &&
      parsed.passwordSalt.length > 0
    ) {
      return {
        passwordHash: parsed.passwordHash,
        passwordSalt: parsed.passwordSalt,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export async function verifyAdminPassword(
  password: string,
  credential: AdminPasswordCredential,
): Promise<boolean> {
  if (credential.password_salt) {
    return verifyPassword(password, {
      password_hash: credential.password_hash,
      password_salt: credential.password_salt,
    });
  }

  const legacy = parseLegacyJsonCredential(credential.password_hash);

  if (legacy) {
    return verifyPassword(password, {
      password_hash: legacy.passwordHash,
      password_salt: legacy.passwordSalt,
    });
  }

  return false;
}

/** @deprecated Use createAdminPasswordMaterial instead. */
export async function serializeAdminPasswordHash(password: string): Promise<string> {
  const material = await createAdminPasswordMaterial(password);
  return JSON.stringify({
    passwordHash: material.passwordHash,
    passwordSalt: material.passwordSalt,
  });
}
