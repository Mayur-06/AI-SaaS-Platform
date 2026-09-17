import React, { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useBillingStore } from '../../store/billingStore';
import { orgService } from '../../services/orgService';

export const AppLayout = () => {
  const { user, organization, role, logout, setOrganization } = useAuthStore();
  const { currentPlan, fetchBillingData } = useBillingStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchBillingData();
    orgService.getOrg().then((org) => {
      if (org) {
        setOrganization(org);
        try {
          localStorage.setItem('ai_saas_org', JSON.stringify(org));
        } catch {}
      }
    }).catch(() => {});
  }, [fetchBillingData, setOrganization]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const planName = currentPlan?.name || organization?.plan?.name || 'Free';

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>AI SaaS Platform</h2>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
            {organization ? (
              <>
                <div><strong>Org:</strong> {organization.name}</div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', alignItems: 'center' }}>
                  <span className="badge badge-active">{String(planName || 'Free').toUpperCase()}</span>
                  <span className="badge">{role || 'member'}</span>
                </div>
              </>
            ) : user?.is_staff ? (
              <>
                <div><strong>Console:</strong> Superadmin</div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', alignItems: 'center' }}>
                  <span className="badge badge-active" style={{ background: '#722ed1', color: '#fff' }}>PLATFORM ADMIN</span>
                </div>
              </>
            ) : (
              <>
                <div><strong>Org:</strong> My Organization</div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', alignItems: 'center' }}>
                  <span className="badge badge-active">{String(planName || 'Free').toUpperCase()}</span>
                  <span className="badge">{role || 'member'}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <nav>
          <ul className="nav-links">
            <li className="nav-item">
              <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
                📊 Dashboard
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/ai" className={({ isActive }) => (isActive ? 'active' : '')}>
                🤖 AI Query & RAG
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/billing" className={({ isActive }) => (isActive ? 'active' : '')}>
                💳 Billing & Usage
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/keys" className={({ isActive }) => (isActive ? 'active' : '')}>
                🔑 API Keys
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
                ⚙️ Org Settings
              </NavLink>
            </li>
            {user?.is_staff && (
              <li className="nav-item">
                <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>
                  🛡️ Admin Panel
                </NavLink>
              </li>
            )}
          </ul>
        </nav>

        <div style={{ marginTop: 'auto', borderTop: '1px solid #ccc', paddingTop: '0.75rem', fontSize: '0.85rem' }}>
          <div style={{ marginBottom: '0.5rem', wordBreak: 'break-all' }}>
            👤 {user?.email}
          </div>
          <button onClick={handleLogout} style={{ width: '100%' }}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Screen Content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};
