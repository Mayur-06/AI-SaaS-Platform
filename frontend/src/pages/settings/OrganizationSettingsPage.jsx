import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  UserPlus,
  ShieldAlert,
  Save,
  AlertOctagon,
  ArrowRightLeft,
  Trash2,
  Building2,
  Users,
  Mail,
} from 'lucide-react';
import { useOrgStore } from '../../store/orgStore';
import { useAuthStore } from '../../store/authStore';
import { MemberList } from '../../components/org/MemberList';
import { InvitationList } from '../../components/org/InvitationList';
import { InviteModal } from '../../components/org/InviteModal';
import { OwnershipTransferModal } from '../../components/org/OwnershipTransferModal';
import { extractErrorMessage } from '../../services/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '../../components/ui/AlertDialog';

export const OrganizationSettingsPage = () => {
  const { user, role, logout } = useAuthStore();
  const {
    organization,
    members,
    invitations,
    fetchOrg,
    fetchMembers,
    fetchInvitations,
    updateOrg,
    updateMemberRole,
    removeMember,
    inviteMember,
    revokeInvitation,
    transferOwnership,
    deleteOrg,
    isLoading,
  } = useOrgStore();

  const navigate = useNavigate();

  const [orgName, setOrgName] = useState('');
  const [budget, setBudget] = useState(100);
  const [threshold, setThreshold] = useState(80);

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);

  // AlertDialog state for org deletion
  const [isDeleteOrgDialogOpen, setIsDeleteOrgDialogOpen] = useState(false);

  const isOwner = role === 'owner';
  const canManage = role === 'owner' || role === 'admin';

  useEffect(() => {
    fetchOrg();
    fetchMembers();
    if (canManage) {
      fetchInvitations();
    }
  }, [fetchOrg, fetchMembers, fetchInvitations, canManage]);

  useEffect(() => {
    if (organization) {
      setOrgName(organization.name || '');
      setBudget(organization.monthly_budget ?? 100);
      setThreshold(organization.budget_alert_threshold ?? 80);
    }
  }, [organization]);

  const handleUpdateOrg = async (e) => {
    e.preventDefault();
    try {
      await updateOrg({
        name: orgName,
        monthly_budget: Number(budget),
        budget_alert_threshold: Number(threshold),
      });
      toast.success('Organization profile saved successfully.');
    } catch (err) {
      const { message } = extractErrorMessage(err);
      toast.error(`Update failed: ${message}`);
    }
  };

  const handleRemoveMember = async (memberId) => {
    try {
      await removeMember(memberId);
      toast.success('Member account has been permanently removed.');
    } catch (err) {
      const { message } = extractErrorMessage(err);
      toast.error(`Failed to remove member: ${message}`);
      throw err;
    }
  };

  const handleTransferOwnership = async (newOwnerId) => {
    try {
      await transferOwnership(newOwnerId);
      toast.success('Ownership successfully transferred. Your role is now Admin.');
    } catch (err) {
      const { message } = extractErrorMessage(err);
      toast.error(`Failed to transfer ownership: ${message}`);
      throw err;
    }
  };

  const handleDeleteOrg = async () => {
    try {
      await deleteOrg();
      toast.success('Organization deactivated and records cleaned up.');
      navigate('/login');
    } catch (err) {
      const { message } = extractErrorMessage(err);
      toast.error(`Failed to deactivate organization: ${message}`);
    }
  };

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
          Organization profiles, team access, and spend controls are scoped to tenant accounts. You are currently logged in as a <strong>Platform Superadmin</strong> without a tenant organization context.
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

  const pendingInvitesCount = (invitations || []).filter((i) => !i.accepted_at).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100">
        <div>
          <h1
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-2xl sm:text-3xl font-extrabold text-[#292929] tracking-tight"
          >
            Organization Settings
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Manage your organization identity, team roles, access invitations, and safety controls.
          </p>
        </div>

        {canManage && (
          <Button
            variant="primary"
            size="md"
            onClick={() => setIsInviteOpen(true)}
            className="self-start sm:self-auto flex items-center gap-1.5"
          >
            <UserPlus size={16} />
            <span>Invite Team Member</span>
          </Button>
        )}
      </div>

      {/* Tabs Layout */}
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="general" className="flex items-center gap-1.5">
            <Building2 size={13} />
            <span>Profile &amp; Budget</span>
          </TabsTrigger>
          <TabsTrigger value="members" className="flex items-center gap-1.5">
            <Users size={13} />
            <span>Members ({members?.length || 0})</span>
          </TabsTrigger>
          {canManage && (
            <TabsTrigger value="invitations" className="flex items-center gap-1.5">
              <Mail size={13} />
              <span>Invitations {pendingInvitesCount > 0 ? `(${pendingInvitesCount})` : ''}</span>
            </TabsTrigger>
          )}
          {isOwner && (
            <TabsTrigger value="danger" className="flex items-center gap-1.5 text-red-600 hover:text-red-700">
              <AlertOctagon size={13} />
              <span>Danger Zone</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab 1: General Profile & Budget */}
        <TabsContent value="general" className="space-y-6">
          <Card variant="bordered" className="shadow-sm space-y-5">
            <div className="pb-3 border-b border-gray-100">
              <h3
                style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
                className="text-lg font-bold text-[#292929] tracking-tight"
              >
                General Profile &amp; Spending Ceilings
              </h3>
              <p className="text-xs text-gray-500">
                Define tenant identity and configure monthly budget notifications
              </p>
            </div>

            <form onSubmit={handleUpdateOrg} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Organization Name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={!canManage || isLoading}
                  required
                />

                <Input
                  label="Tenant Slug (Unique Key)"
                  readOnly
                  value={organization?.slug || ''}
                  helperText="Auto-generated slug identifier for organization resources"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <Input
                  label="Monthly Spend Budget ($ USD)"
                  type="number"
                  min={0}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  disabled={!canManage || isLoading}
                  helperText="Target maximum monthly dollar spend across all LLM inference"
                />

                <Input
                  label="Budget Alert Threshold (%)"
                  type="number"
                  min={1}
                  max={100}
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  disabled={!canManage || isLoading}
                  helperText="Percentage of budget that triggers warning badges in the dashboard"
                />
              </div>

              {canManage && (
                <div className="pt-2">
                  <Button type="submit" variant="primary" size="md" disabled={isLoading} className="flex items-center gap-2">
                    <Save size={14} />
                    <span>Save Profile Changes</span>
                  </Button>
                </div>
              )}
            </form>
          </Card>
        </TabsContent>

        {/* Tab 2: Team Members */}
        <TabsContent value="members" className="space-y-4">
          <MemberList
            members={members}
            currentUserId={user?.id}
            currentUserRole={role}
            onUpdateRole={updateMemberRole}
            onRemoveMember={handleRemoveMember}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* Tab 3: Invitations */}
        {canManage && (
          <TabsContent value="invitations" className="space-y-4">
            <InvitationList
              invitations={invitations}
              canManage={canManage}
              onRevoke={revokeInvitation}
              isLoading={isLoading}
            />
          </TabsContent>
        )}

        {/* Tab 4: Danger Zone */}
        {isOwner && (
          <TabsContent value="danger" className="space-y-4">
            <Card variant="bordered" className="border-red-200 bg-red-50/20 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-red-200/80 text-red-800">
                <AlertOctagon size={18} className="text-red-600" />
                <h3
                  style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
                  className="text-lg font-bold tracking-tight"
                >
                  Danger Zone (Owner Privileges)
                </h3>
              </div>

              <div className="divide-y divide-red-100 text-xs">
                {/* Transfer Ownership Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3">
                  <div>
                    <strong className="text-[#292929] block text-sm">Transfer Primary Ownership</strong>
                    <p className="text-gray-500">
                      Assign another registered member to assume legal and administrative ownership of this organization.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsTransferOpen(true)}
                    className="self-start sm:self-auto flex items-center gap-1.5"
                  >
                    <ArrowRightLeft size={13} />
                    <span>Transfer Ownership</span>
                  </Button>
                </div>

                {/* Deactivate Organization Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
                  <div>
                    <strong className="text-red-700 block text-sm">Deactivate Organization</strong>
                    <p className="text-gray-500">
                      Immediately soft-delete this tenant, revoke all API credentials, and disable access for all members.
                    </p>
                  </div>
                  <AlertDialog open={isDeleteOrgDialogOpen} onOpenChange={setIsDeleteOrgDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="danger"
                        size="sm"
                        className="self-start sm:self-auto flex items-center gap-1.5"
                      >
                        <Trash2 size={13} />
                        <span>Deactivate Organization</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate Organization?</AlertDialogTitle>
                        <AlertDialogDescription>
                          <strong className="text-red-600">This action cannot be undone.</strong> This will immediately:
                          <ul className="mt-2 space-y-1 list-disc pl-4 text-gray-500">
                            <li>Soft-delete this organization</li>
                            <li>Revoke all active API credentials</li>
                            <li>Deactivate all member access</li>
                            <li>Remove all pending invitations</li>
                          </ul>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          variant="danger"
                          onClick={handleDeleteOrg}
                          disabled={isLoading}
                        >
                          {isLoading ? 'Deactivating…' : 'Yes, deactivate'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Modals */}
      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => {
          setIsInviteOpen(false);
          fetchMembers();
        }}
        onInvite={inviteMember}
        isLoading={isLoading}
      />

      <OwnershipTransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        members={members}
        currentUserId={user?.id}
        onTransfer={handleTransferOwnership}
        isLoading={isLoading}
      />
    </div>
  );
};
