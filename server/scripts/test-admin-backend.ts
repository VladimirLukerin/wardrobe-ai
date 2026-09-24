import crypto from 'crypto';
import type { Server } from 'node:http';

import { verifyAdminPassword, serializeAdminPasswordHash } from '../src/admin/admin-password';
import { adminRoleMeetsRequirement } from '../src/admin/admin-config';
import {
  resetAdminLoginRateLimitsForTests,
  setAdminLoginRateLimitClockForTests,
} from '../src/admin/auth/admin-login-rate-limit';
import { findAdminAuditLogsForTests } from '../src/admin/audit/admin-audit-repository';
import { parseAdminSetRoleArgs } from '../src/admin/admin-set-role-cli';
import {
  createAdminSession,
  findAdminSessionByToken,
} from '../src/admin/db/admin-sessions-repository';
import {
  createTestUserWithAdminAccess,
  setUserAdminActive,
  setUserAdminRoleByEmail,
} from '../src/admin/db/admin-test-user-helper';
import { migrateLegacyAdminUsersToUserAccounts } from '../src/admin/db/admin-identity-migration';
import { migrateAdminPasswordCredentialColumns } from '../src/admin/db/admin-password-migration';
import { hashPassword, verifyPassword } from '../src/auth/password';
import { getPasswordCredential, setPasswordCredential } from '../src/db/password-credentials-repository';
import { getAdminDashboardMetrics } from '../src/admin/dashboard/admin-dashboard-service';
import { listAdminUsers } from '../src/admin/users/admin-users-service';
import { createApp } from '../src/app';
import { closeDatabase, getDatabase } from '../src/db/database';
import { createSessionForUser } from '../src/db/sessions-repository';
import {
  createAnonymousUser,
  linkVerifiedEmailToUser,
} from '../src/db/users-repository';
import { assertAdminTestsUseIsolatedDatabase, useIsolatedTestDatabase } from './test-db-isolation';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

type HttpResponse = {
  status: number;
  body: unknown;
  headers: Headers;
};

async function requestJson(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
): Promise<HttpResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let body: unknown = null;

  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }

  return {
    status: response.status,
    body,
    headers: response.headers,
  };
}

async function withTestServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const started = app.listen(0, '127.0.0.1', () => resolve(started));
  });

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind test server.');
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

async function testUserPasswordCredentialStorage(): Promise<void> {
  const suffix = crypto.randomUUID();
  const email = `admin-${suffix}@example.com`;
  const password = 'AdminPass123!';

  const admin = await createTestUserWithAdminAccess({ email, password, role: 'owner' });
  assert(admin.email === email, 'Admin email should be normalized/stored');

  const credential = getPasswordCredential(admin.id);
  assert(credential !== null, 'Password credential should exist');
  assert(credential.password_hash !== password, 'Password must not be stored plaintext');
  assert(credential.password_salt.length > 0, 'Password salt should be stored separately');
  assert(!credential.password_hash.trim().startsWith('{'), 'Password hash must not store JSON credentials');

  assert(
    await verifyPassword(password, credential!),
    'Stored user password should verify for admin login',
  );

  console.log('OK unified admin password storage on user_password_credentials');
}

async function testAdminAuthFlow(baseUrl: string): Promise<void> {
  resetAdminLoginRateLimitsForTests();
  const suffix = crypto.randomUUID();
  const email = `auth-admin-${suffix}@example.com`;
  const password = 'AuthAdmin123!';

  await createTestUserWithAdminAccess({ email, password, role: 'viewer' });

  const badLogin = await requestJson(baseUrl, '/admin/auth/login', {
    method: 'POST',
    body: { email, password: 'wrong-password' },
  });
  assert(badLogin.status === 401, 'Bad password should return 401');

  const login = await requestJson(baseUrl, '/admin/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert(login.status === 200, 'Valid login should succeed');

  const loginBody = login.body as { token?: string; admin?: { email?: string } };
  assert(typeof loginBody.token === 'string' && loginBody.token.length > 0, 'Login should return token');
  assert(loginBody.admin?.email === email, 'Login should return admin identity');

  const me = await requestJson(baseUrl, '/admin/auth/me', {
    headers: { Authorization: `Bearer ${loginBody.token}` },
  });
  assert(me.status === 200, '/admin/auth/me should work with admin token');

  const logout = await requestJson(baseUrl, '/admin/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${loginBody.token}` },
  });
  assert(logout.status === 204, 'Logout should return 204');

  const meAfterLogout = await requestJson(baseUrl, '/admin/auth/me', {
    headers: { Authorization: `Bearer ${loginBody.token}` },
  });
  assert(meAfterLogout.status === 401, 'Logged out token should be rejected');

  console.log('OK admin auth login/me/logout');
}

