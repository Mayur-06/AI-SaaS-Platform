import { apiClient } from './api';

export const billingService = {
  async getPlan() {
    const response = await apiClient.get('/billing/plan/');
    return response.data;
  },

  async upgradePlan(planId) {
    const response = await apiClient.post('/billing/upgrade/', {
      plan_id: planId,
    });
    return response.data;
  },

  async getUsage() {
    const response = await apiClient.get('/billing/usage/');
    return response.data;
  },

  async getInvoices(page = 1) {
    const response = await apiClient.get('/billing/invoices/', {
      params: { page },
    });
    return response.data;
  },

  async downloadUsageCsv() {
    const response = await apiClient.get('/billing/usage/export/', {
      params: { format: 'csv' },
      responseType: 'blob',
    });
    return response.data;
  },

  async getUsageJson() {
    const response = await apiClient.get('/billing/usage/export/', {
      params: { format: 'json' },
    });
    return response.data;
  },

  async getKeys(page = 1) {
    const response = await apiClient.get('/keys/', {
      params: { page },
    });
    return response.data;
  },

  async createKey(payload) {
    const response = await apiClient.post('/keys/', payload);
    return response.data;
  },

  async updateKey(id, payload) {
    const response = await apiClient.patch(`/keys/${id}/`, payload);
    return response.data;
  },

  async regenerateKey(id) {
    const response = await apiClient.post(`/keys/${id}/regenerate/`);
    return response.data;
  },

  async revokeKey(id) {
    const response = await apiClient.delete(`/keys/${id}/`);
    return response.data;
  },
};
