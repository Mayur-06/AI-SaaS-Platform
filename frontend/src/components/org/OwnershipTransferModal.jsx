import React, { useState, useEffect } from 'react';
import { AlertTriangle, UserCheck } from 'lucide-react';
import { extractErrorMessage } from '../../services/api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

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

  useEffect(() => {
    if (!selectedUserId && eligibleMembers.length > 0) {
      setSelectedUserId(getMemberUserId(eligibleMembers[0]) || '');
    }
  }, [eligibleMembers, selectedUserId]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (eligibleMembers.length > 0) {
        setSelectedUserId(getMemberUserId(eligibleMembers[0]) || '');
      }
    }
  }, [isOpen]);

  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError('Please select a member to receive organization ownership.');
      return;
    }

    if (
      !confirm(
        'Warning: You will surrender primary owner privileges and become an Admin. This action cannot be undone by you. Do you wish to continue?'
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
    <Modal isOpen={isOpen} onClose={onClose} title="Transfer Organization Ownership" maxWidth="md">
      <div className="space-y-4 text-left">
        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}

        {/* Warning banner */}
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold">Irreversible Action:</strong> By proceeding, you transfer primary legal ownership of this tenant. Your role will be transitioned to <span className="font-mono uppercase font-bold">ADMIN</span>.
          </div>
        </div>

        {eligibleMembers.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-xs text-gray-500 italic mb-4">
              No other eligible members exist in this organization. Invite at least one additional member before initiating an ownership transfer.
            </p>
            <Button variant="secondary" onClick={onClose} className="w-full">
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="new-owner"
                className="text-xs font-semibold uppercase tracking-wider text-[#292929] font-mono"
              >
                Select New Primary Owner
              </label>
              <div className="relative">
                <select
                  id="new-owner"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-[#292929] focus:outline-none focus:ring-2 focus:ring-red-500 appearance-none cursor-pointer"
                >
                  {eligibleMembers.map((m) => {
                    const uid = getMemberUserId(m);
                    return (
                      <option key={uid} value={uid}>
                        {getMemberEmail(m)} ({String(m.role).toUpperCase()})
                      </option>
                    );
                  })}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 text-xs">
                  ▼
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
              <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" disabled={isLoading}>
                {isLoading ? 'Transferring…' : 'Confirm Ownership Transfer →'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
