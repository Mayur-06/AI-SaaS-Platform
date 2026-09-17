import React, { useState } from 'react';

export const QueryInput = ({
  onSubmit,
  status,
  lastFailedPrompt,
  onRetry,
  quotaWarning,
}) => {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || status === 'loading') return;
    await onSubmit(prompt, model || undefined);
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>Submit AI Query</h3>
      </div>

      {quotaWarning && (
        <div className="alert alert-warning">
          <strong>Usage Warning:</strong> {quotaWarning === 'approaching_limit' ? 'Approaching monthly quota (80%+ consumed)' : quotaWarning}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="prompt-text">Prompt / Question</label>
          <textarea
            id="prompt-text"
            rows={4}
            placeholder="Type your prompt here... Relevant documents in your organization's store will be automatically cited."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={status === 'loading'}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="model-select" style={{ display: 'block', marginBottom: '0.25rem' }}>
              Model (Optional override)
            </label>
            <select
              id="model-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={status === 'loading'}
            >
              <option value="">Auto (Routing by Plan Tier)</option>
              <option value="gemini-2.5-flash">Gemini Flash (Free Tier)</option>
              <option value="gpt-4o-mini">GPT-4o Mini (Pro Tier)</option>
              <option value="gpt-4">GPT-4 (Enterprise Tier)</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="submit"
            className="btn-primary"
            disabled={status === 'loading' || !prompt.trim()}
          >
            {status === 'loading' ? 'Processing...' : 'Submit Query'}
          </button>

          {status === 'error' && onRetry && (
            <button type="button" onClick={onRetry} className="btn-danger">
              Retry Query
            </button>
          )}

          {lastFailedPrompt && status === 'error' && (
            <button
              type="button"
              onClick={() => setPrompt(lastFailedPrompt)}
              style={{ fontSize: '0.85rem' }}
            >
              Restore Last Prompt
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
