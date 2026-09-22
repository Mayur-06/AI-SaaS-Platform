import {
  apiClient,
  setAuthTokens,
  clearAuthTokens,
  USER_INFO_KEY,
  ORG_INFO_KEY,
  REMEMBER_ME_KEY,
  REMEMBERED_EMAIL_KEY,
} from './api';

export const authService = {
  async login(email, password, rememberMe = false) {
    const response = await apiClient.post('/auth/login/', {
      email,
      password,
    });

    const { access, refresh, user, organization } = response.data;
    setAuthTokens(access, refresh, rememberMe);

    if (rememberMe) {
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
      localStorage.setItem(ORG_INFO_KEY, JSON.stringify(organization));
      localStorage.setItem(REMEMBER_ME_KEY, 'true');
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
      sessionStorage.removeItem(USER_INFO_KEY);
      sessionStorage.removeItem(ORG_INFO_KEY);
    } else {
      sessionStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
      sessionStorage.setItem(ORG_INFO_KEY, JSON.stringify(organization));
      localStorage.removeItem(USER_INFO_KEY);
      localStorage.removeItem(ORG_INFO_KEY);
      localStorage.removeItem(REMEMBER_ME_KEY);
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }

    return response.data;
  },

  async register(payload) {
    const response = await apiClient.post('/auth/register/', payload);
    const { tokens, access, refresh, user, organization } = response.data;
    const acc = tokens?.access || access;
    const ref = tokens?.refresh || refresh;
    if (acc) {
      setAuthTokens(acc, ref);
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
      const data = localStorage.getItem(USER_INFO_KEY) || sessionStorage.getItem(USER_INFO_KEY);
      if (!data || data === 'undefined' || data === 'null') return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  getStoredOrg() {
    try {
      const data = localStorage.getItem(ORG_INFO_KEY) || sessionStorage.getItem(ORG_INFO_KEY);
      if (!data || data === 'undefined' || data === 'null') return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  },
};
