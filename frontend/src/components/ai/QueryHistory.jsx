import React, { useState, useEffect } from 'react';
import { aiService } from '../../services/aiService';

export const QueryHistory = ({ refreshTrigger }) => {
  const [history, setHistory] = useState([]);
  const [ordering, setOrdering] = useState('-created_at');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const data = await aiService.getHistory({ page, ordering });
      setHistory(data.results || []);
      setTotalCount(data.count || 0);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [page, ordering, refreshTrigger]);

  const totalPages = Math.ceil(totalCount / 10) || 1;

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3>Query History (Latest Queries)</h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label htmlFor="history-sort" style={{ fontSize: '0.85rem' }}>Sort by:</label>
          <select
            id="history-sort"
            value={ordering}
            onChange={(e) => {
              setOrdering(e.target.value);
              setPage(1);
            }}
            style={{ width: 'auto', padding: '0.25rem 0.5rem' }}
          >
            <option value="-created_at">Date (Newest first)</option>
            <option value="created_at">Date (Oldest first)</option>
            <option value="-estimated_cost">Cost (Highest first)</option>
            <option value="estimated_cost">Cost (Lowest first)</option>
            <option value="model_used">Model Name</option>
          </select>
          <button onClick={fetchHistory} style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <p style={{ color: '#666', padding: '1rem' }}>Loading query history...</p>
      ) : history.length === 0 ? (
        <p style={{ color: '#777', fontStyle: 'italic', padding: '0.5rem' }}>No past queries recorded yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Query</th>
                <th>Model</th>
                <th>Tokens</th>
                <th>Latency</th>
                <th>Cost</th>
                <th>Cache</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <React.Fragment key={item.id}>
                  <tr>
                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                    <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.query_text}>
                      {item.query_text}
                    </td>
                    <td><span className="badge">{item.model_used}</span></td>
                    <td>{item.total_tokens}</td>
                    <td>{item.latency_ms}ms</td>
                    <td>${Number(item.estimated_cost).toFixed(5)}</td>
                    <td>
                      <span className="badge" style={{ background: item.cache_hit ? '#e6f7ff' : '#f0f0f0' }}>
                        {item.cache_hit ? 'HIT' : 'MISS'}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                      >
                        {expandedId === item.id ? 'Hide' : 'View'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === item.id && (
                    <tr>
                      <td colSpan={8} style={{ background: '#fafafa', padding: '1rem' }}>
                        <div style={{ marginBottom: '0.5rem' }}>
                          <strong>Prompt:</strong>
                          <div style={{ whiteSpace: 'pre-wrap', marginTop: '0.25rem' }}>{item.query_text}</div>
                        </div>
                        <div>
                          <strong>Response:</strong>
                          <div style={{ whiteSpace: 'pre-wrap', marginTop: '0.25rem', background: '#fff', padding: '0.5rem', border: '1px solid #ddd' }}>
                            {item.response_text}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      <div className="pagination" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.85rem', color: '#666' }}>
          Showing page {page} of {totalPages} ({totalCount} total)
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{ padding: '0.25rem 0.5rem' }}
          >
            Previous
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            style={{ padding: '0.25rem 0.5rem' }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
