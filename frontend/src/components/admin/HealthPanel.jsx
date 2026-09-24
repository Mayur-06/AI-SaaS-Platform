import React from 'react';
import { Activity, RotateCw, Database, Server, Cpu } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export const HealthPanel = ({ health, onRefresh, isLoading }) => {
  if (!health) {
    return (
      <Card variant="bordered" className="text-center py-6 text-xs text-gray-500">
        Inspecting infrastructure health status…
      </Card>
    );
  }

  const isAllHealthy =
    health.status === 'healthy' ||
    health.status === 'ok' ||
    (health.database?.status === 'healthy' && (!health.redis || health.redis?.status === 'healthy'));

  const statusText = String(health.status || (isAllHealthy ? 'healthy' : 'degraded')).toUpperCase();

  return (
    <Card variant="bordered" className="shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#b2c147]/15 text-[#292929] flex items-center justify-center">
            <Activity size={16} />
          </div>
          <div>
            <h3
              style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
              className="text-lg font-bold text-[#292929] tracking-tight"
            >
              Infrastructure & Provider Health
            </h3>
            <p className="text-xs text-gray-500">
              Live availability, latency telemetry, and connectivity probes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge variant={isAllHealthy ? 'green' : 'red'}>
            STATUS: {statusText}
          </Badge>
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RotateCw size={13} className={isLoading ? 'animate-spin text-[#b2c147]' : ''} />
            <span>Check Now</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Core Infrastructure */}
        <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-200/80 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-600 font-mono">
            <Database size={13} className="text-gray-400" />
            <span>Core Storage & Vector Engine</span>
          </div>

          <div className="space-y-2 text-xs">
            {/* PostgreSQL */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-gray-200/70">
              <span className="font-semibold text-gray-700">🐘 PostgreSQL + pgvector</span>
              <div className="flex items-center gap-2 font-mono">
                {health.database?.latency_ms !== undefined && health.database?.latency_ms !== null && (
                  <span className="text-gray-400">{health.database.latency_ms}ms</span>
                )}
                <Badge variant={health.database?.status === 'healthy' ? 'green' : 'red'}>
                  {health.database?.status || 'unknown'}
                </Badge>
              </div>
            </div>

            {/* Redis */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-gray-200/70">
              <span className="font-semibold text-gray-700">⚡ Redis (Semantic Cache & Rate Limits)</span>
              <div className="flex items-center gap-2 font-mono">
                {health.redis?.latency_ms !== undefined && health.redis?.latency_ms !== null && (
                  <span className="text-gray-400">{health.redis.latency_ms}ms</span>
                )}
                <Badge variant={health.redis?.status === 'healthy' ? 'green' : 'red'}>
                  {health.redis?.status || 'unknown'}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* AI LLM Providers */}
        <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-200/80 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-600 font-mono">
            <Cpu size={13} className="text-gray-400" />
            <span>External LLM Providers</span>
          </div>

          <div className="space-y-2 text-xs">
            {health.providers && Object.keys(health.providers).length > 0 ? (
              Object.entries(health.providers).map(([name, p]) => (
                <div
                  key={name}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-gray-200/70"
                >
                  <span className="font-semibold text-gray-700 font-mono">
                    ✨ {name}
                  </span>
                  <div className="flex items-center gap-2 font-mono">
                    {p.latency_ms !== undefined && (
                      <span className="text-gray-400">{p.latency_ms}ms</span>
                    )}
                    <Badge variant={p.status === 'healthy' ? 'green' : p.status === 'not_configured' ? 'gray' : 'red'}>
                      {p.status || 'unknown'}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-400 italic text-xs py-2">No external LLM providers configured</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
