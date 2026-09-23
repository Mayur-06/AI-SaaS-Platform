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
      });
      setName('');
      setPermissions('write');
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
              <SelectItem value="write">Full Access (RAG Query &amp; Ingestion)</SelectItem>
              <SelectItem value="rag:query">RAG Query Only (rag:query)</SelectItem>
              <SelectItem value="documents:write">Ingestion Only (documents:write)</SelectItem>
              <SelectItem value="documents:read">Documents Read Only (documents:read)</SelectItem>
              <SelectItem value="admin">Admin Full Control (admin:*)</SelectItem>
            </SelectContent>
          </Select>
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
