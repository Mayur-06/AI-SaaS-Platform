import React from 'react';
import { BarChart2, Calendar } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export const UsageChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <Card variant="bordered" className="text-center py-12">
        <div className="w-12 h-12 rounded-2xl bg-[#b2c147]/15 text-[#292929] flex items-center justify-center mx-auto mb-3">
          <BarChart2 size={24} />
        </div>
        <h3
          style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
          className="text-lg font-bold text-[#292929] mb-1"
        >
          No Usage Data Recorded Yet
        </h3>
        <p className="text-xs text-gray-500 max-w-sm mx-auto">
          Start running queries from the AI Query hub or the quick prompt widget to track token utilization and cost telemetry.
        </p>
      </Card>
    );
  }

  const maxRequests = Math.max(...data.map((d) => d.requests), 1);
  const totalTokens = data.reduce((acc, curr) => acc + (curr.tokens || 0), 0);
  const totalCost = data.reduce((acc, curr) => acc + Number(curr.cost || 0), 0);

  return (
    <Card variant="bordered" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
        <div>
          <h3
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-xl font-bold text-[#292929] tracking-tight"
          >
            30-Day Activity & Token Consumption
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Daily breakdown of request volume, token throughput, and estimated platform cost
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="lime">{data.length} Active Days</Badge>
          <span className="text-xs font-mono text-gray-400">
            Total: ${totalCost.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Visual Chart Bars (Last 14 days) */}
      <div>
        <div className="flex items-center justify-between text-xs text-gray-400 font-mono mb-2">
          <span>Request Volume (Last 14 Days)</span>
          <span>Max Peak: {maxRequests} req</span>
        </div>

        <div className="flex items-end gap-2 sm:gap-3 h-40 pt-4 pb-2 border-b border-gray-200">
          {data.slice(-14).map((d) => {
            const heightPct = Math.max(8, Math.round((d.requests / maxRequests) * 100));

            return (
              <div
                key={d.date}
                className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
              >
                {/* Tooltip on hover */}
                <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-[#292929] text-white text-[10px] font-mono px-2 py-1 rounded shadow-md whitespace-nowrap z-10">
                  {d.date}: {d.requests} req · ${Number(d.cost).toFixed(4)}
                </div>

                {/* Number above bar */}
                <span className="text-[10px] font-mono text-gray-400 group-hover:text-[#292929] transition-colors mb-1">
                  {d.requests}
                </span>

                {/* Bar */}
                <div
                  className="w-full bg-[#292929] group-hover:bg-[#b2c147] transition-all duration-200 rounded-t-lg"
                  style={{ height: `${heightPct}%` }}
                />

                {/* Date label */}
                <span className="text-[10px] font-mono text-gray-500 mt-1.5 whitespace-nowrap">
                  {d.date.slice(5)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Data Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-gray-500">
            Telemetry Log
          </h4>
          <span className="text-xs font-mono text-gray-400">
            {totalTokens.toLocaleString()} Total Tokens
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/80 text-xs font-mono text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Requests</th>
                <th className="px-4 py-3">Tokens</th>
                <th className="px-4 py-3 text-right">Estimated Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {data.map((row) => (
                <tr key={row.date} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-600 flex items-center gap-1.5">
                    <Calendar size={13} className="text-gray-400" />
                    <span>{row.date}</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[#292929] font-medium">
                    {row.requests.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-600">
                    {row.tokens.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-right text-emerald-700 font-semibold">
                    ${Number(row.cost).toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
};
