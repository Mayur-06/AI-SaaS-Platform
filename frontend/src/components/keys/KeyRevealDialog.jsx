import React, { useState } from 'react';

export const KeyRevealDialog = ({ fullKey, keyName, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const curlExample = `curl -X POST http://localhost:8000/api/ai/query/ \\
  -H "Authorization: Bearer ${fullKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Hello AI SaaS!"}'`;

  const pythonExample = `import requests

url = "http://localhost:8000/api/ai/query/"
headers = {
    "Authorization": "Bearer ${fullKey}",
    "Content-Type": "application/json"
}
payload = {"prompt": "Hello AI SaaS!"}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '650px' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>🔑 API Key Generated</h3>

        <div className="alert alert-warning" style={{ margin: '0.75rem 0' }}>
          <strong>Important:</strong> Please copy this key now. For security reasons, it will <strong>never be shown again</strong>. Only the prefix is stored.
        </div>

        <div className="form-group">
          <label>Key Name: <strong>{keyName}</strong></label>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <input
              type="text"
              readOnly
              value={fullKey}
              style={{ fontFamily: 'monospace', fontWeight: 'bold', background: '#f5f5f5' }}
            />
            <button onClick={handleCopy} className="btn-primary">
              {copied ? 'Copied! ✓' : 'Copy'}
            </button>
          </div>
        </div>

        <div style={{ marginTop: '1rem', borderTop: '1px solid #ccc', paddingTop: '0.75rem' }}>
          <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Usage Example (cURL):</h4>
          <pre style={{ background: '#222', color: '#eee', padding: '0.75rem', borderRadius: '4px', fontSize: '0.75rem', overflowX: 'auto' }}>
            {curlExample}
          </pre>
        </div>

        <div style={{ marginTop: '0.75rem' }}>
          <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Usage Example (Python):</h4>
          <pre style={{ background: '#222', color: '#eee', padding: '0.75rem', borderRadius: '4px', fontSize: '0.75rem', overflowX: 'auto' }}>
            {pythonExample}
          </pre>
        </div>

        <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
          <button onClick={onClose} className="btn-primary">
            I Have Saved This Key
          </button>
        </div>
      </div>
    </div>
  );
};
