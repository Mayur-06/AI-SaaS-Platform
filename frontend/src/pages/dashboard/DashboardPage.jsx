import React, { useEffect } from 'react';
import { useBillingStore } from '../../store/billingStore';
import { useAuthStore } from '../../store/authStore';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { UsageChart } from '../../components/dashboard/UsageChart';
import { QuickActions } from '../../components/dashboard/QuickActions';

export const DashboardPage = () => {
  const { organization } = useAuthStore();
  const { currentPlan, usage, fetchBillingData } = useBillingStore();

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  const requestsUsed = usage?.monthly_requests_used ?? 0;
  const requestLimit = usage?.monthly_limit ?? currentPlan?.monthly_request_limit ?? 100;
  const remainingQuota = Math.max(0, requestLimit - requestsUsed);
  const cacheHitRate = usage ? `${usage.cache_hit_rate}%` : '0%';
  const totalCost = usage ? `$${Number(usage.total_cost || 0).toFixed(4)}` : '$0.00';

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 'bold' }}>Dashboard</h1>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>
            Real-time analytics for <strong>{organization?.name || 'Your Organization'}</strong>
          </p>
        </div>
        <button onClick={() => fetchBillingData(true)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
          ↻ Refresh Data
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        <KpiCard
          title="Monthly Requests"
          value={requestsUsed?.toLocaleString?.() ?? requestsUsed}
          subtitle={`Limit: ${requestLimit?.toLocaleString?.() ?? requestLimit}`}
        />
        <KpiCard
          title="Remaining Quota"
          value={remainingQuota?.toLocaleString?.() ?? remainingQuota}
          subtitle={`${usage?.usage_percent ?? 0}% consumed`}
          badge={usage && usage.usage_percent >= 80 ? 'QUOTA ALERT' : undefined}
        />
        <KpiCard
          title="Cache Hit Rate"
          value={cacheHitRate}
          subtitle={`${usage?.cache_hits ?? 0} cached hits`}
        />
        <KpiCard
          title="Estimated Cost"
          value={totalCost}
          subtitle={`Budget remaining: $${Number(usage?.budget_remaining || 0).toFixed(2)}`}
        />
      </div>

      {/* Quick AI Query Widget */}
      <div style={{ marginBottom: '1.5rem' }}>
        <QuickActions onQueryComplete={() => fetchBillingData()} />
      </div>

      {/* 30-Day Usage Trend & Breakdown */}
      <div>
        <UsageChart data={usage?.daily_usage || []} />
      </div>
    </div>
  );
};
