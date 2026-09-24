import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { PasswordResetPage } from './pages/auth/PasswordResetPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { AIQueryPage } from './pages/ai/AIQueryPage';
import { BillingPage } from './pages/billing/BillingPage';
import { APIKeysPage } from './pages/keys/APIKeysPage';
import { OrganizationSettingsPage } from './pages/settings/OrganizationSettingsPage';
import { AdminPage } from './pages/admin/AdminPage';
import { LandingPage } from './pages/landing/LandingPage';
import { FullPageSpinner } from './components/ui/Spinner';

// Route Guard: Authenticated user required
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Route Guard: Admin user required
const AdminRoute = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.is_staff) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Route Guard: Tenant dashboard route (superadmin is redirected to /admin)
const TenantDashboardRoute = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.is_staff) {
    return <Navigate to="/admin" replace />;
  }

  return children;
};

// Route Guard: Public only (redirect logged-in users away from /login or /register)
const PublicOnlyRoute = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (isAuthenticated) {
    return <Navigate to={user?.is_staff ? '/admin' : '/dashboard'} replace />;
  }

  return children;
};

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Landing Page */}
      <Route path="/" element={<LandingPage />} />

      {/* Public Auth Routes */}
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />
      <Route path="/password-reset" element={<PasswordResetPage />} />
      <Route path="/verify/:token" element={<VerifyEmailPage />} />

      {/* Protected App Routes under AppLayout */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/dashboard"
          element={
            <TenantDashboardRoute>
              <DashboardPage />
            </TenantDashboardRoute>
          }
        />
        <Route path="/ai" element={<AIQueryPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/keys" element={<APIKeysPage />} />
        <Route
          path="/settings"
          element={
            <TenantDashboardRoute>
              <OrganizationSettingsPage />
            </TenantDashboardRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
