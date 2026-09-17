import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { billingService } from '../../services/billingService';
import { useAuthStore } from '../../store/authStore';
import { KeyList } from '../../components/keys/KeyList';
import { CreateKeyModal } from '../../components/keys/CreateKeyModal';
import { KeyRevealDialog } from '../../components/keys/KeyRevealDialog';
import { extractErrorMessage } from '../../services/api';

export const APIKeysPage = () => {
  const { role, user, organization } = useAuthStore();
  const [keys, setKeys] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Modal and dialog states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [revealedKey, setRevealedKey] = useState(null);

  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const canManage = role === 'owner' || role === 'admin';

  const fetchKeys = async (page = currentPage) => {
    setIsLoading(true);
    try {
      const res = await billingService.getKeys(page);
      setKeys(res.results || []);
      setTotalCount(res.count || 0);
      setCurrentPage(page);
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setError(`Failed to load keys: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (organization || !user?.is_staff) {
      fetchKeys(1);
    }
  }, [organization, user]);

  const handleCreateKey = async (data) => {
    setIsLoading(true);
    setError(null);
    try {
      const newKey = await billingService.createKey(data);
      setIsCreateModalOpen(false);
      await fetchKeys(1);

      if (newKey.full_key) {
        setRevealedKey({
          fullKey: newKey.full_key,
          keyName: newKey.name,
        });
      } else {
        setMessage('API key created successfully.');
      }
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setError(`Failed to create key: ${message}`);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateKey = async (id) => {
    if (
      !confirm(
        'Are you sure you want to regenerate this key? The existing key will be immediately revoked and cannot be restored.'
      )
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const regenerated = await billingService.regenerateKey(id);
      await fetchKeys(currentPage);

      if (regenerated.full_key) {
        setRevealedKey({
          fullKey: regenerated.full_key,
          keyName: regenerated.name,
        });
      } else {
        setMessage('Key regenerated successfully.');
      }
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setError(`Regeneration failed: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeKey = async (id) => {
    if (!confirm('Immediately revoke this API key? Applications using it will lose access immediately.')) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await billingService.revokeKey(id);
      setMessage('API key revoked.');
      await fetchKeys(currentPage);
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setError(`Revocation failed: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateKey = async (id, name, permissions) => {
    setIsLoading(true);
    setError(null);
    try {
      await billingService.updateKey(id, { name, permissions });
      setMessage('API key updated.');
      await fetchKeys(currentPage);
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setError(`Update failed: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / 20) || 1;

  if (!organization && user?.is_staff) {
    return (
      <div className="card" style={{ maxWidth: '700px', margin: '2rem auto', textAlign: 'center', padding: '2rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>🔑 Tenant API Keys Management</h2>
        <p style={{ color: '#666', lineHeight: '1.5', marginBottom: '1.25rem' }}>
          API keys are scoped to individual tenant organizations. You are currently logged in as a <strong>Platform Superadmin</strong> without a tenant organization context.
        </p>
        <p style={{ color: '#666', lineHeight: '1.5', marginBottom: '1.5rem' }}>
          To inspect tenant fleets, infrastructure health, or configure model routing, visit the Superadmin Console.
        </p>
        <Link to="/admin" className="btn-primary" style={{ display: 'inline-block', padding: '0.6rem 1.2rem', textDecoration: 'none' }}>
          🛡️ Go to Platform Admin Panel
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 'bold' }}>API Keys Management</h1>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>
            Manage programmatic API credentials with custom permissions, rate limit overrides, and cryptographic security.
          </p>
        </div>

        {canManage && (
          <button onClick={() => setIsCreateModalOpen(true)} className="btn-primary">
            + Generate New Key
          </button>
        )}
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Key List */}
      <KeyList
        keys={keys}
        onRevoke={handleRevokeKey}
        onRegenerate={handleRegenerateKey}
        onUpdate={handleUpdateKey}
        isLoading={isLoading}
        canManage={canManage}
      />

      {/* Pagination */}
      <div className="pagination" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.85rem', color: '#666' }}>
          Page {currentPage} of {totalPages} ({totalCount} keys total)
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            disabled={currentPage <= 1 || isLoading}
            onClick={() => fetchKeys(currentPage - 1)}
            style={{ padding: '0.25rem 0.5rem' }}
          >
            Previous
          </button>
          <button
            disabled={currentPage >= totalPages || isLoading}
            onClick={() => fetchKeys(currentPage + 1)}
            style={{ padding: '0.25rem 0.5rem' }}
          >
            Next
          </button>
        </div>
      </div>

      {/* Create Modal */}
      <CreateKeyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateKey}
        isLoading={isLoading}
      />

      {/* One-Time Key Reveal Dialog */}
      {revealedKey && (
        <KeyRevealDialog
          fullKey={revealedKey.fullKey}
          keyName={revealedKey.keyName}
          onClose={() => setRevealedKey(null)}
        />
      )}
    </div>
  );
};
