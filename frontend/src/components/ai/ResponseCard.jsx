import React from 'react';

export const ResponseCard = ({ data, errorInfo, isLoading }) => {
  if (isLoading) {
    return (
      <div className="card">
        <div className="card-header">
          <h3>Response</h3>
        </div>
        <p style={{ color: '#555' }}>Generating answer via model routing pipeline...</p>
      </div>
    );
  }

  if (errorInfo) {
    return (
      <div className="card" style={{ borderColor: '#ffa39e' }}>
        <div className="card-header" style={{ color: '#a8071a' }}>
          <h3>Query Failed</h3>
        </div>
        <div className="alert alert-error">
          <div><strong>Error:</strong> {errorInfo.message}</div>
          {errorInfo.code && <div><strong>Code:</strong> <code>{errorInfo.code}</code></div>}
          {errorInfo.requestId && <div><strong>Request ID:</strong> <code>{errorInfo.requestId}</code></div>}
          {errorInfo.rateLimitReset && <div><strong>Retry After:</strong> {errorInfo.rateLimitReset}s</div>}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card">
        <div className="card-header">
          <h3>Response</h3>
        </div>
        <p style={{ color: '#777', fontStyle: 'italic' }}>
          No query submitted yet. Enter a prompt above to see model response and metadata.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3>Response</h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className="badge badge-active">{data.model_used}</span>
          <span className="badge" style={{ background: data.cache_hit ? '#e6f7ff' : '#f0f0f0' }}>
            {data.cache_hit ? '⚡ CACHE HIT' : '🔄 CACHE MISS'}
          </span>
          <span className="badge">{data.latency_ms} ms</span>
          <span className="badge">${Number(data.estimated_cost).toFixed(5)}</span>
        </div>
      </div>

      {data.usage_warning && (
        <div className="alert alert-warning">
          <strong>Usage Warning:</strong> {data.usage_warning}
        </div>
      )}

      {/* Main Response Output */}
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, padding: '0.75rem', background: '#fafafa', borderRadius: '4px', border: '1px solid #eee', marginBottom: '1rem' }}>
        {data.response}
      </div>

      {/* Metrics and Meta */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', fontSize: '0.85rem', color: '#555', borderTop: '1px solid #eee', paddingTop: '0.75rem' }}>
        <div><strong>Prompt Tokens:</strong> {data.tokens?.prompt_tokens ?? '-'}</div>
        <div><strong>Completion Tokens:</strong> {data.tokens?.completion_tokens ?? '-'}</div>
        <div><strong>Total Tokens:</strong> {data.tokens?.total_tokens ?? '-'}</div>
        {data.request_id && (
          <div style={{ gridColumn: 'span 2' }}>
            <strong>Request ID:</strong> <code>{data.request_id}</code>
          </div>
        )}
      </div>

      {/* Cited RAG Chunks */}
      {data.cited_chunks && data.cited_chunks.length > 0 && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '0.75rem' }}>
          <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Cited Knowledge Sources (RAG):</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {data.cited_chunks.map((chunk, idx) => (
              <div key={idx} style={{ padding: '0.5rem', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.8rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                  📄 {chunk.document_title || 'Document'} {chunk.chunk_index !== undefined ? `(Chunk #${chunk.chunk_index})` : ''}
                  {chunk.score && ` - Match: ${(chunk.score * 100).toFixed(1)}%`}
                </div>
                <div style={{ color: '#444' }}>{chunk.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