async function testInactiveAdminRejected(baseUrl: string): Promise<void> {
  const suffix = crypto.randomUUID();
  const email = `inactive-admin-${suffix}@example.com`;
  const password = 'InactiveAdmin123!';

  const admin = await createTestUserWithAdminAccess({ email, password, role: 'admin' });
  setUserAdminActive(admin.id, false);

  const login = await requestJson(baseUrl, '/admin/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  assert(login.status === 401, 'Inactive admin should not login');
  console.log('OK inactive admin rejected');
}

async function testExpiredAdminSessionRejected(baseUrl: string): Promise<void> {
  const suffix = crypto.randomUUID();
  const admin = await createTestUserWithAdminAccess({
    email: `expired-admin-${suffix}@example.com`,
    password: 'ExpiredAdmin123!',
    role: 'viewer',
  });

  const { token } = createAdminSession(admin.id);
  const session = findAdminSessionByToken(token);
  assert(session !== null, 'Expected admin session');

  const db = getDatabase();
  db.prepare('UPDATE admin_sessions SET expires_at = ? WHERE id = ?').run(
    '2000-01-01T00:00:00.000Z',
    session.id,
  );

  const me = await requestJson(baseUrl, '/admin/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(me.status === 401, 'Expired admin session should be rejected');

  console.log('OK expired admin session rejected');
}

async function testUserSessionCannotAccessAdmin(baseUrl: string): Promise<void> {
  const user = createAnonymousUser('Admin Gate User');
  const { token } = createSessionForUser(user.id);

  const response = await requestJson(baseUrl, '/admin/users', {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert(response.status === 401, 'Ordinary user session must not authorize admin routes');
  console.log('OK user session rejected on admin routes');
}

async function testAdminSessionCannotAccessMobileRoutes(baseUrl: string): Promise<void> {
  const suffix = crypto.randomUUID();
  const email = `unified-admin-${suffix}@example.com`;
  const password = 'UnifiedAdmin123!';

  await createTestUserWithAdminAccess({ email, password, role: 'owner' });

  const login = await requestJson(baseUrl, '/admin/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  const adminToken = (login.body as { token: string }).token;

  const me = await requestJson(baseUrl, '/me', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(me.status === 401, 'Admin session must not authorize mobile /me');

  console.log('OK admin session rejected on mobile routes');
}

async function testUnifiedMobileAndAdminLogin(baseUrl: string): Promise<void> {
  const suffix = crypto.randomUUID();
  const email = `unified-admin-${suffix}@example.com`;
  const password = 'UnifiedAdmin123!';

  await createTestUserWithAdminAccess({ email, password, role: 'owner' });

  const mobileLogin = await requestJson(baseUrl, '/auth/password/login', {
    method: 'POST',
    body: { email, password },
  });
  assert(mobileLogin.status === 200, 'Mobile password login should succeed');
  const mobileToken = (mobileLogin.body as { token: string }).token;

  const adminLogin = await requestJson(baseUrl, '/admin/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert(adminLogin.status === 200, 'Admin login should succeed with same credentials');
  const adminToken = (adminLogin.body as { token: string }).token;

  assert(mobileToken !== adminToken, 'Mobile and admin sessions must use different tokens');

  const mobileMe = await requestJson(baseUrl, '/me', {
    headers: { Authorization: `Bearer ${mobileToken}` },
  });
  assert(mobileMe.status === 200, 'Mobile token should work on /me');

  const adminMe = await requestJson(baseUrl, '/admin/auth/me', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminMe.status === 200, 'Admin token should work on /admin/auth/me');

  console.log('OK unified credentials with separate mobile/admin sessions');
}

async function testNonAdminUserCannotLoginToAdmin(baseUrl: string): Promise<void> {
  const suffix = crypto.randomUUID();
  const email = `no-admin-role-${suffix}@example.com`;
  const password = 'NoAdminRole123!';

  const user = createAnonymousUser(null);
  linkVerifiedEmailToUser(user.id, email);
  const material = await hashPassword(password);
  setPasswordCredential({
    userId: user.id,
    passwordHash: material.passwordHash,
    passwordSalt: material.passwordSalt,
  });

  const login = await requestJson(baseUrl, '/admin/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert(login.status === 401, 'User without admin_role should not login to admin');

  console.log('OK non-admin user rejected at admin login');
}

async function testUsersListSearchAndDetail(baseUrl: string): Promise<void> {
  const suffix = crypto.randomUUID();
  const admin = await createTestUserWithAdminAccess({
    email: `users-admin-${suffix}@example.com`,
    password: 'UsersAdmin123!',
    role: 'viewer',
  });

  const guest = createAnonymousUser(`Guest ${suffix}`);
  const protectedUser = createAnonymousUser(`Protected ${suffix}`);
  linkVerifiedEmailToUser(protectedUser.id, `protected-${suffix}@example.com`);

  const login = await requestJson(baseUrl, '/admin/auth/login', {
    method: 'POST',
    body: { email: admin.email, password: 'UsersAdmin123!' },
  });
  const token = (login.body as { token: string }).token;

  const unauthorized = await requestJson(baseUrl, '/admin/users');
  assert(unauthorized.status === 401, 'Missing admin session should return 401');

  const list = await requestJson(baseUrl, '/admin/users?limit=5', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(list.status === 200, 'Admin users list should succeed');
  const listBody = list.body as { items: Array<{ id: string; publicId: string; accountType: string }> };
  assert(Array.isArray(listBody.items), 'Users list should return items array');
  assert(listBody.items.length > 0, 'Users list should not be empty');

  const guestFilter = await requestJson(baseUrl, '/admin/users?accountType=guest&limit=50', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const guestItems = (guestFilter.body as { items: Array<{ accountType: string }> }).items;
  assert(guestItems.every((item) => item.accountType === 'guest'), 'Guest filter should only return guests');

  const search = await requestJson(baseUrl, `/admin/users?q=${guest.public_id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const searchItems = (search.body as { items: Array<{ publicId: string }> }).items;
  assert(
    searchItems.some((item) => item.publicId === guest.public_id),
    'Search by publicId should find guest user',
  );

  const detail = await requestJson(baseUrl, `/admin/users/${guest.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(detail.status === 200, 'User detail should succeed');
  const detailBody = detail.body as {
    account: { publicId: string };
  };
  assert(detailBody.account.publicId === guest.public_id, 'Detail should return requested user');
  assert(!('passwordHash' in (detail.body as object)), 'Detail must not expose password hash');
  assert(!('token' in (detail.body as object)), 'Detail must not expose session token');

  const missing = await requestJson(baseUrl, '/admin/users/does-not-exist', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(missing.status === 404, 'Missing user should return 404');

  const protectedDetail = await requestJson(baseUrl, `/admin/users/${protectedUser.public_id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(protectedDetail.status === 200, 'Detail should resolve publicId');
  const protectedBody = protectedDetail.body as { account: { accountType: string } };
  assert(protectedBody.account.accountType === 'protected', 'Protected user should be classified correctly');

  console.log('OK admin users list/search/detail');
}

function testRoleHelper(): void {
  assert(adminRoleMeetsRequirement('owner', 'viewer'), 'Owner should meet viewer requirement');
  assert(adminRoleMeetsRequirement('viewer', 'viewer'), 'Viewer should meet viewer requirement');
  assert(!adminRoleMeetsRequirement('viewer', 'owner'), 'Viewer should not meet owner requirement');
  console.log('OK admin role helper');
}

async function testAuditRecords(baseUrl: string): Promise<void> {
  const suffix = crypto.randomUUID();
  const email = `audit-admin-${suffix}@example.com`;
  const password = 'AuditAdmin123!';

  await createTestUserWithAdminAccess({ email, password, role: 'owner' });

  const login = await requestJson(baseUrl, '/admin/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  const token = (login.body as { token: string }).token;

  const user = createAnonymousUser(`Audit Target ${suffix}`);
  await requestJson(baseUrl, `/admin/users/${user.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  await requestJson(baseUrl, '/admin/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  const logs = findAdminAuditLogsForTests(20);
  const actions = new Set(logs.map((entry) => entry.action));

  assert(actions.has('admin.login.success'), 'Audit should record successful login');
  assert(actions.has('admin.logout'), 'Audit should record logout');
  assert(actions.has('admin.user.view'), 'Audit should record user detail view');

  for (const entry of logs) {
    assert(
      !entry.metadata_json?.includes('AuditAdmin123!'),
      'Audit metadata must not contain raw password',
    );
    assert(!entry.metadata_json?.includes(token), 'Audit metadata must not contain session token');
  }

  console.log('OK admin audit records');
}

function testListPaginationUnit(): void {
  createAnonymousUser(`Paginate A ${crypto.randomUUID()}`);
  createAnonymousUser(`Paginate B ${crypto.randomUUID()}`);

  const firstPage = listAdminUsers({ limit: 1 });
  assert(firstPage.items.length === 1, 'First page should respect limit');
  assert(firstPage.nextCursor !== null, 'Next cursor should exist when more rows remain');

  const secondPage = listAdminUsers({ limit: 1, cursor: firstPage.nextCursor ?? undefined });
  assert(secondPage.items.length === 1, 'Second page should return one item');
  assert(secondPage.items[0].id !== firstPage.items[0].id, 'Cursor pagination should advance');

  console.log('OK admin users pagination unit');
}

async function testAdminLoginRateLimit(baseUrl: string): Promise<void> {
  resetAdminLoginRateLimitsForTests();
  let now = 1_000_000;
  setAdminLoginRateLimitClockForTests(() => now);

  const suffix = crypto.randomUUID();
  const email = `rate-admin-${suffix}@example.com`;
  await createTestUserWithAdminAccess({ email, password: 'RateAdmin123!', role: 'viewer' });

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await requestJson(baseUrl, '/admin/auth/login', {
      method: 'POST',
      body: { email, password: 'wrong-password' },
    });
    assert(response.status === 401, 'Failed attempts should stay 401 until rate limited');
  }

  const limited = await requestJson(baseUrl, '/admin/auth/login', {
    method: 'POST',
    body: { email, password: 'wrong-password' },
  });
  assert(limited.status === 429, 'Too many failed admin login attempts should rate limit');

  resetAdminLoginRateLimitsForTests();
  console.log('OK admin login rate limit');
}

async function testDashboardEndpoint(baseUrl: string): Promise<void> {
  const suffix = crypto.randomUUID();
  const admin = await createTestUserWithAdminAccess({
    email: `dashboard-admin-${suffix}@example.com`,
    password: 'DashboardAdmin123!',
    role: 'viewer',
  });

  const login = await requestJson(baseUrl, '/admin/auth/login', {
    method: 'POST',
    body: { email: admin.email, password: 'DashboardAdmin123!' },
  });
  const token = (login.body as { token: string }).token;

  const response = await requestJson(baseUrl, '/admin/dashboard', {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert(response.status === 200, 'Dashboard endpoint should succeed');
  const body = response.body as { totalUsers: number };
  assert(typeof body.totalUsers === 'number', 'Dashboard should return totalUsers');
  assert(getAdminDashboardMetrics().totalUsers >= body.totalUsers, 'Dashboard count should match service');

  console.log('OK admin dashboard endpoint');
}

async function testAdminRoleManagement(): Promise<void> {
  const suffix = crypto.randomUUID();
  const email = `role-cli-${suffix}@example.com`;
  const password = 'RoleCliPass123!';

  const created = await createTestUserWithAdminAccess({ email, password, role: 'viewer' });
  assert(created.role === 'viewer', 'Created admin should start as viewer');

  const promotedAdmin = setUserAdminRoleByEmail(email, 'admin');
  assert(promotedAdmin!.role === 'admin', 'set-role viewer -> admin');

  const promotedOwner = setUserAdminRoleByEmail(email, 'owner');
  assert(promotedOwner!.role === 'owner', 'set-role admin -> owner');
  assert(
    promotedOwner!.role === 'owner' && created.updated_at.length > 0,
    'set-role should update user row',
  );

  setUserAdminRoleByEmail(email, null);
  const db = getDatabase();
  const cleared = db
    .prepare('SELECT admin_role FROM users WHERE email = ?')
    .get(email) as { admin_role: string | null };
  assert(cleared.admin_role === null, 'set-role none should remove admin access');

  let invalidSetRoleRejected = false;

  try {
    parseAdminSetRoleArgs(['--email', email, '--role', 'root']);
  } catch {
    invalidSetRoleRejected = true;
  }

  assert(invalidSetRoleRejected, 'Invalid set-role should be rejected');

  let missingUserRejected = false;

  try {
    setUserAdminRoleByEmail(`missing-${suffix}@example.com`, 'admin');
  } catch (error) {
    missingUserRejected = error instanceof Error && error.message.includes('User not found');
  }

  assert(missingUserRejected, 'Missing user should be rejected for set-role');

  console.log('OK admin role management');
}

async function testLegacyAdminPasswordMigration(): Promise<void> {
  const db = getDatabase();
  const suffix = crypto.randomUUID();
  const email = `legacy-admin-${suffix}@example.com`;
  const password = 'LegacyAdmin123!';
  const legacyJson = await serializeAdminPasswordHash(password);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  db.prepare(
    `INSERT INTO admin_users (
      id, email, password_hash, password_salt, role, is_active, created_at, updated_at, last_login_at
    ) VALUES (?, ?, ?, NULL, 'viewer', 1, ?, ?, NULL)`,
  ).run(id, email, legacyJson, now, now);

  migrateAdminPasswordCredentialColumns(db);

  const row = db
    .prepare('SELECT password_hash, password_salt FROM admin_users WHERE email = ?')
    .get(email) as { password_hash: string; password_salt: string | null } | undefined;
  assert(row !== undefined, 'Legacy admin row should exist');
  assert(row!.password_salt !== null, 'Migration should populate password_salt');
  assert(!row!.password_hash.trim().startsWith('{'), 'Migration should normalize password_hash');

  assert(
    await verifyAdminPassword(password, {
      password_hash: row!.password_hash,
      password_salt: row!.password_salt,
    }),
    'Migrated legacy admin password should verify',
  );

  console.log('OK admin password credential migration (legacy admin_users columns)');
}

async function testLegacyAdminUsersIdentityMigration(baseUrl: string): Promise<void> {
  const db = getDatabase();
  const suffix = crypto.randomUUID();
  const email = `legacy-admin-${suffix}@example.com`;
  const password = 'LegacyAdmin123!';
  const now = new Date().toISOString();

  await createTestUserWithAdminAccess({ email, password, role: 'viewer' });
  setUserAdminRoleByEmail(email, null);

  const legacyAdminId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO admin_users (
      id, email, password_hash, password_salt, role, is_active, created_at, updated_at, last_login_at
    ) VALUES (?, ?, 'unused', 'unused', 'owner', 1, ?, ?, NULL)`,
  ).run(legacyAdminId, email, now, now);

  const report = migrateLegacyAdminUsersToUserAccounts(db);
  assert(report.migrated.some((entry) => entry.email === email), 'Legacy admin should migrate to user');
  assert(report.migrated.find((entry) => entry.email === email)?.role === 'owner', 'Higher legacy role preserved');

  const login = await requestJson(baseUrl, '/admin/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert(login.status === 200, 'Admin login should work after legacy migration using user password');

  console.log('OK legacy admin_users role migration onto users');
}

async function main(): Promise<void> {
  const isolated = useIsolatedTestDatabase();

  try {
    getDatabase();
    assertAdminTestsUseIsolatedDatabase(isolated.dbPath);
    process.env.AUTH_OTP_SECRET = process.env.AUTH_OTP_SECRET ?? 'test-otp-secret';

    testRoleHelper();
    await testUserPasswordCredentialStorage();
    await testAdminRoleManagement();
    await testLegacyAdminPasswordMigration();
    testListPaginationUnit();

    await withTestServer(async (baseUrl) => {
      await testAdminAuthFlow(baseUrl);
      await testInactiveAdminRejected(baseUrl);
      await testExpiredAdminSessionRejected(baseUrl);
      await testUserSessionCannotAccessAdmin(baseUrl);
      await testAdminSessionCannotAccessMobileRoutes(baseUrl);
      await testUnifiedMobileAndAdminLogin(baseUrl);
      await testNonAdminUserCannotLoginToAdmin(baseUrl);
      await testUsersListSearchAndDetail(baseUrl);
      await testAuditRecords(baseUrl);
      await testAdminLoginRateLimit(baseUrl);
      await testDashboardEndpoint(baseUrl);
      await testLegacyAdminUsersIdentityMigration(baseUrl);
    });

    closeDatabase();
    console.log('All admin backend tests passed.');
  } finally {
    isolated.cleanup();
  }
}

void main();
