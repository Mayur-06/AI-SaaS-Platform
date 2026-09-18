import React, { useState } from 'react';
import { extractErrorMessage } from '../../services/api';

export const OwnershipTransferModal = ({
  isOpen,
  onClose,
  members,
  currentUserId,
  onTransfer,
  isLoading,
}) => {
  const getMemberUserId = (m) => m?.user?.id || m?.user_id;
  const getMemberEmail = (m) => m?.user?.email || m?.user_email || 'Member';

  const eligibleMembers = (members || []).filter(
    (m) => m && getMemberUserId(m) && getMemberUserId(m) !== currentUserId && m?.role !== 'owner'
  );
  const [selectedUserId, setSelectedUserId] = useState(
    eligibleMembers.length > 0 ? getMemberUserId(eligibleMembers[0]) || '' : ''
  );

  React.useEffect(() => {
    if (!selectedUserId && eligibleMembers.length > 0) {
      setSelectedUserId(getMemberUserId(eligibleMembers[0]) || '');
    }
  }, [eligibleMembers, selectedUserId]);

  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError('Please select a member to transfer ownership to.');
      return;
    }

    if (
      !confirm(
        'Warning: You will surrender primary owner permissions and become an Admin. This action cannot be undone by you. Continue?'
      )
    ) {
      return;
    }

    try {
      await onTransfer(selectedUserId);
      onClose();
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setError(message || 'Transfer failed.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 style={{ marginBottom: '1rem', color: '#900' }}>⚠️ Transfer Organization Ownership</h3>

        {error && <div className="alert alert-error">{error}</div>}

        <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
          Select an active team member within your organization to receive primary ownership.
        </p>

        {eligibleMembers.length === 0 ? (
          <div>
            <p style={{ color: '#777', fontStyle: 'italic', marginBottom: '1rem' }}>
              No other members exist in this organization. Invite at least one other member before transferring ownership.
            </p>
            <div style={{ textAlign: 'right' }}>
              <button onClick={onClose}>Close</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="new-owner">New Organization Owner</label>
              <select
                id="new-owner"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                {eligibleMembers.map((m) => {
                  const uid = getMemberUserId(m);
                  return (
                    <option key={uid} value={uid}>
                      {getMemberEmail(m)} ({m.role})
                    </option>
                  );
                })}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button type="button" onClick={onClose} disabled={isLoading}>
                Cancel
              </button>
              <button type="submit" className="btn-danger" disabled={isLoading}>
                {isLoading ? 'Transferring...' : 'Confirm Transfer'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
