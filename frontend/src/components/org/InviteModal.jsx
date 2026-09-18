import React, { useState } from 'react';
import { extractErrorMessage } from '../../services/api';

export const InviteModal = ({
  isOpen,
  onClose,
  onInvite,
  isLoading,
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [error, setError] = useState(null);
  const [createdInvite, setCreatedInvite] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setError(null);
    try {
      const res = await onInvite(email.trim(), role);
      const token = res.raw_token || res.token || res.invitation?.token || '';
      const inviteUrl = token
        ? `${window.location.origin}/register?invite_token=${token}`
        : '';

      setCreatedInvite({
        token,
        email: email.trim(),
        role,
        inviteUrl,
      });
      setEmail('');
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setError(message || 'Failed to send invitation.');
    }
  };

  const handleClose = () => {
    setCreatedInvite(null);
    setError(null);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 style={{ marginBottom: '1rem' }}>Invite Member to Organization</h3>

        {error && <div className="alert alert-error">{error}</div>}

        {createdInvite ? (
          <div>
            <div className="alert alert-success">
              Invitation created for <strong>{createdInvite.email}</strong> as <strong>{createdInvite.role}</strong>!
            </div>

            {createdInvite.token && (
              <div style={{ margin: '1rem 0' }}>
                <label>Invitation Link (Invite Token)</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input
                    type="text"
                    readOnly
                    value={createdInvite.inviteUrl || createdInvite.token}
                    style={{ fontSize: '0.8rem', background: '#f5f5f5' }}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(createdInvite.inviteUrl || createdInvite.token || '');
                      alert('Copied invitation link to clipboard!');
                    }}
                  >
                    Copy
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                  The invited user can open this link to register and automatically join this organization.
                </p>
              </div>
            )}

            <div style={{ textAlign: 'right', marginTop: '1rem' }}>
              <button onClick={handleClose} className="btn-primary">
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="invite-email">User Email</label>
              <input
                id="invite-email"
                type="email"
                required
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="invite-role">Assigned Role</label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="admin">Admin (Manage members & billing)</option>
                <option value="member">Member (Can run AI queries)</option>
                <option value="viewer">Viewer (Read-only access)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button type="button" onClick={handleClose} disabled={isLoading}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={isLoading}>
                {isLoading ? 'Creating Invite...' : 'Send Invitation'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
