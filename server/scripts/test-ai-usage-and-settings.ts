import crypto from 'crypto';
import type { Server } from 'node:http';

import { clearAiUsageEventsForTests, countAiUsageEventsForTests, insertAiUsageEvent } from '../src/ai-usage/ai-usage-repository';
import { recordAiUsageEvent } from '../src/ai-usage/record-ai-usage';
import { getAdminAiSummary } from '../src/admin/ai/admin-ai-service';
import { findAdminAuditLogsForTests } from '../src/admin/audit/admin-audit-repository';
import { createAdminSession } from '../src/admin/db/admin-sessions-repository';
import { createTestUserWithAdminAccess } from '../src/admin/db/admin-test-user-helper';
import { clearAppSettingsForTests } from '../src/app-settings/app-settings-repository';
import { getAllAppSettings, getClientAppConfig, updateAppSetting } from '../src/app-settings/app-settings-service';
import { createApp } from '../src/app';
import { closeDatabase, getDatabase } from '../src/db/database';
import { createSessionForUser } from '../src/db/sessions-repository';
import { createAnonymousUser } from '../src/db/users-repository';
import { resetProcessingCacheForTests } from '../src/photo-processing/processing-cost-guard';
import { assertAdminTestsUseIsolatedDatabase, useIsolatedTestDatabase } from './test-db-isolation';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function requestJson(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
): Promise<{ status: number; body: unknown }> {
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

  return { status: response.status, body };
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

async function main(): Promise<void> {
  const isolated = useIsolatedTestDatabase();

  try {
    getDatabase();
    assertAdminTestsUseIsolatedDatabase(isolated.dbPath);
  clearAiUsageEventsForTests();
  clearAppSettingsForTests();
  resetProcessingCacheForTests();

  const user = createAnonymousUser();
  const userSession = createSessionForUser(user.id);

  const owner = await createTestUserWithAdminAccess({
    email: `owner-${crypto.randomUUID()}@example.com`,
    password: 'OwnerPass123!',
    role: 'owner',
  });
  const viewer = await createTestUserWithAdminAccess({
    email: `viewer-${crypto.randomUUID()}@example.com`,
    password: 'ViewerPass123!',
    role: 'viewer',
  });
  const admin = await createTestUserWithAdminAccess({
    email: `admin-${crypto.randomUUID()}@example.com`,
    password: 'AdminPass123!',
    role: 'admin',
  });

  const ownerToken = createAdminSession(owner.id).token;
  const viewerToken = createAdminSession(viewer.id).token;
  const adminToken = createAdminSession(admin.id).token;

  insertAiUsageEvent({
    userId: user.id,
    requestType: 'photo',
    inputTokens: 100,
    outputTokens: 20,
    totalTokens: 120,
    durationMs: 900,
    status: 'success',
  });
  insertAiUsageEvent({
    userId: user.id,
    requestType: 'paired',
    inputTokens: 50,
    outputTokens: 10,
    totalTokens: 60,
    durationMs: 500,
    status: 'provider_rate_limited',
    providerErrorCode: 'rate_limit_exceeded',
  });

  const summary = getAdminAiSummary({ requestType: 'photo' });
  assert(summary.totalCalls === 1, 'Photo filter summary count');
  assert(summary.totalInputTokens === 100, 'Photo filter input tokens');

  const defaults = getAllAppSettings();
  assert(
    defaults.find((entry) => entry.key === 'daily_stylist_enabled')?.value === true,
    'Default daily_stylist_enabled',
  );

  try {
    updateAppSetting({
      key: 'daily_stylist_enabled',
      value: 'yes',
      updatedByAdminId: admin.id,
    });
    assert(false, 'Invalid boolean should throw');
  } catch {
    // expected
  }

  updateAppSetting({
    key: 'guest_ai_enabled',
    value: false,
    updatedByAdminId: admin.id,
  });

  const clientConfig = getClientAppConfig();
  assert(clientConfig.guestAiEnabled === false, 'Client config reflects guest AI flag');
  assert(!('maintenance_message' in clientConfig), 'Client config excludes maintenance_message');

  recordAiUsageEvent({
    userId: user.id,
    requestType: 'suggest',
    inputTokens: 1,
    outputTokens: 1,
    totalTokens: 2,
    durationMs: 1,
    status: 'success',
  });

  const beforeCount = countAiUsageEventsForTests();
  recordAiUsageEvent({
    userId: null,
    requestType: 'daily',
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    durationMs: 10,
    status: 'provider_error',
    providerErrorCode: 'server_error',
  });
  assert(countAiUsageEventsForTests() === beforeCount + 1, 'Usage event insert increments count');

  await withTestServer(async (baseUrl) => {
    const appConfig = await requestJson(baseUrl, '/app-config');
    assert(appConfig.status === 200, 'GET /app-config status');
    const configBody = appConfig.body as Record<string, unknown>;
    assert(typeof configBody.dailyStylistEnabled === 'boolean', '/app-config dailyStylistEnabled');
    assert(!('maintenanceMessage' in configBody), '/app-config excludes maintenance');

    const userAi = await requestJson(baseUrl, '/suggest-outfits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userSession.token}` },
      body: { wardrobe: [], stylistPreferences: {}, userParameters: {}, behavioralContext: {} },
    });
    assert(userAi.status === 403, 'Guest AI disabled blocks suggest for guest');

    const viewerSettings = await requestJson(baseUrl, '/admin/settings', {
      headers: { Authorization: `Bearer ${viewerToken}` },
    });
    assert(viewerSettings.status === 200, 'Viewer can read settings');

    const viewerMutation = await requestJson(baseUrl, '/admin/settings/guest_ai_enabled', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${viewerToken}` },
      body: { value: true },
    });
    assert(viewerMutation.status === 403, 'Viewer cannot mutate settings');

    const adminMutation = await requestJson(baseUrl, '/admin/settings/paired_outfits_enabled', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { value: false },
    });
    assert(adminMutation.status === 200, 'Admin can mutate settings');

    const auditEntries = findAdminAuditLogsForTests().filter(
      (entry) => entry.action === 'admin.setting.update' && entry.target_id === 'paired_outfits_enabled',
    );
    assert(auditEntries.length >= 1, 'Settings mutation audited');

    const aiSummary = await requestJson(baseUrl, '/admin/ai/summary', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(aiSummary.status === 200, 'Owner can read AI summary');
    const aiBody = aiSummary.body as { totalCalls: number; byType: unknown[] };
    assert(aiBody.totalCalls >= 3, 'AI summary total calls');

    const aiEvents = await requestJson(baseUrl, '/admin/ai/events?limit=2', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(aiEvents.status === 200, 'AI events list');
    const eventsBody = aiEvents.body as { items: unknown[]; nextCursor: string | null };
    assert(eventsBody.items.length === 2, 'AI events pagination limit');

    const denied = await requestJson(baseUrl, '/admin/ai/summary', {
      headers: { Authorization: `Bearer ${userSession.token}` },
    });
    assert(denied.status === 401, 'Normal user cannot access admin AI routes');
  });

  console.log('All AI usage and settings tests passed.');
  } finally {
    closeDatabase();
    isolated.cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
