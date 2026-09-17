import { apiClient, setAuthTokens, clearAuthTokens, USER_INFO_KEY, ORG_INFO_KEY, REMEMBER_ME_KEY } from './api';

export const authService = {
  async login(email, password, rememberMe = false) {
    const response = await apiClient.post('/auth/login/', {
      email,
      password,
    });

    const { access, refresh, user, organization } = response.data;
    setAuthTokens(access, refresh);
    localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
    localStorage.setItem(ORG_INFO_KEY, JSON.stringify(organization));
    if (rememberMe) {
      localStorage.setItem(REMEMBER_ME_KEY, 'true');
    } else {
      localStorage.removeItem(REMEMBER_ME_KEY);
    }

    return response.data;
  },

  async register(payload) {
    const response = await apiClient.post('/auth/register/', payload);
    const { tokens, user, organization } = response.data;
    if (tokens?.access) {
      setAuthTokens(tokens.access, tokens.refresh);
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
      localStorage.setItem(ORG_INFO_KEY, JSON.stringify(organization));
    }
    return response.data;
  },

  logout() {
    clearAuthTokens();
  },

  async requestPasswordReset(email) {
    const response = await apiClient.post('/auth/password-reset/', {
      email,
    });
    return response.data;
  },

  async confirmPasswordReset(token, new_password, confirm_password) {
    const response = await apiClient.post('/auth/password-reset/confirm/', {
      token,
      new_password,
      confirm_password: confirm_password || new_password,
    });
    return response.data;
  },

  async verifyEmail(token) {
    const response = await apiClient.get(`/auth/verify/${token}/`);
    return response.data;
  },

  getStoredUser() {
    try {
      const data = localStorage.getItem(USER_INFO_KEY);
      if (!data || data === 'undefined' || data === 'null') return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  getStoredOrg() {
    try {
      const data = localStorage.getItem(ORG_INFO_KEY);
      if (!data || data === 'undefined' || data === 'null') return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  },
};
