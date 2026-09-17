import React, { useState } from 'react';
import { aiService } from '../../services/aiService';
import { extractErrorMessage } from '../../services/api';

export const QuickActions = ({ onQueryComplete }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

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

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <input
            type="text"
            placeholder="Ask anything (e.g. 'What is multi-tenancy in SaaS?')..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={isLoading || !prompt.trim()}>
          {isLoading ? 'Running query...' : 'Send Query'}
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
