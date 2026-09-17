import React from 'react';

export const RoutingConfig = () => {
  return (
    <div className="card">
      <div className="card-header">
        <h3>Model Routing & Fallback Configuration</h3>
      </div>

      <p style={{ fontSize: '0.9rem', color: '#555', marginBottom: '1rem' }}>
        Dynamic model routing routes queries based on the organization's active plan. Each tier has ordered fallback chains and a layered circuit breaker to guarantee high reliability.
      </p>

      <table>
        <thead>
          <tr>
            <th>Plan Tier</th>
            <th>Primary Model</th>
            <th>Fallback Sequence</th>
            <th>Timeout</th>
            <th>Circuit Breaker</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Free</strong></td>
            <td><code>gemini-2.5-flash</code></td>
            <td><span style={{ color: '#888' }}>None (Free tier bounded)</span></td>
            <td>10 seconds</td>
            <td>Active (skip on 3 consecutive errors)</td>
          </tr>
          <tr>
            <td><strong>Pro</strong></td>
            <td><code>gpt-4o-mini</code></td>
            <td><code>gemini-2.5-flash</code></td>
            <td>10 seconds</td>
            <td>Active (skip on 3 consecutive errors)</td>
          </tr>
          <tr>
            <td><strong>Enterprise</strong></td>
            <td><code>gpt-4</code></td>
            <td><code>gpt-4o-mini</code> → <code>gemini-2.5-flash</code></td>
            <td>10 seconds</td>
            <td>Active (skip on 3 consecutive errors)</td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fafafa', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem' }}>
        <strong>Reliability Architecture (Fix #3):</strong>
        <p style={{ marginTop: '0.25rem', color: '#555' }}>
          When an LLM provider fails or times out (10s), the system logs the fallback event and triggers the next model in the tier's chain. Repeated failures trip the circuit breaker, skipping the degraded provider on subsequent calls to avoid latency penalties.
        </p>
      </div>
    </div>
  );
};
