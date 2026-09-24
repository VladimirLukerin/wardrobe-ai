import type Database from 'better-sqlite3';

import type { AdminRole } from '../admin-config';
import { isAdminRole } from '../admin-config';

export type LegacyAdminUsersMigrationReport = {
  migrated: Array<{ email: string; userId: string; role: AdminRole }>;
  unmatchedEmails: string[];
  sessionsRemapped: number;
  sessionsDropped: number;
  auditRowsRemapped: number;
  appSettingsRemapped: number;
};

const ROLE_RANK: Record<AdminRole, number> = {
  viewer: 1,
  admin: 2,
  owner: 3,
};

function maxAdminRole(current: AdminRole | null, incoming: AdminRole): AdminRole {
  if (!current) {
    return incoming;
  }

  return ROLE_RANK[incoming] > ROLE_RANK[current] ? incoming : current;
}

function tableExists(db: Database.Database, name: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { name: string } | undefined;

  return row?.name === name;
}

function readUsersAdminColumns(db: Database.Database): Set<string> {
  const columns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;

  return new Set(columns.map((column) => column.name));
}

export function migrateUserAdminAuthorizationColumns(db: Database.Database): void {
  const columnNames = readUsersAdminColumns(db);

  if (!columnNames.has('admin_role')) {
    db.exec('ALTER TABLE users ADD COLUMN admin_role TEXT NULL');
  }

  if (!columnNames.has('admin_is_active')) {
    db.exec('ALTER TABLE users ADD COLUMN admin_is_active INTEGER NOT NULL DEFAULT 1');
  }
}

function readTableSql(db: Database.Database, tableName: string): string | null {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { sql: string } | undefined;

  return row?.sql ?? null;
}

function buildAdminUserIdToUserIdMap(db: Database.Database, idMap: Map<string, string>): Map<string, string> {
  const merged = new Map(idMap);

  if (!tableExists(db, 'admin_users')) {
    return merged;
  }

  const joined = db
    .prepare(
      `SELECT admin_users.id AS admin_id, users.id AS user_id
       FROM admin_users
       INNER JOIN users ON users.email = admin_users.email`,
    )
    .all() as Array<{ admin_id: string; user_id: string }>;

  for (const row of joined) {
    merged.set(row.admin_id, row.user_id);
  }

  return merged;
}

