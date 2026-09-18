import React, { useState, useEffect } from 'react';
import {
  History,
  RotateCw,
  ChevronRight,
  ChevronDown,
  Calendar,
  Zap,
  Bot,
  Copy,
  Check,
} from 'lucide-react';
import { aiService } from '../../services/aiService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export const QueryHistory = ({ refreshTrigger }) => {
  const [history, setHistory] = useState([]);
  const [ordering, setOrdering] = useState('-created_at');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const data = await aiService.getHistory({ page, ordering });
      setHistory(data.results || []);
      setTotalCount(data.count || 0);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [page, ordering, refreshTrigger]);

  const totalPages = Math.ceil(totalCount / 10) || 1;

  const handleCopyResponse = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Card variant="bordered" className="shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#b2c147]/15 text-[#292929] flex items-center justify-center">
            <History size={16} />
          </div>
          <div>
            <h3
              style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
              className="text-lg font-bold text-[#292929] tracking-tight"
            >
              Query Telemetry & History
            </h3>
            <p className="text-xs text-gray-500">
              Audit log of prompt syntheses, token usage, latency, and cache efficiency
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="relative">
            <select
              id="history-sort"
              value={ordering}
              onChange={(e) => {
                setOrdering(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 pr-8 border border-gray-200 rounded-lg text-xs bg-white text-[#292929] focus:outline-none focus:ring-2 focus:ring-[#b2c147] appearance-none cursor-pointer"
            >
              <option value="-created_at">Date (Newest first)</option>
              <option value="created_at">Date (Oldest first)</option>
              <option value="-estimated_cost">Cost (Highest first)</option>
              <option value="estimated_cost">Cost (Lowest first)</option>
              <option value="model_used">Model Name</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400 text-[10px]">
              ▼
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchHistory}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RotateCw size={13} className={isLoading ? 'animate-spin text-[#b2c147]' : ''} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Table Content */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-gray-400">
          <svg className="animate-spin w-5 h-5 text-[#b2c147] mx-auto mb-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading past query records…
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400">
          No past queries recorded yet. Enter a question in the prompt box above to generate history.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/80 text-xs font-mono text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Prompt Query</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Tokens</th>
                <th className="px-4 py-3">Latency</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Cache</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {history.map((item) => {
                const isExpanded = expandedId === item.id;
                const totalTokens =
                  item.total_tokens ??
                  (item.input_tokens || 0) + (item.output_tokens || 0);

                return (
                  <React.Fragment key={item.id}>
                    <tr className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3 text-xs font-mono text-gray-500 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-gray-400" />
                          <span>{new Date(item.created_at).toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[220px] truncate text-xs font-medium text-[#292929]" title={item.query_text}>
                        {item.query_text}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="gray">{item.model_used}</Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">
                        {totalTokens.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {item.latency_ms}ms
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-emerald-700 font-semibold">
                        ${Number(item.estimated_cost).toFixed(5)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={item.cache_hit ? 'lime' : 'gray'}>
                          {item.cache_hit ? 'HIT' : 'MISS'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 text-[#292929] transition-colors cursor-pointer"
                        >
                          <span>{isExpanded ? 'Hide' : 'Inspect'}</span>
                          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Inspection Drawer */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="p-4 bg-gray-50/90 border-t border-b border-gray-200">
                          <div className="space-y-3 max-w-4xl text-xs">
                            <div>
                              <span className="font-mono uppercase font-semibold text-gray-500 block mb-1">
                                Full Prompt:
                              </span>
                              <div className="p-3 bg-white border border-gray-200 rounded-lg text-[#292929] font-sans">
                                {item.query_text}
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-mono uppercase font-semibold text-gray-500">
                                  Model Response:
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyResponse(item.id, item.response_text)}
                                  className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-black cursor-pointer"
                                >
                                  {copiedId === item.id ? (
                                    <>
                                      <Check size={12} className="text-[#b2c147]" />
                                      <span className="text-[#b2c147] font-semibold">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={12} />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <div className="p-3 bg-white border border-gray-200 rounded-lg text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
                                {item.response_text}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-gray-500">
        <span>
          Showing page <strong className="text-[#292929]">{page}</strong> of{' '}
          <strong className="text-[#292929]">{totalPages}</strong> ({totalCount} total queries)
        </span>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </Button>
        </div>
      </div>
    </Card>
  );
};
