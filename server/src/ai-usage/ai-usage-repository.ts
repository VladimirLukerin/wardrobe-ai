import crypto from 'crypto';

import { getDatabase } from '../db/database';
import type { AiUsageRequestType, AiUsageStatus, RecordAiUsageEventInput } from './ai-usage-types';

export function insertAiUsageEvent(input: RecordAiUsageEventInput): string {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO ai_usage_events (
      id,
      user_id,
      request_type,
      input_tokens,
      output_tokens,
      total_tokens,
      duration_ms,
      status,
      provider_error_code,
      provider_request_id,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.userId,
    input.requestType,
    Math.max(0, Math.floor(input.inputTokens)),
    Math.max(0, Math.floor(input.outputTokens)),
    Math.max(0, Math.floor(input.totalTokens)),
    Math.max(0, Math.floor(input.durationMs)),
    input.status,
    input.providerErrorCode ?? null,
    input.providerRequestId ?? null,
    createdAt,
  );

  return id;
}

export function countAiUsageEventsForTests(): number {
  const db = getDatabase();
  const row = db.prepare('SELECT COUNT(*) AS count FROM ai_usage_events').get() as { count: number };

  return row.count;
}

export function clearAiUsageEventsForTests(): void {
  const db = getDatabase();
  db.prepare('DELETE FROM ai_usage_events').run();
}

export type AiUsageSummaryRow = {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rateLimitedCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  avgDurationMs: number | null;
};

export type AiUsageByTypeRow = {
  requestType: AiUsageRequestType;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rateLimitedCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  avgDurationMs: number | null;
};

function buildFilterClause(filters: {
  from?: string | null;
  to?: string | null;
  requestType?: AiUsageRequestType | null;
}): { clause: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];

  if (filters.from) {
    parts.push('created_at >= ?');
    params.push(filters.from);
  }

  if (filters.to) {
    parts.push('created_at <= ?');
    params.push(filters.to);
  }

  if (filters.requestType) {
    parts.push('request_type = ?');
    params.push(filters.requestType);
  }

  if (parts.length === 0) {
    return { clause: '', params: [] };
  }

  return { clause: `WHERE ${parts.join(' AND ')}`, params };
}

export function queryAiUsageSummary(filters: {
  from?: string | null;
  to?: string | null;
  requestType?: AiUsageRequestType | null;
}): AiUsageSummaryRow {
  const db = getDatabase();
  const { clause, params } = buildFilterClause(filters);

  const row = db
    .prepare(
      `SELECT
        COUNT(*) AS totalCalls,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successfulCalls,
        SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) AS failedCalls,
        SUM(CASE WHEN status = 'provider_rate_limited' THEN 1 ELSE 0 END) AS rateLimitedCalls,
        COALESCE(SUM(input_tokens), 0) AS totalInputTokens,
        COALESCE(SUM(output_tokens), 0) AS totalOutputTokens,
        COALESCE(SUM(total_tokens), 0) AS totalTokens,
        AVG(duration_ms) AS avgDurationMs
      FROM ai_usage_events
      ${clause}`,
    )
    .get(...params) as {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    rateLimitedCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    avgDurationMs: number | null;
  };

  return {
    totalCalls: row.totalCalls,
    successfulCalls: row.successfulCalls,
    failedCalls: row.failedCalls,
    rateLimitedCalls: row.rateLimitedCalls,
    totalInputTokens: row.totalInputTokens,
    totalOutputTokens: row.totalOutputTokens,
    totalTokens: row.totalTokens,
    avgDurationMs: row.avgDurationMs,
  };
}

export function queryAiUsageByType(filters: {
  from?: string | null;
  to?: string | null;
  requestType?: AiUsageRequestType | null;
}): AiUsageByTypeRow[] {
  const db = getDatabase();
  const { clause, params } = buildFilterClause(filters);

  const rows = db
    .prepare(
      `SELECT
        request_type AS requestType,
        COUNT(*) AS totalCalls,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successfulCalls,
        SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) AS failedCalls,
        SUM(CASE WHEN status = 'provider_rate_limited' THEN 1 ELSE 0 END) AS rateLimitedCalls,
        COALESCE(SUM(input_tokens), 0) AS totalInputTokens,
        COALESCE(SUM(output_tokens), 0) AS totalOutputTokens,
        COALESCE(SUM(total_tokens), 0) AS totalTokens,
        AVG(duration_ms) AS avgDurationMs
      FROM ai_usage_events
      ${clause}
      GROUP BY request_type
      ORDER BY request_type ASC`,
    )
    .all(...params) as AiUsageByTypeRow[];

  return rows;
}

export type AiUsageTimeseriesPoint = {
  bucket: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  failures: number;
};

export function queryAiUsageTimeseries(filters: {
  from?: string | null;
  to?: string | null;
  requestType?: AiUsageRequestType | null;
  granularity: 'day' | 'hour';
}): AiUsageTimeseriesPoint[] {
  const db = getDatabase();
  const { clause, params } = buildFilterClause(filters);
  const bucketExpr =
    filters.granularity === 'hour'
      ? "strftime('%Y-%m-%dT%H:00:00Z', created_at)"
      : "strftime('%Y-%m-%d', created_at)";

  const rows = db
    .prepare(
      `SELECT
        ${bucketExpr} AS bucket,
        COUNT(*) AS calls,
        COALESCE(SUM(input_tokens), 0) AS inputTokens,
        COALESCE(SUM(output_tokens), 0) AS outputTokens,
        SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) AS failures
      FROM ai_usage_events
      ${clause}
      GROUP BY bucket
      ORDER BY bucket ASC`,
    )
    .all(...params) as AiUsageTimeseriesPoint[];

  return rows;
}

export type AdminAiUsageEventRow = {
  id: string;
  requestType: AiUsageRequestType;
  status: AiUsageStatus;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
  createdAt: string;
  userPublicId: string | null;
};

export function listAdminAiUsageEvents(filters: {
  limit: number;
  cursor?: string | null;
  requestType?: AiUsageRequestType | null;
  status?: AiUsageStatus | null;
}): { items: AdminAiUsageEventRow[]; nextCursor: string | null } {
  const db = getDatabase();
  const limit = Math.min(Math.max(filters.limit, 1), 100);
  const parts: string[] = [];
  const params: unknown[] = [];

  if (filters.requestType) {
    parts.push('e.request_type = ?');
    params.push(filters.requestType);
  }

  if (filters.status) {
    parts.push('e.status = ?');
    params.push(filters.status);
  }

  if (filters.cursor) {
    parts.push('(e.created_at, e.id) < (SELECT created_at, id FROM ai_usage_events WHERE id = ?)');
    params.push(filters.cursor);
  }

  const whereClause = parts.length > 0 ? `WHERE ${parts.join(' AND ')}` : '';

  const rows = db
    .prepare(
      `SELECT
        e.id,
        e.request_type AS requestType,
        e.status,
        e.input_tokens AS inputTokens,
        e.output_tokens AS outputTokens,
        e.total_tokens AS totalTokens,
        e.duration_ms AS durationMs,
        e.created_at AS createdAt,
        u.public_id AS userPublicId
      FROM ai_usage_events e
      LEFT JOIN users u ON u.id = e.user_id
      ${whereClause}
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT ?`,
    )
    .all(...params, limit + 1) as AdminAiUsageEventRow[];

  const items = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? items[items.length - 1]?.id ?? null : null;

  return { items, nextCursor };
}
