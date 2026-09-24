import { getDatabase } from './database';

export type DbPasswordCredential = {
  user_id: string;
  password_hash: string;
  password_salt: string;
  created_at: string;
  updated_at: string;
};

export function getPasswordCredential(userId: string): DbPasswordCredential | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT * FROM user_password_credentials WHERE user_id = ?')
    .get(userId) as DbPasswordCredential | undefined;

  return row ?? null;
}

export function hasPasswordCredential(userId: string): boolean {
  return getPasswordCredential(userId) !== null;
}

export function setPasswordCredential({
  userId,
  passwordHash,
  passwordSalt,
}: {
  userId: string;
  passwordHash: string;
  passwordSalt: string;
}): DbPasswordCredential {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO user_password_credentials (
      user_id, password_hash, password_salt, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      password_hash = excluded.password_hash,
      password_salt = excluded.password_salt,
      updated_at = excluded.updated_at`,
  ).run(userId, passwordHash, passwordSalt, now, now);

  const created = getPasswordCredential(userId);

  if (!created) {
    throw new Error('Failed to persist password credential.');
  }

  return created;
}

export function updatePasswordCredential({
  userId,
  passwordHash,
  passwordSalt,
}: {
  userId: string;
  passwordHash: string;
  passwordSalt: string;
}): DbPasswordCredential | null {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `UPDATE user_password_credentials
       SET password_hash = ?, password_salt = ?, updated_at = ?
       WHERE user_id = ?`,
    )
    .run(passwordHash, passwordSalt, now, userId);

  if (result.changes === 0) {
    return null;
  }

  return getPasswordCredential(userId);
}
