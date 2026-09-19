import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, ShieldAlert, Key, Lock } from 'lucide-react';
import { billingService } from '../../services/billingService';
import { useAuthStore } from '../../store/authStore';
import { KeyList } from '../../components/keys/KeyList';
import { CreateKeyModal } from '../../components/keys/CreateKeyModal';
import { KeyRevealDialog } from '../../components/keys/KeyRevealDialog';
import { extractErrorMessage } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '../../components/ui/AlertDialog';

export const APIKeysPage = () => {
  const { role, user, organization } = useAuthStore();
  const [keys, setKeys] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [revealedKey, setRevealedKey] = useState(null);

  // AlertDialog states
  const [pendingRevoke, setPendingRevoke] = useState(null);     // keyId
  const [pendingRegenerate, setPendingRegenerate] = useState(null); // keyId

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
      toast.error(`Failed to load keys: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canManage && (organization || !user?.is_staff)) {
      fetchKeys(1);
    }
  }, [organization, user, canManage]);

  const handleCreateKey = async (data) => {
    setIsLoading(true);
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
        toast.success('API key created successfully.');
      }
    } catch (err) {
      const { message } = extractErrorMessage(err);
      toast.error(`Failed to create key: ${message}`);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateKey = async () => {
    if (!pendingRegenerate) return;
    setIsLoading(true);
    try {
      const regenerated = await billingService.regenerateKey(pendingRegenerate);
      await fetchKeys(currentPage);

      if (regenerated.full_key) {
        setRevealedKey({
          fullKey: regenerated.full_key,
          keyName: regenerated.name,
        });
      } else {
        toast.success('Key regenerated successfully.');
      }
    } catch (err) {
      const { message } = extractErrorMessage(err);
      toast.error(`Regeneration failed: ${message}`);
    } finally {
      setIsLoading(false);
      setPendingRegenerate(null);
    }
  };

  const handleRevokeKey = async () => {
    if (!pendingRevoke) return;
    setIsLoading(true);
    try {
      await billingService.revokeKey(pendingRevoke);
      toast.success('API key revoked. Applications using it have lost access.');
      await fetchKeys(currentPage);
    } catch (err) {
      const { message } = extractErrorMessage(err);
      toast.error(`Revocation failed: ${message}`);
    } finally {
      setIsLoading(false);
      setPendingRevoke(null);
    }
  };

  const handleUpdateKey = async (id, name, permissions) => {
    setIsLoading(true);
    try {
      await billingService.updateKey(id, { name, permissions });
      toast.success('API key updated.');
      await fetchKeys(currentPage);
    } catch (err) {
      const { message } = extractErrorMessage(err);
      toast.error(`Update failed: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / 20) || 1;

  if (!organization && user?.is_staff) {
    return (
      <Card variant="bordered" className="max-w-xl mx-auto text-center py-12 px-6 shadow-sm space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center mx-auto">
          <ShieldAlert size={24} />
        </div>
        <h2
          style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
          className="text-2xl font-bold text-[#292929]"
        >
          Superadmin Console Mode
        </h2>
        <p className="text-xs text-gray-500 leading-relaxed max-w-md mx-auto">
          API keys are scoped to specific tenant organizations. You are currently logged in as a <strong>Platform Superadmin</strong> without an active tenant organization context.
        </p>
        <div className="pt-2">
          <Link to="/admin" className="no-underline">
            <Button variant="dark" size="md">
              Go to Superadmin Console →
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  if (!canManage) {
    return (
      <Card variant="bordered" className="max-w-xl mx-auto text-center py-12 px-6 shadow-sm space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
          <Lock size={24} />
        </div>
        <h2
          style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
          className="text-2xl font-bold text-[#292929]"
        >
          API Key Management Restricted
        </h2>
        <p className="text-xs text-gray-500 leading-relaxed max-w-md mx-auto">
          Programmatic API keys provide administrative access to organization endpoints. Your current role is <strong className="uppercase font-mono">{role || 'member'}</strong>. Key generation and secret inspection require Admin or Owner permissions.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100">
        <div>
          <h1
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-2xl sm:text-3xl font-extrabold text-[#292929] tracking-tight"
          >
            API Keys Management
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Generate and manage hashed secret credentials with organization-scoped rate limits.
          </p>
        </div>

        {canManage && (
          <Button
            variant="primary"
            size="md"
            onClick={() => setIsCreateModalOpen(true)}
            className="self-start sm:self-auto flex items-center gap-1.5"
          >
            <Plus size={16} />
            <span>Generate New Key</span>
          </Button>
        )}
      </div>

      {/* Key Table */}
      <KeyList
        keys={keys}
        onRevoke={(id) => setPendingRevoke(id)}
        onRegenerate={(id) => setPendingRegenerate(id)}
        onUpdate={handleUpdateKey}
        isLoading={isLoading}
        canManage={canManage}
      />

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-500">
        <span>
          Showing page <strong className="text-[#292929]">{currentPage}</strong> of{' '}
          <strong className="text-[#292929]">{totalPages}</strong> ({totalCount} keys total)
        </span>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={currentPage <= 1 || isLoading}
            onClick={() => fetchKeys(currentPage - 1)}
          >
            ← Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={currentPage >= totalPages || isLoading}
            onClick={() => fetchKeys(currentPage + 1)}
          >
            Next →
          </Button>
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

      {/* Revoke Confirm Dialog */}
      <AlertDialog open={Boolean(pendingRevoke)} onOpenChange={(open) => { if (!open) setPendingRevoke(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong className="text-red-600">immediately revoke</strong> this API key. Any application or script using it will lose access right away. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="danger" onClick={handleRevokeKey} disabled={isLoading}>
              {isLoading ? 'Revoking…' : 'Revoke key'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regenerate Confirm Dialog */}
      <AlertDialog open={Boolean(pendingRegenerate)} onOpenChange={(open) => { if (!open) setPendingRegenerate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              The existing secret will be <strong className="text-red-600">immediately invalidated</strong> and a new one will be generated. Update any integrations using the old key before closing the reveal dialog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="danger" onClick={handleRegenerateKey} disabled={isLoading}>
              {isLoading ? 'Regenerating…' : 'Regenerate key'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
