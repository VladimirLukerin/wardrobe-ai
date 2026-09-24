import { getDatabase } from '../../db/database';
import type { AiUsageRequestType } from '../../ai-usage/ai-usage-types';
import {
  listAdminAiUsageEvents,
  queryAiUsageByType,
  queryAiUsageSummary,
  queryAiUsageTimeseries,
} from '../../ai-usage/ai-usage-repository';

export type AdminAiSummaryResponse = {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rateLimitedCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  avgDurationMs: number | null;
  estimatedInputCostUsd: number | null;
  estimatedOutputCostUsd: number | null;
  estimatedTotalCostUsd: number | null;
  byType: Array<{
    requestType: AiUsageRequestType;
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    rateLimitedCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    avgDurationMs: number | null;
  }>;
};

function readOptionalCostPerMillion(envName: string): number | null {
  const raw = process.env[envName]?.trim();

  if (!raw) {
    return null;
  }

  const parsed = Number.parseFloat(raw);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function estimateCost(inputTokens: number, outputTokens: number): {
  estimatedInputCostUsd: number | null;
  estimatedOutputCostUsd: number | null;
  estimatedTotalCostUsd: number | null;
} {
  const inputRate = readOptionalCostPerMillion('AI_COST_INPUT_PER_MILLION');
  const outputRate = readOptionalCostPerMillion('AI_COST_OUTPUT_PER_MILLION');

  if (inputRate === null && outputRate === null) {
    return {
      estimatedInputCostUsd: null,
      estimatedOutputCostUsd: null,
      estimatedTotalCostUsd: null,
    };
  }

  const estimatedInputCostUsd =
    inputRate === null ? null : (inputTokens / 1_000_000) * inputRate;
  const estimatedOutputCostUsd =
    outputRate === null ? null : (outputTokens / 1_000_000) * outputRate;
  const estimatedTotalCostUsd =
    estimatedInputCostUsd === null && estimatedOutputCostUsd === null
      ? null
      : (estimatedInputCostUsd ?? 0) + (estimatedOutputCostUsd ?? 0);

  return { estimatedInputCostUsd, estimatedOutputCostUsd, estimatedTotalCostUsd };
}

export function getAdminAiSummary(filters: {
  from?: string | null;
  to?: string | null;
  requestType?: AiUsageRequestType | null;
}): AdminAiSummaryResponse {
  const summary = queryAiUsageSummary(filters);
  const byType = queryAiUsageByType(filters);
  const cost = estimateCost(summary.totalInputTokens, summary.totalOutputTokens);

  return {
    ...summary,
    ...cost,
    byType,
  };
}

export function getAdminAiTimeseries(filters: {
  from?: string | null;
  to?: string | null;
  requestType?: AiUsageRequestType | null;
  granularity: 'day' | 'hour';
}) {
  return queryAiUsageTimeseries(filters);
}

export function getAdminAiEvents(filters: {
  limit: number;
  cursor?: string | null;
  requestType?: AiUsageRequestType | null;
  status?: string | null;
}) {
  return listAdminAiUsageEvents({
    limit: filters.limit,
    cursor: filters.cursor,
    requestType: filters.requestType ?? null,
    status: (filters.status as Parameters<typeof listAdminAiUsageEvents>[0]['status']) ?? null,
  });
}

export function aiUsageEventExists(id: string): boolean {
  const db = getDatabase();
  const row = db.prepare('SELECT 1 AS ok FROM ai_usage_events WHERE id = ?').get(id) as
    | { ok: number }
    | undefined;

  return row?.ok === 1;
}
