/**
 * Central Axios HTTP Client
 * 
 * Authentication Architecture & Storage Trade-Off Decision:
 * --------------------------------------------------------
 * We use short-lived JWT access tokens (15 mins) and refresh tokens (7 days).
 * For this client application, tokens are stored in `localStorage` to enable
 * easy standalone React (Vite) demo execution without requiring domain cookie
 * pairing during local development. In production enterprise setups, httpOnly
 * SameSite=Strict cookies are preferred to mitigate XSS risks. To provide defense-in-depth,
 * access tokens are kept short-lived and automatically rotated via the refresh endpoint.
 */

import axios from 'axios';

const BASE_URL = '/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Storage keys
export const ACCESS_TOKEN_KEY = 'ai_saas_access_token';
export const REFRESH_TOKEN_KEY = 'ai_saas_refresh_token';
export const USER_INFO_KEY = 'ai_saas_user';
export const ORG_INFO_KEY = 'ai_saas_org';
export const REMEMBER_ME_KEY = 'ai_saas_remember_me';
export const REMEMBERED_EMAIL_KEY = 'ai_saas_remembered_email';

// Token helpers: check localStorage first (persistent), then sessionStorage (session-only)
export const getAccessToken = () =>
  localStorage.getItem(ACCESS_TOKEN_KEY) || sessionStorage.getItem(ACCESS_TOKEN_KEY);
export const getRefreshToken = () =>
  localStorage.getItem(REFRESH_TOKEN_KEY) || sessionStorage.getItem(REFRESH_TOKEN_KEY);

export const setAuthTokens = (access, refresh, rememberMe = true) => {
  if (rememberMe) {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } else {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, access);
    if (refresh) sessionStorage.setItem(REFRESH_TOKEN_KEY, refresh);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
};

export const clearAuthTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_INFO_KEY);
  localStorage.removeItem(ORG_INFO_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(USER_INFO_KEY);
  sessionStorage.removeItem(ORG_INFO_KEY);
};

