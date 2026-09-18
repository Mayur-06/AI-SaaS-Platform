import { create } from 'zustand';
import { orgService } from '../services/orgService';

export const useOrgStore = create((set, get) => ({
  organization: null,
  members: [],
  invitations: [],
  isLoading: false,
  error: null,

  fetchOrg: async () => {
    set({ isLoading: true, error: null });
    try {
      const org = await orgService.getOrg();
      set({ organization: org, isLoading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch organization', isLoading: false });
    }
  },

  fetchMembers: async () => {
    try {
      const members = await orgService.getMembers();
      set({ members });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch members' });
    }
  },

  fetchInvitations: async () => {
    try {
      const invitations = await orgService.getInvitations();
      set({ invitations });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch invitations' });
    }
  },

  updateOrg: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await orgService.updateOrg(data);
      set({ organization: updated, isLoading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to update organization', isLoading: false });
      throw err;
    }
  },

  updateMemberRole: async (memberId, role) => {
    await orgService.updateMemberRole(memberId, role);
    await get().fetchMembers();
  },

  removeMember: async (memberId) => {
    await orgService.removeMember(memberId);
    await get().fetchMembers();
  },

  inviteMember: async (email, role) => {
    const res = await orgService.inviteMember({ email, role });
    await get().fetchInvitations();
    return res;
  },

  revokeInvitation: async (invitationId) => {
    await orgService.revokeInvitation(invitationId);
    await get().fetchInvitations();
  },

  transferOwnership: async (newOwnerId) => {
    await orgService.transferOwnership(newOwnerId);
    await get().fetchMembers();
    await get().fetchOrg();
  },

  deleteOrg: async () => {
    await orgService.deleteOrg();
    set({ organization: null, members: [], invitations: [] });
  },
}));
