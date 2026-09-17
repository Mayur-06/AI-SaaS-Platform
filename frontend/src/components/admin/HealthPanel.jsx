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

  const isAllHealthy =
    health.status === 'healthy' ||
    health.status === 'ok' ||
    (health.database?.status === 'healthy' && (!health.redis || health.redis?.status === 'healthy'));

  const statusText = String(health.status || (isAllHealthy ? 'healthy' : 'degraded')).toUpperCase();

  const providerEntries = Object.entries(health.providers || {}).filter(
    ([key]) => key !== 'error' && key !== 'request_id'
  );

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Infrastructure & Provider Health</h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span
            className="badge"
            style={{
              background: isAllHealthy ? '#f6ffed' : '#fff1f0',
              color: isAllHealthy ? '#237804' : '#a8071a',
              fontWeight: 600,
            }}
          >
            STATUS: {statusText}
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
                <span
                  className="badge"
                  style={{
                    background: health.database?.status === 'healthy' ? '#f6ffed' : '#fff1f0',
                    color: health.database?.status === 'healthy' ? '#237804' : '#a8071a',
                  }}
                >
                  {health.database?.status || 'unknown'}
                </span>
                {health.database?.latency_ms !== undefined && health.database?.latency_ms !== null && (
                  <span style={{ fontSize: '0.75rem', color: '#666', marginLeft: '6px' }}>{health.database.latency_ms}ms</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>⚡ Redis (Cache & Rate Limiting)</span>
              <div>
                <span
                  className="badge"
                  style={{
                    background: health.redis?.status === 'healthy' ? '#f6ffed' : '#fff1f0',
                    color: health.redis?.status === 'healthy' ? '#237804' : '#a8071a',
                  }}
                >
                  {health.redis?.status || 'unknown'}
                </span>
                {health.redis?.latency_ms !== undefined && health.redis?.latency_ms !== null && (
                  <span style={{ fontSize: '0.75rem', color: '#666', marginLeft: '6px' }}>{health.redis.latency_ms}ms</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* AI LLM Providers */}
        <div style={{ padding: '0.75rem', background: '#fafafa', border: '1px solid #ddd', borderRadius: '4px' }}>
          <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>LLM Providers & Models</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
            {providerEntries.length > 0 ? (
              providerEntries.map(([name, item]) => {
                const healthy = item?.status === 'healthy';
                const icon = name.includes('gemini') ? '✨' : name.includes('gpt') ? '🤖' : '🧠';
                return (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{icon} {name}</span>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span
                        className="badge"
                        style={{
                          background: healthy ? '#f6ffed' : '#fff1f0',
                          color: healthy ? '#237804' : '#a8071a',
                        }}
                      >
                        {item?.status || 'unknown'}
                      </span>
                      {item?.latency_ms !== undefined && item?.latency_ms !== null && (
                        <span style={{ fontSize: '0.75rem', color: '#666', marginLeft: '6px' }}>{item.latency_ms}ms</span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p style={{ color: '#777', fontStyle: 'italic' }}>No external providers configured</p>
            )}

            {health.providers?.error && (
              <p style={{ color: '#a8071a', fontSize: '0.8rem' }}>Error probing providers: {health.providers.error}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
