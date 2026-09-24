import { useEffect, useState } from 'react';

import { fetchDashboard } from '../api/admin-api';
import { MetricCard } from '../components/metric-card';
import { ErrorBanner, LoadingState } from '../components/state-panels';
import type { AdminDashboardMetrics } from '../types/admin-api';

export function DashboardPage() {
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void fetchDashboard()
      .then((data) => {
        if (!cancelled) {
          setMetrics(data);
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
    return <LoadingState label="Загрузка метрик…" />;
  }

  if (!metrics) {
    return <ErrorBanner error={error} />;
  }

  return (
    <div className="stack-lg">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Read-only operational overview</p>
      </div>

      <ErrorBanner error={error} />

      <div className="metric-grid">
        <MetricCard label="Users" value={metrics.totalUsers} />
        <MetricCard label="Guests" value={metrics.guestUsers} />
        <MetricCard label="Protected" value={metrics.protectedUsers} />
        <MetricCard label="Wardrobe items" value={metrics.totalWardrobeItems} />
        <MetricCard label="Saved outfits" value={metrics.totalSavedOutfits} />
        <MetricCard label="Family links" value={metrics.totalFamilyRelationships} />
      </div>
    </div>
  );
}
