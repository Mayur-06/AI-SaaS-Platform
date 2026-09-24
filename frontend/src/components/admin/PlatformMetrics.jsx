import React from 'react';
import { Building2, Users, Activity } from 'lucide-react';
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
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
    </div>
  );
};