export const purgeAllCredentials = () => {
  clearAuthTokens();
  try {
    localStorage.removeItem(REMEMBER_ME_KEY);
    localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    localStorage.removeItem('ai_saas_org');
    localStorage.clear();
  } catch (e) {
    console.error('Failed to clear localStorage:', e);
  }
  try {
    sessionStorage.clear();
  } catch (e) {
    console.error('Failed to clear sessionStorage:', e);
  }
  if (apiClient.defaults.headers && apiClient.defaults.headers.common) {
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

// Request Interceptor: Inject Bearer Token
apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Concurrency lock for refresh token requests
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Helper: sleep for ms milliseconds
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Response Interceptor: Refresh token & Centralized Error Extraction
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // ── 429 Rate-limit automatic retry with exponential backoff ──────────────
    // Retries up to 4 times for transient rate-limits (RPM / TPM), honouring the
    // server's Retry-After header. Does NOT retry MONTHLY_LIMIT_EXCEEDED since quota
    // cannot be recovered by waiting seconds.
    const errCode = error.response?.data?.error?.code || error.response?.data?.code;
    const isMonthlyQuota = errCode === 'MONTHLY_LIMIT_EXCEEDED' || error.response?.status === 402;
    if (error.response?.status === 429 && !isMonthlyQuota) {
      originalRequest._rateLimitRetries = (originalRequest._rateLimitRetries || 0) + 1;
      const MAX_RATE_RETRIES = 4;

      if (originalRequest._rateLimitRetries <= MAX_RATE_RETRIES) {
        const retryAfterHeader = error.response.headers['retry-after'];
        const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
        const waitMs = !isNaN(retryAfterSec) && retryAfterSec > 0
          ? retryAfterSec * 1000
          : Math.pow(2, originalRequest._rateLimitRetries) * 1000; // 2s, 4s, 8s, 16s

        console.warn(
          `[API] Rate limited (429). Retry ${originalRequest._rateLimitRetries}/${MAX_RATE_RETRIES} in ${waitMs / 1000}s…`,
        );
        await sleep(waitMs);
        return apiClient(originalRequest);
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Centralized 401 Unauthorized handling & automatic token refresh
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      const refreshToken = getRefreshToken();

      const isPublicPath = () => {
        if (typeof window === 'undefined') return false;
        const p = window.location.pathname;
        return (
          p === '/' ||
          p.startsWith('/login') ||
          p.startsWith('/register') ||
          p.startsWith('/password-reset') ||
          p.startsWith('/verify')
        );
      };

      // If this is a login or refresh request failing, don't loop
      if (
        originalRequest.url?.includes('/auth/login/') ||
        originalRequest.url?.includes('/auth/refresh/') ||
        !refreshToken
      ) {
        clearAuthTokens();
        if (typeof window !== 'undefined' && !isPublicPath()) {
          window.location.replace('/login');
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post('/api/auth/refresh/', {
          refresh: refreshToken,
        });

        const newAccess = refreshResponse.data.access;
        const newRefresh = refreshResponse.data.refresh;
        const isRemembered = localStorage.getItem(REMEMBER_ME_KEY) === 'true';
        setAuthTokens(newAccess, newRefresh, isRemembered);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        }

        processQueue(null, newAccess);
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        clearAuthTokens();
        if (typeof window !== 'undefined' && !isPublicPath()) {
          window.location.replace('/login');
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Standardized error extractor helper for UI feedback
 */
export function extractErrorMessage(error) {
  if (axios.isAxiosError(error) && error.response) {
    const data = error.response.data;
    const headers = error.response.headers;
    const requestId = headers['x-request-id'] || data?.request_id || data?.error?.request_id;
    const usageWarning = headers['x-usage-warning'];
    
    let rateLimitReset = headers['retry-after'];
    if (!rateLimitReset && headers['x-ratelimit-reset']) {
      const resetVal = parseInt(headers['x-ratelimit-reset'], 10);
      if (!isNaN(resetVal)) {
        const nowSec = Math.floor(Date.now() / 1000);
        rateLimitReset = resetVal > nowSec ? String(resetVal - nowSec) : '1';
      }
    }

    let message = 'An unexpected error occurred.';
    let code = data?.code || data?.error?.code;

    if (data?.error) {
      if (typeof data.error === 'string') {
        message = data.error;
      } else if (typeof data.error === 'object' && data.error !== null) {
        if (typeof data.error.message === 'string') {
          message = data.error.message;
        } else if (typeof data.error.message === 'object' && data.error.message !== null) {
          const firstKey = Object.keys(data.error.message)[0];
          const val = data.error.message[firstKey];
          if (Array.isArray(val) && val.length > 0) {
            message = `${firstKey}: ${val[0]}`;
          } else if (typeof val === 'string') {
            message = `${firstKey}: ${val}`;
          } else {
            message = JSON.stringify(data.error.message);
          }
        } else if (data.error.detail && typeof data.error.detail === 'string') {
          message = data.error.detail;
        }
        code = data.error.code || code;
      }
    } else if (data?.detail && typeof data.detail === 'string') {
      message = data.detail;
    } else if (data?.message && typeof data.message === 'string') {
      message = data.message;
    } else if (typeof data === 'object' && data !== null) {
      // Serializer errors or field validation maps
      const firstKey = Object.keys(data)[0];
      if (firstKey) {
        const val = data[firstKey];
        if (Array.isArray(val) && val.length > 0) {
          message = `${firstKey}: ${val[0]}`;
        } else if (typeof val === 'string') {
          message = `${firstKey}: ${val}`;
        } else {
          message = JSON.stringify(data);
        }
      }
    }

    const upgradeUrl = data?.error?.upgrade_url || data?.upgrade_url || data?.error?.upgrade_link || data?.upgrade_link || null;
    const upgradeLink = data?.error?.upgrade_link || data?.upgrade_link || (upgradeUrl ? '/billing' : null);

    if (error.response.status === 429) {
      if (code === 'MONTHLY_LIMIT_EXCEEDED' || data?.error?.code === 'MONTHLY_LIMIT_EXCEEDED' || data?.code === 'MONTHLY_LIMIT_EXCEEDED') {
        code = 'MONTHLY_LIMIT_EXCEEDED';
        message = message || 'Monthly limit reached. Upgrade to Pro for 5,000 requests/month.';
      } else {
        code = code || 'RATE_LIMIT_EXCEEDED';
        message = message || 'Rate limit exceeded. Please wait a moment before trying again.';
      }
    } else if (error.response.status === 402) {
      code = code || 'MONTHLY_LIMIT_EXCEEDED';
      message = message || 'Monthly limit reached. Upgrade to Pro for 5,000 requests/month.';
    }

    if (typeof message !== 'string') {
      message = String(message || 'An unexpected error occurred.');
    }

    return { message, code, requestId, rateLimitReset, usageWarning, upgradeUrl, upgradeLink };
  }

  const rawMsg = error instanceof Error ? error.message : (typeof error === 'string' ? error : 'Unknown error');
  return { message: typeof rawMsg === 'string' ? rawMsg : JSON.stringify(rawMsg) };
}
