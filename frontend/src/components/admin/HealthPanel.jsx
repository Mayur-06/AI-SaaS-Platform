import React from 'react';

export const HealthPanel = ({ health, onRefresh, isLoading }) => {
  if (!health) {
    return (
      <div className="card">
        <div className="card-header">
          <h3>Infrastructure & Provider Health</h3>
        </div>
        <p style={{ color: '#777' }}>Checking health status...</p>
      </div>
    );
  }

  const isAllHealthy = health.status === 'healthy' || health.status === 'ok';

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Infrastructure & Provider Health</h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className="badge" style={{ background: isAllHealthy ? '#f6ffed' : '#fff1f0', color: isAllHealthy ? '#237804' : '#a8071a' }}>
            STATUS: {health.status.toUpperCase()}
          </span>
          <button onClick={onRefresh} disabled={isLoading} style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>
            {isLoading ? 'Checking...' : 'Check Now'}
          </button>
        </div>
      </div>

      <div className="grid-2">
        {/* Core Infrastructure */}
        <div style={{ padding: '0.75rem', background: '#fafafa', border: '1px solid #ddd', borderRadius: '4px' }}>
          <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Core Infrastructure</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🐘 PostgreSQL (pgvector)</span>
              <div>
                <span className="badge badge-active">{health.database?.status || 'ok'}</span>
                {health.database?.latency_ms !== undefined && (
                  <span style={{ fontSize: '0.75rem', color: '#666', marginLeft: '6px' }}>{health.database.latency_ms}ms</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>⚡ Redis (Cache & Rate Limiting)</span>
              <div>
                <span className="badge badge-active">{health.redis?.status || 'ok'}</span>
                {health.redis?.latency_ms !== undefined && (
                  <span style={{ fontSize: '0.75rem', color: '#666', marginLeft: '6px' }}>{health.redis.latency_ms}ms</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* AI LLM Providers */}
        <div style={{ padding: '0.75rem', background: '#fafafa', border: '1px solid #ddd', borderRadius: '4px' }}>
          <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>LLM Providers</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
            {health.providers?.gemini && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>✨ Google Gemini (Primary Free)</span>
                <div>
                  <span className="badge badge-active">{health.providers.gemini.status}</span>
                  {health.providers.gemini.latency_ms !== undefined && (
                    <span style={{ fontSize: '0.75rem', color: '#666', marginLeft: '6px' }}>{health.providers.gemini.latency_ms}ms</span>
                  )}
                </div>
              </div>
            )}

            {health.providers?.openai && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🤖 OpenAI (Pro & Enterprise)</span>
                <div>
                  <span className="badge badge-active">{health.providers.openai.status}</span>
                  {health.providers.openai.latency_ms !== undefined && (
                    <span style={{ fontSize: '0.75rem', color: '#666', marginLeft: '6px' }}>{health.providers.openai.latency_ms}ms</span>
                  )}
                </div>
              </div>
            )}

            {Object.keys(health.providers || {}).length === 0 && (
              <p style={{ color: '#777', fontStyle: 'italic' }}>No external providers configured</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
