import React from 'react';
import { Download, Zap, PiggyBank } from 'lucide-react';
import { toast } from 'sonner';
import { billingService } from '../../services/billingService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export const CostSummary = ({ usage }) => {
  const handleExportCsv = async () => {
    try {
      const blob = await billingService.downloadUsageCsv();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `usage-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('CSV usage report downloaded successfully.');
    } catch (err) {
      toast.error('Failed to download CSV export. Please ensure you have permission.');
    }
  };

  const handleExportJson = async () => {
    try {
      const data = await billingService.getUsageJson();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `usage-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('JSON telemetry report downloaded successfully.');
    } catch (err) {
      toast.error('Failed to export JSON.');
    }
  };

  return (
    <Card variant="bordered" className="shadow-sm space-y-5">
      {/* Header with Export buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
        <div>
          <h3
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-lg font-bold text-[#292929] tracking-tight"
          >
            Cost & Cache Efficiency
          </h3>
          <p className="text-xs text-gray-500">
            Semantic caching savings compared to raw external LLM invocation costs
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportJson}
            className="flex items-center gap-1.5"
          >
            <Download size={13} />
            <span>Export JSON</span>
          </Button>
        </div>
      </div>

      {/* 2 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-200/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-mono text-gray-500 uppercase tracking-wider">
            <Zap size={13} className="text-[#b2c147]" />
            <span>Cache Hit Rate</span>
          </div>
          <div
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-2xl font-bold text-[#292929]"
          >
            {usage ? `${usage.cache_hit_rate}%` : '-'}
          </div>
          <div className="text-[11px] text-gray-400 font-mono">
            {usage ? `${usage.cache_hits} cached hits recorded` : ''}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-200/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-mono text-gray-500 uppercase tracking-wider">
            <PiggyBank size={13} className="text-emerald-600" />
            <span>Estimated Savings</span>
          </div>
          <div
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-2xl font-bold text-emerald-700"
          >
            ${usage ? Number(usage.cache_savings || 0).toFixed(4) : '0.0000'}
          </div>
          <div className="text-[11px] text-gray-400 font-mono">
            Direct external API fees avoided
          </div>
        </div>
      </div>
    </Card>
  );
};
