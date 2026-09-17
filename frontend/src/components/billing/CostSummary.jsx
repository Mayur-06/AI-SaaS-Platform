import React from 'react';
import { billingService } from '../../services/billingService';

export const CostSummary = ({ usage }) => {
  const handleExportCsv = async () => {
    try {
      const blob = await billingService.downloadUsageCsv();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `usage-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download CSV export. Please ensure you have permission.');
    }
  };

  const handleExportJson = async () => {
    try {
      const data = await billingService.getUsageJson();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `usage-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export JSON.');
    }
  };

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Cost & Cache Efficiency</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleExportCsv} style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>
            📥 Export CSV
          </button>
          <button onClick={handleExportJson} style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>
            📥 Export JSON
          </button>
        </div>
      </div>

      <div className="grid-3">
        <div style={{ padding: '0.5rem', background: '#fafafa', border: '1px solid #ddd', borderRadius: '4px' }}>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>Cache Hit Rate</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
            {usage ? `${usage.cache_hit_rate}%` : '-'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#777' }}>
            {usage ? `${usage.cache_hits} cache hits` : ''}
          </div>
        </div>

        <div style={{ padding: '0.5rem', background: '#fafafa', border: '1px solid #ddd', borderRadius: '4px' }}>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>Estimated Cache Savings</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#237804' }}>
            ${usage ? Number(usage.cache_savings || 0).toFixed(4) : '0.0000'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#777' }}>Direct LLM cost avoided</div>
        </div>

        <div style={{ padding: '0.5rem', background: '#fafafa', border: '1px solid #ddd', borderRadius: '4px' }}>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>Total Net Platform Cost</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
            ${usage ? Number(usage.total_cost || 0).toFixed(4) : '0.0000'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#777' }}>Aggregated across all users</div>
        </div>
      </div>
    </div>
  );
};
