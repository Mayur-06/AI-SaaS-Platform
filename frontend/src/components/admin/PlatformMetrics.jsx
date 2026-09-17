import React from 'react';

export const PlatformMetrics = ({ metrics }) => {
  if (!metrics) {
    return (
      <div className="card">
        <p style={{ color: '#777' }}>Loading system metrics...</p>
      </div>
    );
  }

  const requestsMonth = metrics.requests_month ?? metrics.requests_this_month ?? 0;
  const requestsToday = metrics.requests_today ?? 0;
  const platformCost = metrics.platform_cost ?? metrics.monthly_cost_estimate ?? 0;
  const cacheHitRate = metrics.cache_hit_rate_percent ?? 0;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}
    >
      <div className="card">
        <div style={{ fontSize: '0.8rem', color: '#666' }}>Total Organizations</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{metrics.total_organizations ?? 0}</div>
      </div>

      <div className="card">
        <div style={{ fontSize: '0.8rem', color: '#666' }}>Total Registered Users</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{metrics.total_users ?? 0}</div>
      </div>

      <div className="card">
        <div style={{ fontSize: '0.8rem', color: '#666' }}>Requests (Month / Today)</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          {requestsMonth}{' '}
          <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#888' }}>({requestsToday} today)</span>
        </div>
      </div>

      <div className="card">
        <div style={{ fontSize: '0.8rem', color: '#666' }}>Global Cache Hit Rate</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0969da' }}>
          {Number(cacheHitRate).toFixed(1)}%
        </div>
        <div style={{ fontSize: '0.75rem', color: '#888' }}>
          Semantic vector cache efficiency
        </div>
      </div>

      <div className="card">
        <div style={{ fontSize: '0.8rem', color: '#666' }}>Estimated Monthly Revenue</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#237804' }}>
          ${Number(metrics.revenue_estimate || 0).toFixed(2)}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#888' }}>
          Platform Cost: ${Number(platformCost).toFixed(4)}
        </div>
      </div>
    </div>
  );
};
