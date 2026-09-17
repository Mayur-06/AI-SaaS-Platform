import { create } from 'zustand';
import { authService } from '../services/authService';
import { getAccessToken, clearAuthTokens } from '../services/api';

const getInitialAuthState = () => {
  try {
    const token = getAccessToken();
    const storedUser = authService.getStoredUser();
    const storedOrg = authService.getStoredOrg();

    if (token && storedUser) {
      return {
        user: storedUser,
        organization: storedOrg,
        isAuthenticated: true,
        role: storedOrg?.role || null,
        isLoading: false,
      };
    }
  } catch (err) {
    console.error('Error reading stored auth state:', err);
  }

  return {
    user: null,
    organization: null,
    isAuthenticated: false,
    role: null,
    isLoading: false,
  };
};

const initialAuth = getInitialAuthState();

export const useAuthStore = create((set) => ({
  ...initialAuth,
  error: null,

  initializeAuth: () => {
    const current = getInitialAuthState();
    set({ ...current });
  },

  login: async (email, password, rememberMe = false) => {
    set({ isLoading: true, error: null });
    try {
      const data = await authService.login(email, password, rememberMe);
      set({
        user: data.user,
        organization: data.organization,
        role: data.organization?.role || null,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Login failed';
      set({ error: msg, isLoading: false, isAuthenticated: false });
      throw err;
    }
  },

  register: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const data = await authService.register(payload);
      set({
        user: data.user,
        organization: data.organization,
        role: data.organization?.role || 'owner',
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Registration failed';
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  logout: () => {
    authService.logout();
    clearAuthTokens();
    set({
      user: null,
      organization: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  },

  setUser: (user) => set({ user }),
  setOrganization: (org) => set({ organization: org, role: org?.role || null }),
  clearError: () => set({ error: null }),
}));
