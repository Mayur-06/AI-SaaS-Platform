import React from 'react';

export const UsageBreakdown = ({ usage }) => {
  if (!usage) {
    return (
      <div className="card">
        <div className="card-header">
          <h3>Monthly Quota & Usage</h3>
        </div>
        <p style={{ color: '#777' }}>Loading usage metrics...</p>
      </div>
    );
  }

  const percent = usage.usage_percent || 0;
  const isNearLimit = percent >= 80 && percent < 100;
  const isAtLimit = percent >= 100;

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Monthly Quota & Usage</h3>
        {isAtLimit ? (
          <span className="badge" style={{ background: '#fff1f0', color: '#a8071a', border: '1px solid #ffa39e' }}>
            QUOTA EXCEEDED (100%)
          </span>
        ) : isNearLimit ? (
          <span className="badge" style={{ background: '#fffbe6', color: '#ad6800', border: '1px solid #ffe58f' }}>
            WARNING: 80%+ REACHED
          </span>
        ) : (
          <span className="badge badge-active">{percent}% UTILIZED</span>
        )}
      </div>

      {isNearLimit && (
        <div className="alert alert-warning">
          <strong>Approaching Limit:</strong> You have consumed over 80% of your monthly request quota. Upgrade your plan to prevent service interruption.
        </div>
      )}

      {isAtLimit && (
        <div className="alert alert-error">
          <strong>Monthly Limit Reached:</strong> Your organization has used 100% of its monthly quota. AI queries are currently blocked.
        </div>
      )}

      {/* Progress Bar */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
          <span>Requests: <strong>{usage.monthly_requests_used?.toLocaleString?.() ?? usage.monthly_requests_used}</strong> / {usage.monthly_limit?.toLocaleString?.() ?? usage.monthly_limit}</span>
          <span>{percent}%</span>
        </div>
        <div style={{ width: '100%', height: '10px', background: '#eee', borderRadius: '5px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.min(percent, 100)}%`,
              height: '100%',
              background: isAtLimit ? '#d9363e' : isNearLimit ? '#faad14' : '#333',
            }}
          />
        </div>
      </div>

      {/* Budget & Projection Stats */}
      <div className="grid-3" style={{ marginTop: '1rem' }}>
        <div style={{ padding: '0.5rem', background: '#fafafa', border: '1px solid #ddd', borderRadius: '4px' }}>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>Projected Monthly Spend</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
            ${Number(usage.projected_monthly_spend || 0).toFixed(2)}
          </div>
        </div>

        <div style={{ padding: '0.5rem', background: '#fafafa', border: '1px solid #ddd', borderRadius: '4px' }}>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>Budget Remaining</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
            ${Number(usage.budget_remaining || 0).toFixed(2)}
          </div>
        </div>

        <div style={{ padding: '0.5rem', background: '#fafafa', border: '1px solid #ddd', borderRadius: '4px' }}>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>Actual Cost Incurred</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
            ${Number(usage.total_cost || 0).toFixed(4)}
          </div>
        </div>
      </div>
    </div>
  );
};
