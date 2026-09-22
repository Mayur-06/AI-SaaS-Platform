import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { extractErrorMessage } from '../../services/api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../ui/Select';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '../ui/AlertDialog';

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
  const [error, setError] = useState(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  useEffect(() => {
    if (!selectedUserId && eligibleMembers.length > 0) {
      setSelectedUserId(getMemberUserId(eligibleMembers[0]) || '');
    }
  }, [eligibleMembers, selectedUserId]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsConfirmOpen(false);
      if (eligibleMembers.length > 0) {
        setSelectedUserId(getMemberUserId(eligibleMembers[0]) || '');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedEmail = eligibleMembers.find(
    (m) => getMemberUserId(m) === selectedUserId
  );
  const selectedEmailStr = selectedEmail ? getMemberEmail(selectedEmail) : '';

  const handleInitiateTransfer = (e) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError('Please select a member to receive organization ownership.');
      return;
    }
    setError(null);
    setIsConfirmOpen(true);
  };

  const handleConfirmTransfer = async () => {
    try {
      await onTransfer(selectedUserId);
      setIsConfirmOpen(false);
      onClose();
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setError(message || 'Transfer failed.');
      setIsConfirmOpen(false);
    }
  };

  return (
    <>
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
              <strong className="font-bold">Irreversible Action:</strong> By proceeding, you transfer primary legal ownership of this tenant. Your role will be transitioned to <span className="font-mono uppercase font-bold">VIEWER</span>.
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
            <form onSubmit={handleInitiateTransfer} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#292929] font-mono">
                  Select New Primary Owner
                </label>
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                  disabled={isLoading}
                >
                  <SelectTrigger className="h-10 text-sm w-full">
                    <SelectValue placeholder="Select a member…" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleMembers.map((m) => {
                      const uid = getMemberUserId(m);
                      return (
                        <SelectItem key={uid} value={uid}>
                          {getMemberEmail(m)} ({String(m.role).toUpperCase()})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
                  Cancel
                </Button>
                <Button type="submit" variant="danger" disabled={isLoading}>
                  Confirm Ownership Transfer →
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* Confirmation AlertDialog */}
      <AlertDialog open={isConfirmOpen} onOpenChange={(open) => { if (!open) setIsConfirmOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer Ownership?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to transfer primary ownership to{' '}
              <strong>{selectedEmailStr}</strong>. Your role will become <strong>Viewer</strong> immediately.
              This <strong className="text-red-600">cannot be undone by you</strong> after transfer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsConfirmOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="danger" onClick={handleConfirmTransfer} disabled={isLoading}>
              {isLoading ? 'Transferring…' : 'Yes, transfer ownership'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
