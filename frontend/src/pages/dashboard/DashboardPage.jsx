import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RotateCw, ShieldAlert } from 'lucide-react';
import { useBillingStore } from '../../store/billingStore';
import { useAuthStore } from '../../store/authStore';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { UsageChart } from '../../components/dashboard/UsageChart';
import { Button } from '../../components/ui/Button';

export const DashboardPage = () => {
  const { user, organization } = useAuthStore();
  const { currentPlan, usage, fetchBillingData, isLoading } = useBillingStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (organization || !user?.is_staff) {
      fetchBillingData();
    }
  }, [fetchBillingData, organization, user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBillingData(true);
    setRefreshing(false);
  };

  const requestsUsed = usage?.monthly_requests_used ?? 0;
  const requestLimit = usage?.monthly_limit ?? currentPlan?.monthly_request_limit ?? 100;
  const remainingQuota = Math.max(0, requestLimit - requestsUsed);
  const cacheHitRate = usage ? `${usage.cache_hit_rate}%` : '0%';
  const totalCost = usage ? `$${Number(usage.total_cost || 0).toFixed(4)}` : '$0.00';

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Superadmin Mode Notice Banner (if applicable) */}
      {!organization && user?.is_staff && (
        <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <ShieldAlert size={18} className="text-purple-700 shrink-0" />
            <div>
              <strong className="font-bold">Superadmin Mode:</strong> You are viewing the tenant dashboard without an active organization context.
            </div>
          </div>
          <Link to="/admin" className="no-underline">
            <Button variant="dark" size="sm" className="whitespace-nowrap">
              Open Admin Console →
            </Button>
          </Link>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100">
        <div>
          <h1
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-2xl sm:text-3xl font-extrabold text-[#292929] tracking-tight"
          >
            Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Real-time analytics and LLM telemetry for{' '}
            <strong className="text-[#292929] font-semibold">
              {organization?.name || (user?.is_staff ? 'Superadmin Preview' : 'Your Organization')}
            </strong>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {user?.is_staff && (
            <Link to="/admin" className="no-underline">
              <Button variant="dark" size="sm" className="flex items-center gap-1.5">
                <ShieldAlert size={14} />
                <span>Admin Console</span>
              </Button>
            </Link>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading || refreshing}
            className="flex items-center gap-2"
          >
            <RotateCw
              size={14}
              className={`${refreshing ? 'animate-spin text-[#b2c147]' : 'text-gray-500'}`}
            />
            <span>{refreshing ? 'Refreshing…' : 'Refresh Data'}</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid (4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard
          title="Monthly Requests"
          value={requestsUsed?.toLocaleString?.() ?? requestsUsed}
          subtitle={`Limit: ${requestLimit?.toLocaleString?.() ?? requestLimit}`}
          progress={{ used: requestsUsed, max: requestLimit }}
        />
        <KpiCard
          title="Remaining Quota"
          value={remainingQuota?.toLocaleString?.() ?? remainingQuota}
          subtitle={`${usage?.usage_percent ?? 0}% quota consumed`}
          badge={usage && usage.usage_percent >= 80 ? 'QUOTA ALERT' : undefined}
          progress={{ used: usage?.usage_percent ?? 0, max: 100 }}
        />
        <KpiCard
          title="Cache Hit Rate"
          value={cacheHitRate}
          subtitle={`${usage?.cache_hits ?? 0} direct cache hits`}
        />
        <KpiCard
          title="Estimated Cost"
          value={totalCost}
          subtitle={`Budget remaining: $${Number(usage?.budget_remaining || 0).toFixed(2)}`}
        />
      </div>

      {/* 30-Day Usage Trend & Breakdown */}
      <UsageChart data={usage?.daily_usage || []} />

    </div>
  );
};
