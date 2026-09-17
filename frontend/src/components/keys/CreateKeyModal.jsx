import React, { useState } from 'react';

export const CreateKeyModal = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState('write'); // Default to write per §11.2
  const [rateLimitOverride, setRateLimitOverride] = useState('');
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Key name is required.');
      return;
    }

    try {
      await onSubmit({
        name: name.trim(),
        permissions,
        rate_limit_override: rateLimitOverride ? parseInt(rateLimitOverride, 10) : null,
      });
      setName('');
      setPermissions('write');
      setRateLimitOverride('');
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to create key.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 style={{ marginBottom: '1rem' }}>Create New API Key</h3>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="key-name">Key Name / Description</label>
            <input
              id="key-name"
              type="text"
              placeholder="e.g. Production Backend, CI Pipeline"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="key-perm">Permissions Level</label>
            <select
              id="key-perm"
              value={permissions}
              onChange={(e) => setPermissions(e.target.value)}
            >
              <option value="write">Write (Standard - Run AI Queries & Access Features)</option>
              <option value="read">Read Only (Read metadata, no AI generation)</option>
              <option value="admin">Admin (Full access to keys & org)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="rate-limit">Optional Rate Limit Override (RPM)</label>
            <input
              id="rate-limit"
              type="number"
              min={1}
              placeholder="Leave blank to use plan limit"
              value={rateLimitOverride}
              onChange={(e) => setRateLimitOverride(e.target.value)}
            />
            <span style={{ fontSize: '0.75rem', color: '#666' }}>
              Override requests per minute for this specific key (must be lower than or equal to plan limit).
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button type="button" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Generate API Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
