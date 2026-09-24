import { useEffect, useState } from 'react';

import { fetchAiEvents, fetchAiSummary } from '../api/admin-api';
import { MetricCard } from '../components/metric-card';
import { ErrorBanner, LoadingState } from '../components/state-panels';
import type { AdminAiEventItem, AdminAiSummary } from '../types/admin-api';
import { formatDateTime } from '../utils/format';

const TYPE_LABELS: Record<string, string> = {
  photo: 'Photo',
  suggest: 'Suggest',
  daily: 'Daily',
  paired: 'Paired',
};

export function AiUsagePage() {
  const [summary, setSummary] = useState<AdminAiSummary | null>(null);
  const [events, setEvents] = useState<AdminAiEventItem[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([fetchAiSummary(), fetchAiEvents({ limit: 25 })])
      .then(([summaryData, eventsData]) => {
        if (!cancelled) {
          setSummary(summaryData);
          setEvents(eventsData.items);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(fetchError);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <LoadingState label="Загрузка AI usage…" />;
  }

  if (!summary) {
    return <ErrorBanner error={error} />;
  }

  return (
    <div className="stack-lg">
      <div>
        <h1 className="page-title">AI Usage</h1>
        <p className="page-subtitle">OpenAI provider calls (read-only)</p>
      </div>

      <ErrorBanner error={error} />

      <div className="metric-grid">
        <MetricCard label="Total calls" value={summary.totalCalls} />
        <MetricCard label="Input tokens" value={summary.totalInputTokens} />
        <MetricCard label="Output tokens" value={summary.totalOutputTokens} />
        <MetricCard label="Failures" value={summary.failedCalls} />
        <MetricCard label="Rate limited" value={summary.rateLimitedCalls} />
        <MetricCard
          label="Avg duration (ms)"
          value={summary.avgDurationMs === null ? 0 : Math.round(summary.avgDurationMs)}
        />
      </div>

      {summary.estimatedTotalCostUsd !== null ? (
        <p className="page-subtitle">
          Estimated cost (USD): {summary.estimatedTotalCostUsd.toFixed(4)} — configure{' '}
          <code>AI_COST_*_PER_MILLION</code> on the server; figures are approximate.
        </p>
      ) : null}

      <section className="stack-md">
        <h2 className="section-title">By request type</h2>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Calls</th>
                <th>Input tokens</th>
                <th>Output tokens</th>
                <th>Failures</th>
                <th>Rate limited</th>
              </tr>
            </thead>
            <tbody>
              {summary.byType.map((row) => (
                <tr key={row.requestType}>
                  <td>{TYPE_LABELS[row.requestType] ?? row.requestType}</td>
                  <td>{row.totalCalls}</td>
                  <td>{row.totalInputTokens}</td>
                  <td>{row.totalOutputTokens}</td>
                  <td>{row.failedCalls}</td>
                  <td>{row.rateLimitedCalls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack-md">
        <h2 className="section-title">Recent events</h2>
        {events.length === 0 ? (
          <p className="page-subtitle">No AI usage recorded yet.</p>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Tokens</th>
                  <th>Duration</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>{formatDateTime(event.createdAt)}</td>
                    <td>{TYPE_LABELS[event.requestType] ?? event.requestType}</td>
                    <td>{event.status}</td>
                    <td>{event.totalTokens}</td>
                    <td>{event.durationMs} ms</td>
                    <td>{event.userPublicId ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
