import { getDatabase } from '../../db/database';

const ADMIN_TEST_EMAIL_PREFIXES = [
  'auth-admin-',
  'inactive-admin-',
  'expired-admin-',
  'users-admin-',
  'audit-admin-',
  'rate-admin-',
  'dashboard-admin-',
  'default-role-',
  'role-cli-',
  'legacy-admin-',
  'unified-admin-',
  'no-admin-role-',
] as const;

const ADMIN_TEST_EMAIL_REGEXES = [
  /^admin-[0-9a-f-]{36}@example\.com$/i,
  /^owner-[0-9a-f-]{36}@example\.com$/i,
  /^viewer-[0-9a-f-]{36}@example\.com$/i,
] as const;

export const ADMIN_TEST_EMAIL_MATCHERS = {
  prefixes: ADMIN_TEST_EMAIL_PREFIXES,
  regexes: ADMIN_TEST_EMAIL_REGEXES,
} as const;

export function isAdminTestEmail(email: string): boolean {
  if (!email.endsWith('@example.com')) {
    return false;
  }

  const localPart = email.slice(0, email.indexOf('@'));

  if (ADMIN_TEST_EMAIL_PREFIXES.some((prefix) => localPart.startsWith(prefix))) {
    return true;
  }

  return ADMIN_TEST_EMAIL_REGEXES.some((pattern) => pattern.test(email));
}

function findTestAdminUserIds(): string[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT id, email FROM users WHERE admin_role IS NOT NULL')
    .all() as Array<{ id: string; email: string | null }>;

  return rows
    .filter((row) => row.email !== null && isAdminTestEmail(row.email))
    .map((row) => row.id);
}

export function countAdminTestDataRows(): number {
  return findTestAdminUserIds().length;
}

export function deleteAdminTestDataRows(): { adminUsers: number } {
  const db = getDatabase();
  const userIds = findTestAdminUserIds();

  if (userIds.length === 0) {
    return { adminUsers: 0 };
  }

  const deleteSessions = db.prepare('DELETE FROM admin_sessions WHERE user_id = ?');
  const deleteAudit = db.prepare('DELETE FROM admin_audit_log WHERE admin_user_id = ?');
  const clearAdminRole = db.prepare(
    'UPDATE users SET admin_role = NULL, admin_is_active = 1, updated_at = ? WHERE id = ?',
  );
  const now = new Date().toISOString();

  const deleteOne = db.transaction((ids: string[]) => {
    for (const id of ids) {
      deleteSessions.run(id);
      deleteAudit.run(id);
      clearAdminRole.run(now, id);
    }
  });

  deleteOne(userIds);

  return { adminUsers: userIds.length };
}
