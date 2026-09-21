import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../ui/Select';

export const CreateKeyModal = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState('write');
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
    <Modal isOpen={isOpen} onClose={onClose} title="Generate New API Key" maxWidth="md">
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <Input
          label="Key Identifier / Description"
          placeholder="e.g. Production Backend, CI/CD Pipeline, Staging Server"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isLoading}
        />

        <div className="flex flex-col gap-1.5">
          <label
            className="text-xs font-semibold uppercase tracking-wider text-[#292929] font-mono"
          >
            Permissions Scope
          </label>
          <Select value={permissions} onValueChange={setPermissions} disabled={isLoading}>
            <SelectTrigger className="w-full h-10">
              <SelectValue placeholder="Select permissions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="write">Write (Standard — Query AI endpoints & use RAG)</SelectItem>
              <SelectItem value="read">Read Only (Telemetry and metadata inspection)</SelectItem>
              <SelectItem value="admin">Admin (Full administrative credentials)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="rate-limit"
            className="text-xs font-semibold uppercase tracking-wider text-[#292929] font-mono"
          >
            Rate Limit Override (Optional RPM)
          </label>
          <input
            id="rate-limit"
            type="number"
            min={1}
            placeholder="Leave empty to inherit organization plan limit"
            value={rateLimitOverride}
            onChange={(e) => setRateLimitOverride(e.target.value)}
            disabled={isLoading}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-[#292929] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#b2c147]"
          />
          <span className="text-[11px] text-gray-500">
            Override maximum requests per minute for this specific key (capped by your plan).
          </span>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Generating…' : 'Generate API Key →'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
