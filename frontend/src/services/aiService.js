import { apiClient } from './api';

export const aiService = {
  async queryAI(prompt, model) {
    const response = await apiClient.post('/ai/query/', {
      prompt,
      question: prompt,
      model,
    });

    // Extract headers
    const requestId = response.headers['x-request-id'] || response.data.request_id;
    const usageWarning = response.headers['x-usage-warning'] || null;

    return {
      ...response.data,
      response: response.data.response || response.data.answer,
      model_used: response.data.model_used || response.data.model,
      tokens: response.data.tokens || {
        prompt_tokens: response.data.input_tokens || 0,
        completion_tokens: response.data.output_tokens || 0,
        total_tokens: (response.data.input_tokens || 0) + (response.data.output_tokens || 0),
      },
      request_id: requestId,
      usage_warning: usageWarning,
    };
  },

  async getDocuments(page = 1) {
    const response = await apiClient.get('/ai/documents/', {
      params: { page },
    });
    return response.data;
  },

  async createDocument(data) {
    if (data.file) {
      const formData = new FormData();
      formData.append('filename', data.file.name);
      formData.append('title', data.title || data.file.name);
      formData.append('file', data.file);
      if (data.content) formData.append('content', data.content);

      const response = await apiClient.post('/ai/documents/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    }

    const response = await apiClient.post('/ai/documents/', {
      filename: data.title,
      title: data.title,
      content: data.content || '',
    });
    return response.data;
  },

  async processDocument(id, content) {
    const response = await apiClient.post(`/ai/documents/${id}/process/`, content ? { content } : {});
    return response.data;
  },

  async reprocessDocument(id) {
    const response = await apiClient.post(`/ai/documents/${id}/reprocess/`);
    return response.data;
  },

  async deleteDocument(id) {
    await apiClient.delete(`/ai/documents/${id}/`);
  },

  async getHistory(params) {
    const response = await apiClient.get('/ai/history/', {
      params: {
        limit: params?.limit || 10,
        sort: params?.sort || 'date',
        page: params?.page || 1,
        ordering: params?.ordering || '-created_at',
      },
    });
    return response.data;
  },

  async getCacheStats() {
    const response = await apiClient.get('/cache/stats/');
    return response.data;
  },

  async clearCache() {
    const response = await apiClient.delete('/cache/clear/');
    return response.data;
  },

  async getCacheThreshold() {
    const response = await apiClient.get('/cache/threshold/');
    return response.data;
  },

  async updateCacheThreshold(threshold) {
    const response = await apiClient.patch('/cache/threshold/', {
      threshold,
    });
    return response.data;
  },
};
