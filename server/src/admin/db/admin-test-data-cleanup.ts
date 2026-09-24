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
  const rows = db.prepare('SELECT id, email FROM admin_users').all() as Array<{
    id: string;
    email: string;
  }>;

  return rows.filter((row) => isAdminTestEmail(row.email)).map((row) => row.id);
}

export function countAdminTestDataRows(): number {
  return findTestAdminUserIds().length;
}

export function deleteAdminTestDataRows(): { adminUsers: number } {
  const db = getDatabase();
  const adminUserIds = findTestAdminUserIds();

  if (adminUserIds.length === 0) {
    return { adminUsers: 0 };
  }

  const deleteSessions = db.prepare(
    'DELETE FROM admin_sessions WHERE admin_user_id = ?',
  );
  const deleteAudit = db.prepare('DELETE FROM admin_audit_log WHERE admin_user_id = ?');
  const deleteAdmin = db.prepare('DELETE FROM admin_users WHERE id = ?');

  const deleteOne = db.transaction((ids: string[]) => {
    for (const id of ids) {
      deleteSessions.run(id);
      deleteAudit.run(id);
      deleteAdmin.run(id);
    }
  });

  deleteOne(adminUserIds);

  return { adminUsers: adminUserIds.length };
}
