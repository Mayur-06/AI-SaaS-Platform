import React, { useState, useEffect } from 'react';
import {
  History,
  RotateCw,
  Clock,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  CornerDownLeft,
} from 'lucide-react';
import { aiService } from '../../services/aiService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ScrollArea } from '../ui/ScrollArea';
import { SimpleTooltip } from '../ui/Tooltip';

export const QueryHistory = ({
  selectedId,
  onSelectQuery,
  onReusePrompt,
  refreshTrigger,
  isSidebar = true,
}) => {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const data = await aiService.getHistory({ limit: 10, sort: 'date' });
      setHistory(data.results || []);
    } catch (err) {
      console.error('Failed to load past 10 query history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [refreshTrigger]);

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card variant="bordered" className="shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#b2c147]/20 text-[#292929] flex items-center justify-center">
            <History size={15} />
          </div>
          <div>
            <h3
              style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
              className="text-base font-bold text-[#292929] tracking-tight"
            >
              Query History
            </h3>
            <p className="text-[11px] text-gray-500">
              Past 10 queries • Click to re-view response
            </p>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={fetchHistory}
          disabled={isLoading}
          className="flex items-center gap-1 text-xs px-2.5 py-1"
        >
          <RotateCw size={12} className={isLoading ? 'animate-spin text-[#b2c147]' : ''} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Query List */}
      {isLoading && history.length === 0 ? (
        <div className="py-10 text-center text-xs text-gray-400 space-y-2">
          <svg className="animate-spin w-5 h-5 text-[#b2c147] mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p>Loading past queries…</p>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400 px-4">
          <History size={22} className="mx-auto mb-2 text-gray-300" />
          <p className="font-medium text-gray-600 mb-0.5">No queries yet</p>
          <p className="text-[11px]">Type a question in the input box above to start.</p>
        </div>
      ) : isSidebar ? (
        <ScrollArea className="h-[580px] pr-2">
          <div className="space-y-2.5">
            {history.map((item, index) => {
              const isSelected = selectedId === item.id;
              const totalTokens =
                item.total_tokens ??
                ((item.input_tokens || 0) + (item.output_tokens || 0));

              return (
                <div
                  key={item.id || index}
                  onClick={() => onSelectQuery && onSelectQuery(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (onSelectQuery) onSelectQuery(item);
                    }
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer group relative ${
                    isSelected
                      ? 'border-[#b2c147] bg-[#b2c147]/10 ring-2 ring-[#b2c147]/30 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-[#b2c147]/60 hover:bg-gray-50/70'
                  }`}
                >
                  {/* Top Row: Index, Timestamp & Selection State */}
                  <div className="flex items-center justify-between gap-2 text-[11px] text-gray-400 font-mono mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-500">#{index + 1}</span>
                      <Clock size={11} className="text-gray-400" />
                      <span>{formatTimestamp(item.created_at)}</span>
                    </div>

                    {isSelected ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                        <CheckCircle2 size={11} />
                        <span>Viewing</span>
                      </span>
                    ) : (
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-gray-400 flex items-center gap-0.5">
                        <span>Re-view</span>
                        <ArrowRight size={10} />
                      </span>
                    )}
                  </div>

                  {/* Prompt Preview */}
                  <div className="text-xs font-medium text-[#292929] line-clamp-2 mb-2 leading-relaxed">
                    {item.query_text}
                  </div>

                  {/* Bottom Row: Model, Cache Badge, Tokens, Reuse */}
                  <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-gray-100 text-[10px] font-mono text-gray-500">
                    <div className="flex items-center gap-1">
                      <Badge variant={item.cache_hit ? 'lime' : 'gray'} className="text-[9px] px-1.5 py-0">
                        {item.cache_hit ? 'CACHE' : 'LLM'}
                      </Badge>
                      <span className="text-gray-400">{item.model_used || 'auto'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">{totalTokens} tok</span>
                      {onReusePrompt && (
                        <SimpleTooltip content="Load into prompt box">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onReusePrompt(item.query_text);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[#292929] p-1 rounded hover:bg-gray-200 transition-all cursor-pointer"
                          >
                            <CornerDownLeft size={11} />
                          </button>
                        </SimpleTooltip>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {history.map((item, index) => {
            const isSelected = selectedId === item.id;
            const totalTokens =
              item.total_tokens ??
              ((item.input_tokens || 0) + (item.output_tokens || 0));

            return (
              <div
                key={item.id || index}
                onClick={() => onSelectQuery && onSelectQuery(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (onSelectQuery) onSelectQuery(item);
                  }
                }}
                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer group relative ${
                  isSelected
                    ? 'border-[#b2c147] bg-[#b2c147]/10 ring-2 ring-[#b2c147]/30 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-[#b2c147]/60 hover:bg-gray-50/70'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] text-gray-400 font-mono mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-500">#{index + 1}</span>
                    <Clock size={11} className="text-gray-400" />
                    <span>{formatTimestamp(item.created_at)}</span>
                  </div>
                  {isSelected && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                      <CheckCircle2 size={11} />
                      <span>Viewing</span>
                    </span>
                  )}
                </div>
                <div className="text-xs font-medium text-[#292929] line-clamp-2 mb-2 leading-relaxed">
                  {item.query_text}
                </div>
                <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-gray-100 text-[10px] font-mono text-gray-500">
                  <Badge variant={item.cache_hit ? 'lime' : 'gray'} className="text-[9px] px-1.5 py-0">
                    {item.cache_hit ? 'CACHE' : 'LLM'}
                  </Badge>
                  <span>{totalTokens} tok</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
