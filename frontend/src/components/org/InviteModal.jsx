import React, { useState } from 'react';
import { Copy, Check, Mail, CheckCircle2 } from 'lucide-react';
import { extractErrorMessage } from '../../services/api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

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
  const [copied, setCopied] = useState(false);

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
      setError(message || 'Failed to dispatch invitation.');
    }
  };

  const handleCopy = () => {
    if (!createdInvite?.inviteUrl) return;
    navigator.clipboard.writeText(createdInvite.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setCreatedInvite(null);
    setError(null);
    setCopied(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Invite Member to Organization" maxWidth="md">
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      {createdInvite ? (
        <div className="space-y-4 text-left">
          <div className="px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-800 text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-600 shrink-0" />
            <span>
              Invitation generated for <strong>{createdInvite.email}</strong> with role{' '}
              <strong className="uppercase font-mono">{createdInvite.role}</strong>!
            </span>
          </div>

          {createdInvite.token && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#292929] font-mono">
                Invitation Onboarding Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdInvite.inviteUrl}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-[#292929] font-mono text-xs select-all"
                />
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 shrink-0"
                >
                  {copied ? <Check size={14} className="text-[#292929]" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>
              <p className="text-[11px] text-gray-500">
                Share this secure registration link with your colleague. Once completed, they will automatically join this organization.
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <Button variant="dark" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <Input
            label="User Email Address"
            type="email"
            placeholder="colleague@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="invite-role"
              className="text-xs font-semibold uppercase tracking-wider text-[#292929] font-mono"
            >
              Assigned Organization Role
            </label>
            <div className="relative">
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={isLoading}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-[#292929] focus:outline-none focus:ring-2 focus:ring-[#b2c147] appearance-none cursor-pointer"
              >
                <option value="admin">Admin (Manage members, keys & billing)</option>
                <option value="member">Member (Can run AI queries & index docs)</option>
                <option value="viewer">Viewer (Read-only access)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 text-xs">
                ▼
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading || !email.trim()}>
              {isLoading ? 'Creating Invite…' : 'Send Invitation →'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
