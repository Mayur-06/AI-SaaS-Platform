import React from 'react';
import { AlertTriangle, AlertOctagon, TrendingUp, DollarSign, Wallet } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ProgressBar } from '../ui/ProgressBar';

export const UsageBreakdown = ({ usage }) => {
  if (!usage) {
    return (
      <Card variant="bordered" className="text-center py-8">
        <p className="text-xs text-gray-500">Loading quota utilization telemetry…</p>
      </Card>
    );
  }

  const percent = usage.usage_percent || 0;
  const isNearLimit = percent >= 80 && percent < 100;
  const isAtLimit = percent >= 100;

  return (
    <Card variant="bordered" className="shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-gray-100">
        <div>
          <h3
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-lg font-bold text-[#292929] tracking-tight"
          >
            Monthly Quota & Utilization
          </h3>
          <p className="text-xs text-gray-500">
            Real-time tracking of request limits, cost trajectory, and budget ceilings
          </p>
        </div>

        {isAtLimit && <Badge variant="red">QUOTA EXCEEDED (100%)</Badge>}
        {isNearLimit && <Badge variant="red">WARNING: 80%+ CONSUMED</Badge>}
      </div>

      {/* Warnings if limit reached */}
      {isNearLimit && (
        <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <span>
            <strong>Approaching Capacity:</strong> You have consumed over 80% of your monthly request quota. Upgrade your plan to prevent pipeline throttling.
          </span>
        </div>
      )}

      {isAtLimit && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertOctagon size={16} className="text-red-600 shrink-0" />
          <span>
            <strong>Monthly Limit Reached:</strong> Your organization has consumed 100% of its allocation. AI query execution is currently halted until reset or upgrade.
          </span>
        </div>
      )}

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-gray-600">
            Requests: <strong className="text-[#292929] font-bold">{usage.monthly_requests_used?.toLocaleString?.() ?? usage.monthly_requests_used}</strong> / {usage.monthly_limit?.toLocaleString?.() ?? usage.monthly_limit}
          </span>
          <span className="font-semibold text-[#292929]">{percent}%</span>
        </div>
        <ProgressBar value={percent} max={100} size="md" />
      </div>

      {/* 3 Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-200/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-mono text-gray-500 uppercase tracking-wider">
            <TrendingUp size={13} className="text-gray-400" />
            <span>Projected Spend</span>
          </div>
          <div
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-2xl font-bold text-[#292929]"
          >
            ${Number(usage.projected_monthly_spend || 0).toFixed(2)}
          </div>
          <div className="text-[11px] text-gray-400 font-mono">Estimated by end of cycle</div>
        </div>

        <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-200/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-mono text-gray-500 uppercase tracking-wider">
            <Wallet size={13} className="text-gray-400" />
            <span>Budget Remaining</span>
          </div>
          <div
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-2xl font-bold text-[#292929]"
          >
            ${Number(usage.budget_remaining || 0).toFixed(2)}
          </div>
          <div className="text-[11px] text-gray-400 font-mono">From configured ceiling</div>
        </div>

        <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-200/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-mono text-gray-500 uppercase tracking-wider">
            <DollarSign size={13} className="text-gray-400" />
            <span>Actual Spend</span>
          </div>
          <div
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-2xl font-bold text-emerald-700"
          >
            ${Number(usage.total_cost || 0).toFixed(4)}
          </div>
          <div className="text-[11px] text-gray-400 font-mono">Direct LLM inference costs</div>
        </div>
      </div>
    </Card>
  );
};
