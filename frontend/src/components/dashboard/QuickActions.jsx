import React, { useState } from 'react';
import { aiService } from '../../services/aiService';
import { useAuthStore } from '../../store/authStore';
import { extractErrorMessage } from '../../services/api';

export const QuickActions = ({ onQueryComplete }) => {
  const { role } = useAuthStore();
  const isViewer = role === 'viewer';
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || isViewer) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await aiService.queryAI(prompt);
      setResult(res);
      setPrompt('');
      if (onQueryComplete) onQueryComplete();
    } catch (err) {
      const { message, code } = extractErrorMessage(err);
      setError(`[${code || 'ERROR'}] ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>Quick AI Query</h3>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {isViewer && (
        <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.75rem', fontStyle: 'italic' }}>
          Viewer accounts are read-only. AI query execution requires Member, Admin, or Owner role.
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <input
            type="text"
            placeholder={isViewer ? "Read-only mode (AI queries restricted to Member/Admin/Owner)..." : "Ask anything (e.g. 'What is multi-tenancy in SaaS?')..."}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isLoading || isViewer}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={isLoading || !prompt.trim() || isViewer} title={isViewer ? 'Viewer accounts are read-only' : ''}>
          {isLoading ? 'Running query...' : isViewer ? 'Send Query (Read-Only)' : 'Send Query'}
        </button>
      </form>

      {result && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px', background: '#fafafa' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
            <span className="badge badge-active">{result.model_used}</span>
            <span className="badge">{result.cache_hit ? 'CACHE HIT' : 'LIVE LLM'}</span>
            <span style={{ fontSize: '0.8rem', color: '#666' }}>{result.latency_ms}ms</span>
            <span style={{ fontSize: '0.8rem', color: '#666' }}>${Number(result.estimated_cost).toFixed(5)}</span>
          </div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{result.response}</div>
        </div>
      )}
    </div>
  );
};
