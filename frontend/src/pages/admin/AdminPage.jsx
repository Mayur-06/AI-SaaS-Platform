import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import { PlatformMetrics } from '../../components/admin/PlatformMetrics';
import { HealthPanel } from '../../components/admin/HealthPanel';
import { TenantTable } from '../../components/admin/TenantTable';
import { RoutingConfig } from '../../components/admin/RoutingConfig';
import { extractErrorMessage } from '../../services/api';

export const AdminPage = () => {
  const [metrics, setMetrics] = useState(null);
  const [health, setHealth] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [tenantCount, setTenantCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadData = async (page = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const [m, h, t] = await Promise.all([
        adminService.getMetrics().catch(() => null),
        adminService.getHealth().catch(() => null),
        adminService.getTenants(page).catch(() => ({ count: 0, results: [] })),
      ]);

      if (m) setMetrics(m);
      if (h) setHealth(h);
      if (t) {
        const tenantList = t.results || t.tenants || [];
        setTenants(tenantList);
        setTenantCount(t.count ?? tenantList.length);
        setCurrentPage(page);
      }
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setError(`Failed to load admin data: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshHealth = async () => {
    try {
      const h = await adminService.getHealth();
      setHealth(h);
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setError(`Failed to refresh health: ${message}`);
    }
  };

  useEffect(() => {
    loadData(1);
  }, []);

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 'bold' }}>Platform Superadmin Console</h1>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>
            System-wide multi-tenant fleet overview, service health status, platform economics, and LLM configuration.
          </p>
        </div>

        <button onClick={() => loadData(currentPage)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
          Refresh All
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Global Platform Metrics */}
      <PlatformMetrics metrics={metrics} />

      {/* Infrastructure & LLM Provider Health */}
      <div style={{ marginBottom: '1.5rem' }}>
        <HealthPanel
          health={health}
          onRefresh={handleRefreshHealth}
          isLoading={isLoading}
        />
      </div>

      {/* Tenant Fleet Table */}
      <div style={{ marginBottom: '1.5rem' }}>
        <TenantTable
          tenants={tenants}
          totalCount={tenantCount}
          currentPage={currentPage}
          onPageChange={(p) => loadData(p)}
          isLoading={isLoading}
        />
      </div>

      {/* Model Routing & Circuit Breakers */}
      <div>
        <RoutingConfig />
      </div>
    </div>
  );
};