function migrateAdminSessionsToUserIdColumn(
  db: Database.Database,
  idMap: Map<string, string>,
  report: LegacyAdminUsersMigrationReport,
): void {
  if (!tableExists(db, 'admin_sessions')) {
    return;
  }

  const sessionColumns = db.prepare('PRAGMA table_info(admin_sessions)').all() as Array<{
    name: string;
  }>;
  const sessionColumnNames = new Set(sessionColumns.map((column) => column.name));

  if (sessionColumnNames.has('user_id') || !sessionColumnNames.has('admin_user_id')) {
    return;
  }

  const userIdMap = buildAdminUserIdToUserIdMap(db, idMap);

  db.exec('DROP TABLE IF EXISTS admin_sessions__user_ref');

  db.exec(`
    CREATE TABLE admin_sessions__user_ref (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_admin_sessions__user_ref_user_id
      ON admin_sessions__user_ref(user_id);
    CREATE INDEX IF NOT EXISTS idx_admin_sessions__user_ref_token_hash
      ON admin_sessions__user_ref(token_hash);
  `);

  const sessions = db
    .prepare(
      'SELECT id, admin_user_id, token_hash, created_at, expires_at, last_seen_at FROM admin_sessions',
    )
    .all() as Array<{
    id: string;
    admin_user_id: string;
    token_hash: string;
    created_at: string;
    expires_at: string;
    last_seen_at: string;
  }>;

  const insertSession = db.prepare(
    `INSERT INTO admin_sessions__user_ref (
      id, user_id, token_hash, created_at, expires_at, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  );

  for (const session of sessions) {
    const userId = userIdMap.get(session.admin_user_id) ?? session.admin_user_id;
    const userExists = db.prepare('SELECT 1 AS ok FROM users WHERE id = ?').get(userId) as
      | { ok: number }
      | undefined;

    if (!userExists?.ok) {
      report.sessionsDropped += 1;
      continue;
    }

    insertSession.run(
      session.id,
      userId,
      session.token_hash,
      session.created_at,
      session.expires_at,
      session.last_seen_at,
    );
    report.sessionsRemapped += 1;
  }

  db.exec('DROP TABLE admin_sessions');
  db.exec('ALTER TABLE admin_sessions__user_ref RENAME TO admin_sessions');
}

function migrateAdminAuditLogForeignKeyToUsers(db: Database.Database): void {
  if (!tableExists(db, 'admin_audit_log')) {
    return;
  }

  const sql = readTableSql(db, 'admin_audit_log');

  if (!sql || !sql.includes('REFERENCES admin_users')) {
    return;
  }

  db.exec('DROP TABLE IF EXISTS admin_audit_log__users_fk');

  db.exec(`
    CREATE TABLE admin_audit_log__users_fk (
      id TEXT PRIMARY KEY,
      admin_user_id TEXT NULL,
      action TEXT NOT NULL,
      target_type TEXT NULL,
      target_id TEXT NULL,
      metadata_json TEXT NULL,
      created_at TEXT NOT NULL,
      ip TEXT NULL,
      FOREIGN KEY (admin_user_id) REFERENCES users(id)
    );

    INSERT INTO admin_audit_log__users_fk (
      id, admin_user_id, action, target_type, target_id, metadata_json, created_at, ip
    )
    SELECT id, admin_user_id, action, target_type, target_id, metadata_json, created_at, ip
    FROM admin_audit_log;

    DROP TABLE admin_audit_log;
    ALTER TABLE admin_audit_log__users_fk RENAME TO admin_audit_log;

    CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user_id ON admin_audit_log(admin_user_id);
    CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at);
  `);
}

function migrateAppSettingsForeignKeyToUsers(db: Database.Database): void {
  if (!tableExists(db, 'app_settings')) {
    return;
  }

  const sql = readTableSql(db, 'app_settings');

  if (!sql || !sql.includes('REFERENCES admin_users')) {
    return;
  }

  db.exec('DROP TABLE IF EXISTS app_settings__users_fk');

  db.exec(`
    CREATE TABLE app_settings__users_fk (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by_admin_id TEXT NULL,
      FOREIGN KEY (updated_by_admin_id) REFERENCES users(id)
    );

    INSERT INTO app_settings__users_fk (key, value_json, updated_at, updated_by_admin_id)
    SELECT key, value_json, updated_at, updated_by_admin_id
    FROM app_settings;

    DROP TABLE app_settings;
    ALTER TABLE app_settings__users_fk RENAME TO app_settings;
  `);
}

function cleanupFailedAdminMigrationArtifacts(db: Database.Database): void {
  if (!tableExists(db, 'admin_audit_log') && tableExists(db, 'admin_audit_log__users_fk')) {
    db.exec('ALTER TABLE admin_audit_log__users_fk RENAME TO admin_audit_log');
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user_id ON admin_audit_log(admin_user_id)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at)',
    );
  } else {
    db.exec('DROP TABLE IF EXISTS admin_audit_log__users_fk');
  }

  if (!tableExists(db, 'app_settings') && tableExists(db, 'app_settings__users_fk')) {
    db.exec('ALTER TABLE app_settings__users_fk RENAME TO app_settings');
  } else {
    db.exec('DROP TABLE IF EXISTS app_settings__users_fk');
  }

  if (!tableExists(db, 'admin_sessions') && tableExists(db, 'admin_sessions__user_ref')) {
    db.exec('ALTER TABLE admin_sessions__user_ref RENAME TO admin_sessions');
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_id ON admin_sessions(user_id)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions(token_hash)',
    );
  } else {
    db.exec('DROP TABLE IF EXISTS admin_sessions__user_ref');
  }
}

export function migrateLegacyAdminUsersToUserAccounts(
  db: Database.Database,
): LegacyAdminUsersMigrationReport {
  const report: LegacyAdminUsersMigrationReport = {
    migrated: [],
    unmatchedEmails: [],
    sessionsRemapped: 0,
    sessionsDropped: 0,
    auditRowsRemapped: 0,
    appSettingsRemapped: 0,
  };

  cleanupFailedAdminMigrationArtifacts(db);
  migrateUserAdminAuthorizationColumns(db);

  if (!tableExists(db, 'admin_users')) {
    return report;
  }

  const legacyRows = db
    .prepare('SELECT id, email, role, is_active FROM admin_users')
    .all() as Array<{ id: string; email: string; role: string; is_active: number }>;

  const updateUser = db.prepare(
    `UPDATE users
     SET admin_role = ?, admin_is_active = ?, updated_at = ?
     WHERE id = ?`,
  );

  const idMap = new Map<string, string>();
  const now = new Date().toISOString();

  for (const legacy of legacyRows) {
    if (!isAdminRole(legacy.role)) {
      continue;
    }

    const user = db
      .prepare('SELECT id, admin_role, admin_is_active FROM users WHERE email = ?')
      .get(legacy.email) as
      | { id: string; admin_role: string | null; admin_is_active: number }
      | undefined;

    if (!user) {
      report.unmatchedEmails.push(legacy.email);
      continue;
    }

    const mergedRole = maxAdminRole(
      user.admin_role && isAdminRole(user.admin_role) ? user.admin_role : null,
      legacy.role,
    );
    const mergedActive = legacy.is_active === 1 ? 1 : user.admin_is_active;

    updateUser.run(mergedRole, mergedActive, now, user.id);
    idMap.set(legacy.id, user.id);
    report.migrated.push({ email: legacy.email, userId: user.id, role: mergedRole });
  }

  if (tableExists(db, 'admin_audit_log')) {
    const remapAudit = db.prepare(
      'UPDATE admin_audit_log SET admin_user_id = ? WHERE admin_user_id = ?',
    );

    for (const [legacyId, userId] of idMap) {
      const result = remapAudit.run(userId, legacyId);
      report.auditRowsRemapped += result.changes;
    }

    db.prepare(
      `UPDATE admin_audit_log
       SET admin_user_id = NULL
       WHERE admin_user_id IS NOT NULL
         AND admin_user_id NOT IN (SELECT id FROM users)`,
    ).run();
  }

  if (tableExists(db, 'app_settings')) {
    const remapSettings = db.prepare(
      'UPDATE app_settings SET updated_by_admin_id = ? WHERE updated_by_admin_id = ?',
    );

    for (const [legacyId, userId] of idMap) {
      const result = remapSettings.run(userId, legacyId);
      report.appSettingsRemapped += result.changes;
    }

    db.prepare(
      `UPDATE app_settings
       SET updated_by_admin_id = NULL
       WHERE updated_by_admin_id IS NOT NULL
         AND updated_by_admin_id NOT IN (SELECT id FROM users)`,
    ).run();
  }

  if (tableExists(db, 'admin_sessions')) {
    migrateAdminSessionsToUserIdColumn(db, idMap, report);
  }

  migrateAdminAuditLogForeignKeyToUsers(db);
  migrateAppSettingsForeignKeyToUsers(db);

  if (report.migrated.length > 0 || report.unmatchedEmails.length > 0) {
    console.log(
      `[ADMIN MIGRATION] legacy admin_users migrated=${report.migrated.length} unmatched=${report.unmatchedEmails.length}`,
    );

    if (report.unmatchedEmails.length > 0) {
      const preview = report.unmatchedEmails.slice(0, 5);
      for (const email of preview) {
        console.warn(`[ADMIN MIGRATION] No users row for legacy admin email: ${email}`);
      }

      if (report.unmatchedEmails.length > preview.length) {
        console.warn(
          `[ADMIN MIGRATION] …and ${report.unmatchedEmails.length - preview.length} more unmatched legacy admin emails`,
        );
      }
    }
  }

  return report;
}
