import { apiClient } from './api';

export const adminService = {
  async getTenants(page = 1) {
    const response = await apiClient.get('/admin/tenants/', {
      params: { page },
    });
    return response.data;
  },

  async getMetrics() {
    const response = await apiClient.get('/admin/usage/');
    return response.data;
  },

  async getHealth() {
    const response = await apiClient.get('/admin/health/');
    return response.data;
  },

  async getPublicHealth() {
    const response = await apiClient.get('/health/');
    return response.data;
  },

  async getRouting() {
    const response = await apiClient.get('/admin/routing/');
    return response.data;
  },

  async updateRouting(data) {
    const response = await apiClient.post('/admin/routing/', data);
    return response.data;
  },
};
