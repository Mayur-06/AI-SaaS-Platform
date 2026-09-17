import React from 'react';

export const PlatformMetrics = ({ metrics }) => {
  if (!metrics) {
    return (
      <div className="card">
        <p style={{ color: '#777' }}>Loading system metrics...</p>
      </div>
    );
  }

  return (
    <div className="grid-4" style={{ marginBottom: '1rem' }}>
      <div className="card">
        <div style={{ fontSize: '0.8rem', color: '#666' }}>Total Organizations</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{metrics.total_organizations}</div>
      </div>

      <div className="card">
        <div style={{ fontSize: '0.8rem', color: '#666' }}>Total Registered Users</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{metrics.total_users}</div>
      </div>

      <div className="card">
        <div style={{ fontSize: '0.8rem', color: '#666' }}>Requests (Month / Today)</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          {metrics.requests_this_month ?? metrics.requests_month ?? 0} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#888' }}>({metrics.requests_today ?? 0} today)</span>
        </div>
      </div>

      <div className="card">
        <div style={{ fontSize: '0.8rem', color: '#666' }}>Estimated Monthly Revenue</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#237804' }}>
          ${Number(metrics.revenue_estimate || 0).toFixed(2)}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#888' }}>
          Platform Cost: ${Number(metrics.monthly_cost_estimate ?? metrics.platform_cost ?? 0).toFixed(4)}
        </div>
      </div>
    </div>
  );
};
