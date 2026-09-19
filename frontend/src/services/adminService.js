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

  async updateRoutingRule(planName, data) {
    const response = await apiClient.post('/admin/routing/', {
      plan_name: planName,
      ...data,
    });
    return response.data;
  },

  async testRoutingCascade(planName, options = {}) {
    const response = await apiClient.post('/admin/routing/', {
      action: 'test',
      plan_name: planName,
      ...options,
    });
    return response.data;
  },

  async resetRoutingRule(planName) {
    const response = await apiClient.post('/admin/routing/', {
      action: 'reset',
      plan_name: planName,
    });
    return response.data;
  },

  async resetCircuitBreakers(modelKey = null) {
    const response = await apiClient.post('/admin/routing/', {
      action: 'reset_circuit_breaker',
      model_key: modelKey,
    });
    return response.data;
  },
};
