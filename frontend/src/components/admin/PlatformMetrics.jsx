import React from 'react';
import { Building2, Users, Activity, DollarSign, TrendingUp } from 'lucide-react';
import { Card } from '../ui/Card';

export const PlatformMetrics = ({ metrics }) => {
  if (!metrics) {
    return (
      <Card variant="bordered" className="text-center py-6 text-xs text-gray-500">
        Loading system telemetry…
      </Card>
    );
  }

  const requestsMonth = metrics.requests_this_month ?? metrics.requests_month ?? 0;
  const requestsToday = metrics.requests_today ?? 0;
  const platformCost = Number(metrics.monthly_cost_estimate ?? metrics.platform_cost ?? 0).toFixed(4);
  const revenueEstimate = Number(metrics.revenue_estimate || 0).toFixed(2);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {/* Organizations */}
      <Card variant="bordered" className="shadow-sm space-y-1 relative overflow-hidden">
        <div className="flex items-center justify-between text-xs font-mono text-gray-500 uppercase tracking-wider">
          <span>Active Tenants</span>
          <Building2 size={16} className="text-gray-400" />
        </div>
        <div
          style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
          className="text-3xl font-extrabold text-[#292929] tracking-tight"
        >
          {metrics.total_organizations ?? 0}
        </div>
        <div className="text-[11px] text-gray-400 font-mono">Isolated organization accounts</div>
      </Card>

      {/* Users */}
      <Card variant="bordered" className="shadow-sm space-y-1 relative overflow-hidden">
        <div className="flex items-center justify-between text-xs font-mono text-gray-500 uppercase tracking-wider">
          <span>Registered Users</span>
          <Users size={16} className="text-gray-400" />
        </div>
        <div
          style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
          className="text-3xl font-extrabold text-[#292929] tracking-tight"
        >
          {metrics.total_users ?? 0}
        </div>
        <div className="text-[11px] text-gray-400 font-mono">Across all multi-tenant roles</div>
      </Card>

      {/* Requests */}
      <Card variant="bordered" className="shadow-sm space-y-1 relative overflow-hidden">
        <div className="flex items-center justify-between text-xs font-mono text-gray-500 uppercase tracking-wider">
          <span>Total Requests</span>
          <Activity size={16} className="text-[#b2c147]" />
        </div>
        <div
          style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
          className="text-3xl font-extrabold text-[#292929] tracking-tight"
        >
          {Number(requestsMonth).toLocaleString()}
        </div>
        <div className="text-[11px] text-gray-400 font-mono">
          {Number(requestsToday).toLocaleString()} executed today · {metrics.cache_hit_rate_percent ?? 0}% cached
        </div>
      </Card>

      {/* Revenue & Spend */}
      <Card variant="bordered" className="shadow-sm space-y-1 relative overflow-hidden">
        <div className="flex items-center justify-between text-xs font-mono text-gray-500 uppercase tracking-wider">
          <span>Monthly Revenue</span>
          <DollarSign size={16} className="text-emerald-600" />
        </div>
        <div
          style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
          className="text-3xl font-extrabold text-emerald-700 tracking-tight"
        >
          ${revenueEstimate}
        </div>
        <div className="text-[11px] text-gray-400 font-mono">
          Gross infrastructure spend: ${platformCost}
        </div>
      </Card>
    </div>
  );
};
