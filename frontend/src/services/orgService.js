import { apiClient } from './api';

export const orgService = {
  async getOrg() {
    const response = await apiClient.get('/org/');
    return response.data;
  },

  async updateOrg(payload) {
    const response = await apiClient.put('/org/', payload);
    return response.data;
  },

  async deleteOrg() {
    const response = await apiClient.delete('/org/');
    return response.data;
  },

  async getMembers() {
    const response = await apiClient.get('/org/members/');
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return response.data?.results || [];
  },

  async updateMemberRole(memberId, role) {
    const response = await apiClient.patch(`/org/members/${memberId}/`, { role });
    return response.data;
  },

  async removeMember(memberId) {
    const response = await apiClient.delete(`/org/members/${memberId}/`);
    return response.data;
  },

  async inviteMember(payload) {
    const response = await apiClient.post('/org/invite/', payload);
    return response.data;
  },

  async getInvitations() {
    const response = await apiClient.get('/org/invite/');
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return response.data?.results || [];
  },

  async revokeInvitation(invitationId) {
    const response = await apiClient.delete(`/org/invite/${invitationId}/`);
    return response.data;
  },

  async transferOwnership(newOwnerId) {
    const response = await apiClient.post('/org/transfer-ownership/', {
      new_owner_id: newOwnerId,
    });
    return response.data;
  },
};
