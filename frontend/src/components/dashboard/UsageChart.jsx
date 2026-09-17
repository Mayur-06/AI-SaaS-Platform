import React from 'react';

export const UsageChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h3>30-Day Usage Trend</h3>
        </div>
        <p style={{ color: '#777', fontSize: '0.9rem', fontStyle: 'italic' }}>
          No usage recorded in the last 30 days yet. Run queries from the AI Query page or dashboard widget.
        </p>
      </div>
    );
  }

  const maxRequests = Math.max(...data.map((d) => d.requests), 1);

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>30-Day Usage Trend</h3>
        <span style={{ fontSize: '0.85rem', color: '#666' }}>{data.length} active days</span>
      </div>

      {/* Bar graph representation */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '140px', padding: '10px 0', borderBottom: '1px solid #ccc' }}>
        {data.slice(-14).map((d) => {
          const heightPct = Math.max(8, Math.round((d.requests / maxRequests) * 100));
          return (
            <div
              key={d.date}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                justifyContent: 'flex-end',
              }}
              title={`${d.date}: ${d.requests} requests, $${d.cost}`}
            >
              <span style={{ fontSize: '0.7rem', marginBottom: '2px' }}>{d.requests}</span>
              <div
                style={{
                  width: '100%',
                  height: `${heightPct}%`,
                  background: '#555',
                  borderRadius: '2px 2px 0 0',
                }}
              />
              <span style={{ fontSize: '0.65rem', marginTop: '4px', whiteSpace: 'nowrap' }}>
                {d.date.slice(5)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Data table */}
      <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '1rem' }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Requests</th>
              <th>Tokens</th>
              <th>Estimated Cost</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.date}>
                <td>{row.date}</td>
                <td>{row.requests}</td>
                <td>{row.tokens.toLocaleString()}</td>
                <td>${Number(row.cost).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
