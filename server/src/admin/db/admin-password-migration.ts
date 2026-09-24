import type Database from 'better-sqlite3';

type LegacySerializedAdminPassword = {
  passwordHash?: string;
  passwordSalt?: string;
};

function parseLegacyAdminPasswordJson(raw: string): LegacySerializedAdminPassword | null {
  const trimmed = raw.trim();

  if (!trimmed.startsWith('{')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as LegacySerializedAdminPassword;

    if (
      typeof parsed.passwordHash === 'string' &&
      parsed.passwordHash.length > 0 &&
      typeof parsed.passwordSalt === 'string' &&
      parsed.passwordSalt.length > 0
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export function migrateAdminPasswordCredentialColumns(db: Database.Database): void {
  const columns = db.prepare('PRAGMA table_info(admin_users)').all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has('password_salt')) {
    db.exec('ALTER TABLE admin_users ADD COLUMN password_salt TEXT NULL');
  }

  const rows = db
    .prepare('SELECT id, password_hash, password_salt FROM admin_users')
    .all() as Array<{ id: string; password_hash: string; password_salt: string | null }>;

  const update = db.prepare(
    'UPDATE admin_users SET password_hash = ?, password_salt = ? WHERE id = ?',
  );

  for (const row of rows) {
    if (row.password_salt) {
      continue;
    }

    const legacy = parseLegacyAdminPasswordJson(row.password_hash);

    if (!legacy) {
      continue;
    }

    update.run(legacy.passwordHash, legacy.passwordSalt, row.id);
  }
}

export function isLegacyAdminPasswordJson(raw: string): boolean {
  return parseLegacyAdminPasswordJson(raw) !== null;
}
