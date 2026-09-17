import React, { useState, useEffect } from 'react';
import { aiService } from '../../services/aiService';
import { extractErrorMessage } from '../../services/api';

export const CacheStats = ({ userRole }) => {
  const [stats, setStats] = useState(null);
  const [threshold, setThreshold] = useState(0.95);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const canManage = userRole === 'owner' || userRole === 'admin';

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const [data, threshData] = await Promise.all([
        aiService.getCacheStats().catch(() => null),
        aiService.getCacheThreshold().catch(() => null),
      ]);
      if (data) setStats(data);
      if (threshData) setThreshold(threshData.threshold);
    } catch (err) {
      console.error('Error fetching cache stats', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleClearCache = async () => {
    if (!confirm('Clear all cached AI query responses for this organization?')) return;
    setError(null);
    setMessage(null);
    try {
      const res = await aiService.clearCache();
      setMessage(res.message || 'Semantic cache cleared successfully.');
      await fetchStats();
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setError(`Failed to clear cache: ${message}`);
    }
  };

  const handleSaveThreshold = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const res = await aiService.updateCacheThreshold(Number(threshold));
      setMessage(`Similarity threshold updated to ${res.threshold}.`);
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setError(`Failed to update threshold: ${message}`);
    }
  };

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Semantic Cache Administration</h3>
        <button onClick={fetchStats} style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>
          Refresh
        </button>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid-3" style={{ marginBottom: '1rem' }}>
        <div style={{ padding: '0.5rem', background: '#fafafa', border: '1px solid #ddd', borderRadius: '4px' }}>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>Active Cache Entries</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
            {stats?.cache_entries_count ?? stats?.total_entries ?? 0}
          </div>
        </div>

        <div style={{ padding: '0.5rem', background: '#fafafa', border: '1px solid #ddd', borderRadius: '4px' }}>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>Similarity Threshold</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
            {threshold}
          </div>
        </div>

        <div style={{ padding: '0.5rem', background: '#fafafa', border: '1px solid #ddd', borderRadius: '4px' }}>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>Cache Engine</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Redis + pgvector</div>
          <div style={{ fontSize: '0.75rem', color: '#777' }}>all-MiniLM-L6-v2 (384d)</div>
        </div>
      </div>

      {canManage && (
        <div style={{ borderTop: '1px solid #eee', paddingTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <form onSubmit={handleSaveThreshold} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div>
              <label htmlFor="cache-threshold" style={{ fontSize: '0.85rem' }}>Update Match Threshold (0.80 - 0.99):</label>
              <input
                id="cache-threshold"
                type="number"
                step="0.01"
                min="0.80"
                max="0.99"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                style={{ width: '120px', display: 'block', marginTop: '0.25rem' }}
              />
            </div>
            <button type="submit" disabled={isLoading}>
              Save Threshold
            </button>
          </form>

          <button onClick={handleClearCache} className="btn-danger" disabled={isLoading}>
            Purge Cache
          </button>
        </div>
      )}
    </div>
  );
};
