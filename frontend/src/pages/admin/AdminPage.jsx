import React, { useEffect, useState } from 'react';
import { ShieldAlert, RotateCw, AlertCircle, Building2, Activity, Shuffle } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { PlatformMetrics } from '../../components/admin/PlatformMetrics';
import { HealthPanel } from '../../components/admin/HealthPanel';
import { TenantTable } from '../../components/admin/TenantTable';
import { RoutingConfig } from '../../components/admin/RoutingConfig';
import { extractErrorMessage } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs';

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
      setError(`Failed to load admin telemetry: ${message}`);
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold uppercase text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full mb-2">
            <ShieldAlert size={13} />
            <span>Platform Superadmin Privileges</span>
          </div>
          <h1
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-2xl sm:text-3xl font-extrabold text-[#292929] tracking-tight"
          >
            Superadmin Infrastructure Console
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Fleet telemetry, service health probes, multi-tenant accounts, and global LLM routing.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => loadData(currentPage)}
          disabled={isLoading}
          className="self-start sm:self-auto flex items-center gap-1.5"
        >
          <RotateCw size={14} className={isLoading ? 'animate-spin text-[#b2c147]' : ''} />
          <span>Refresh Fleet Telemetry</span>
        </Button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <Tabs defaultValue="fleet" className="space-y-6">
        <TabsList className="grid grid-cols-1 sm:grid-cols-3 w-full max-w-xl gap-1">
          <TabsTrigger value="fleet" className="flex items-center gap-1.5">
            <Building2 size={13} />
            <span>Fleet &amp; Tenants ({tenantCount})</span>
          </TabsTrigger>
          <TabsTrigger value="health" className="flex items-center gap-1.5">
            <Activity size={13} />
            <span>Service Health</span>
          </TabsTrigger>
          <TabsTrigger value="routing" className="flex items-center gap-1.5">
            <Shuffle size={13} />
            <span>Model Routing</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Fleet & Tenants */}
        <TabsContent value="fleet" className="space-y-6">
          <PlatformMetrics metrics={metrics} />
          <TenantTable
            tenants={tenants}
            totalCount={tenantCount}
            currentPage={currentPage}
            onPageChange={(p) => loadData(p)}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* Tab 2: Service Health Probes */}
        <TabsContent value="health" className="space-y-4">
          <HealthPanel
            health={health}
            onRefresh={handleRefreshHealth}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* Tab 3: Model Routing & Circuit Breakers */}
        <TabsContent value="routing" className="space-y-4">
          <RoutingConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
};
