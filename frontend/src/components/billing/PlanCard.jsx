import React from 'react';

export const PlanCard = ({
  plan,
  isCurrent,
  onUpgrade,
  isLoading,
  userRole,
}) => {
  const canUpgrade = userRole === 'owner' || userRole === 'admin';

  return (
    <div
      className="card"
      style={{
        border: isCurrent ? '2px solid #222' : '1px solid #ccc',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 style={{ fontSize: '1.2rem' }}>{plan.name}</h3>
          {isCurrent && <span className="badge badge-active">CURRENT PLAN</span>}
        </div>

        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '0.5rem 0' }}>
          ${Number(plan.price).toFixed(2)}
          <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: '#666' }}> / month</span>
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <li>
            ✓ <strong>{plan.monthly_request_limit.toLocaleString()}</strong> monthly requests
          </li>
          <li>
            ✓ <strong>{plan.requests_per_minute}</strong> requests/min rate limit
          </li>
          <li>
            ✓ <strong>{(plan.cache_ttl_seconds / 3600).toFixed(0)}h</strong> semantic cache TTL
          </li>
          <li>
            ✓ Org-isolated RAG vector retrieval
          </li>
        </ul>
      </div>

      <div style={{ marginTop: '1rem' }}>
        {isCurrent ? (
          <button disabled style={{ width: '100%' }}>
            Active Plan
          </button>
        ) : canUpgrade ? (
          <button
            className="btn-primary"
            style={{ width: '100%' }}
            onClick={() => onUpgrade(plan.id)}
            disabled={isLoading}
          >
            {isLoading ? 'Switching...' : `Switch to ${plan.name}`}
          </button>
        ) : (
          <button
            disabled
            style={{ width: '100%', opacity: 0.6, cursor: 'not-allowed' }}
            title="Only Owner or Admin can change plans"
          >
            Switch to {plan.name} (Admin Only)
          </button>
        )}
      </div>
    </div>
  );
};
