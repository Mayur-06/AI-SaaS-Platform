import React from 'react';

export const KpiCard = ({ title, value, subtitle, badge }) => {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.85rem', color: '#555', fontWeight: 600 }}>{title}</span>
        {badge && <span className="badge badge-active">{badge}</span>}
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 'bold', margin: '0.25rem 0' }}>{value}</div>
      {subtitle && <div style={{ fontSize: '0.8rem', color: '#666' }}>{subtitle}</div>}
    </div>
  );
};
