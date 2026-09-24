import crypto from 'crypto';

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export const PASSWORD_TOO_SHORT_MESSAGE = 'Пароль должен содержать не менее 8 символов.';
export const PASSWORD_TOO_LONG_MESSAGE = 'Пароль слишком длинный.';

export const SCRYPT_KEY_LENGTH = 64;
export const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 128 * 1024 * 1024,
} as const;

export type PasswordCredentialMaterial = {
  passwordHash: string;
  passwordSalt: string;
};

export type StoredPasswordCredential = {
  password_hash: string;
  password_salt: string;
};

export type PasswordValidationResult =
  | { ok: true; password: string }
  | { ok: false; message: string };

export function validatePasswordInput(password: unknown): PasswordValidationResult {
  if (typeof password !== 'string') {
    return { ok: false, message: PASSWORD_TOO_SHORT_MESSAGE };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: PASSWORD_TOO_SHORT_MESSAGE };
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, message: PASSWORD_TOO_LONG_MESSAGE };
  }

  return { ok: true, password };
}

export async function hashPassword(password: string): Promise<PasswordCredentialMaterial> {
  const salt = crypto.randomBytes(16);
  const derived = await scryptWithOptions(password, salt, SCRYPT_KEY_LENGTH, SCRYPT_OPTIONS);

  return {
    passwordHash: derived.toString('base64'),
    passwordSalt: salt.toString('base64'),
  };
}

export async function verifyPassword(
  password: string,
  credential: StoredPasswordCredential,
): Promise<boolean> {
  const salt = Buffer.from(credential.password_salt, 'base64');
  const expectedHash = Buffer.from(credential.password_hash, 'base64');

  if (expectedHash.length === 0) {
    return false;
  }

  const derived = await scryptWithOptions(password, salt, expectedHash.length, SCRYPT_OPTIONS);

  if (derived.length !== expectedHash.length) {
    return false;
  }

  return crypto.timingSafeEqual(derived, expectedHash);
}

function scryptWithOptions(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: crypto.ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}
