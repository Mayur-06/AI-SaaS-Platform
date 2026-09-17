import React, { useEffect, useState } from 'react';
import { useOrgStore } from '../../store/orgStore';
import { useAuthStore } from '../../store/authStore';
import { MemberList } from '../../components/org/MemberList';
import { InviteModal } from '../../components/org/InviteModal';
import { OwnershipTransferModal } from '../../components/org/OwnershipTransferModal';
import { extractErrorMessage } from '../../services/api';
import { useNavigate, Link } from 'react-router-dom';

export const OrganizationSettingsPage = () => {
  const { user, role, logout } = useAuthStore();
  const {
    organization,
    members,
    fetchOrg,
    fetchMembers,
    updateOrg,
    updateMemberRole,
    removeMember,
    inviteMember,
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

  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const isOwner = role === 'owner';
  const canManage = role === 'owner' || role === 'admin';

  useEffect(() => {
    fetchOrg();
    fetchMembers();
  }, [fetchOrg, fetchMembers]);

  useEffect(() => {
    if (organization) {
      setOrgName(organization.name || '');
      setBudget(organization.monthly_budget ?? 100);
      setThreshold(organization.budget_alert_threshold ?? 80);
    }
  }, [organization]);

  const handleUpdateOrg = async (e) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await updateOrg({
        name: orgName,
        monthly_budget: Number(budget),
        budget_alert_threshold: Number(threshold),
      });
      setSuccessMsg('Organization profile and budget preferences updated.');
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setErrorMsg(`Update failed: ${message}`);
    }
  };

  const handleDeleteOrg = async () => {
    if (
      !confirm(
        'CRITICAL WARNING: This will deactivate this organization and immediately disable access for all members. Continue?'
      )
    ) {
      return;
    }

    try {
      await deleteOrg();
      alert('Organization has been deactivated.');
      logout();
      navigate('/login');
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setErrorMsg(`Failed to delete organization: ${message}`);
    }
  };

  if (!organization && user?.is_staff) {
    return (
      <div className="card" style={{ maxWidth: '700px', margin: '2rem auto', textAlign: 'center', padding: '2rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>⚙️ Tenant Organization Settings</h2>
        <p style={{ color: '#666', lineHeight: '1.5', marginBottom: '1.25rem' }}>
          Organization profile, team invitations, and budget limits are scoped to tenant accounts. You are currently logged in as a <strong>Platform Superadmin</strong> without a tenant organization context.
        </p>
        <p style={{ color: '#666', lineHeight: '1.5', marginBottom: '1.5rem' }}>
          To manage all registered tenant organizations, view platform economics, or configure routing rules, visit the Superadmin Console.
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
          <h1 style={{ fontSize: '1.6rem', fontWeight: 'bold' }}>Organization Settings</h1>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>
            Manage organization identity, team access permissions, member invitations, and organization lifecycle.
          </p>
        </div>

        {canManage && (
          <button onClick={() => setIsInviteOpen(true)} className="btn-primary">
            + Invite Team Member
          </button>
        )}
      </div>

      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      {errorMsg && <div className="alert alert-error">{errorMsg}</div>}

      {/* Organization Details Form */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h3>General Organization Profile</h3>
        </div>

        <form onSubmit={handleUpdateOrg}>
          <div className="grid-2">
            <div className="form-group">
              <label htmlFor="org-name-input">Organization Name</label>
              <input
                id="org-name-input"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={!canManage || isLoading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="org-slug-input">Tenant Slug (Identifier)</label>
              <input
                id="org-slug-input"
                type="text"
                readOnly
                value={organization?.slug || ''}
                style={{ background: '#f5f5f5' }}
              />
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: '0.5rem' }}>
            <div className="form-group">
              <label htmlFor="org-budget-input">Monthly Cost Budget ($ USD)</label>
              <input
                id="org-budget-input"
                type="number"
                min={0}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                disabled={!canManage || isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="org-thresh-input">Budget Alert Threshold (%)</label>
              <input
                id="org-thresh-input"
                type="number"
                min={1}
                max={100}
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                disabled={!canManage || isLoading}
              />
            </div>
          </div>

          {canManage && (
            <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem' }} disabled={isLoading}>
              Save Changes
            </button>
          )}
        </form>
      </div>

      {/* Member Management */}
      <div style={{ marginBottom: '1.5rem' }}>
        <MemberList
          members={members}
          currentUserId={user?.id}
          currentUserRole={role}
          onUpdateRole={updateMemberRole}
          onRemoveMember={removeMember}
          isLoading={isLoading}
        />
      </div>

      {/* Ownership Transfer & Danger Zone */}
      {isOwner && (
        <div className="card" style={{ borderColor: '#ffa39e', marginBottom: '1.5rem' }}>
          <div className="card-header" style={{ color: '#a8071a' }}>
            <h3>Danger Zone (Owner Actions)</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>Transfer Organization Ownership</strong>
                <p style={{ fontSize: '0.8rem', color: '#666' }}>
                  Assign another team member as the primary organization owner.
                </p>
              </div>
              <button onClick={() => setIsTransferOpen(true)}>
                Transfer Ownership
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
              <div>
                <strong style={{ color: '#a8071a' }}>Deactivate Organization</strong>
                <p style={{ fontSize: '0.8rem', color: '#666' }}>
                  Soft-delete this organization and immediately revoke member access.
                </p>
              </div>
              <button onClick={handleDeleteOrg} className="btn-danger">
                Deactivate Organization
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => {
          setIsInviteOpen(false);
          fetchMembers();
        }}
        onInvite={inviteMember}
        isLoading={isLoading}
      />

      {/* Ownership Transfer Modal */}
      <OwnershipTransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        members={members}
        currentUserId={user?.id}
        onTransfer={transferOwnership}
        isLoading={isLoading}
      />
    </div>
  );
};
