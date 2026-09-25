import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RotateCw, ShieldAlert, CreditCard, Activity, Receipt, Database } from 'lucide-react';
import { toast } from 'sonner';
import { useBillingStore } from '../../store/billingStore';
import { useAuthStore } from '../../store/authStore';
import { PlanCard } from '../../components/billing/PlanCard';
import { UsageBreakdown } from '../../components/billing/UsageBreakdown';
import { CostSummary } from '../../components/billing/CostSummary';
import { InvoicesTable } from '../../components/billing/InvoicesTable';
import { CacheStats } from '../../components/billing/CacheStats';
import { extractErrorMessage } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs';

export const BillingPage = () => {
  const { role, user, organization } = useAuthStore();
  const {
    currentPlan,
    availablePlans,
    usage,
    invoices,
    fetchBillingData,
    upgradePlan,
    isLoading,
  } = useBillingStore();

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('plans');

  useEffect(() => {
    if (organization || !user?.is_staff) {
      fetchBillingData(true);

      const interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchBillingData(true);
        }
      }, 15000);

      const handleSync = () => {
        if (document.visibilityState === 'visible') {
          fetchBillingData(true);
        }
      };
      window.addEventListener('focus', handleSync);
      document.addEventListener('visibilitychange', handleSync);

      return () => {
        clearInterval(interval);
        window.removeEventListener('focus', handleSync);
        document.removeEventListener('visibilitychange', handleSync);
      };
    }
  }, [fetchBillingData, organization, user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchBillingData(true);
      toast.success('Telemetry and quota metrics refreshed.');
    } catch {
      toast.error('Failed to refresh telemetry.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleUpgrade = async (planId) => {
    try {
      await upgradePlan(planId);
      toast.success('Plan upgraded successfully! New limits and rates are now active.');
    } catch (err) {
      const { message } = extractErrorMessage(err);
      toast.error(message || 'Failed to upgrade plan.');
    }
  };

  if (!organization && user?.is_staff) {
    return (
      <Card variant="bordered" className="max-w-xl mx-auto text-center py-12 px-6 shadow-sm space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center mx-auto">
          <ShieldAlert size={24} />
        </div>
        <h2
          style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
          className="text-2xl font-bold text-[#292929]"
        >
          Superadmin Console Mode
        </h2>
        <p className="text-xs text-gray-500 leading-relaxed max-w-md mx-auto">
          Subscription tiers, quotas, and invoices are scoped to individual tenant accounts. You are currently logged in as a <strong>Platform Superadmin</strong> without an active tenant organization context.
        </p>
        <div className="pt-2">
          <Link to="/admin-console" className="no-underline">
            <Button variant="dark" size="md">
              Go to Superadmin Console →
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100">
        <div>
          <h1
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-2xl sm:text-3xl font-extrabold text-[#292929] tracking-tight"
          >
            Billing, Plans & Quota
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Manage your organization tier, track telemetry consumption, and audit invoices.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading || refreshing}
          className="self-start sm:self-auto flex items-center gap-2"
        >
          <RotateCw
            size={14}
            className={refreshing ? 'animate-spin text-[#b2c147]' : 'text-gray-500'}
          />
          <span>{refreshing ? 'Refreshing…' : 'Refresh Telemetry'}</span>
        </Button>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full max-w-2xl gap-1">
          <TabsTrigger value="plans" className="flex items-center gap-1.5">
            <CreditCard size={13} />
            <span>Plans</span>
          </TabsTrigger>
          <TabsTrigger value="usage" className="flex items-center gap-1.5">
            <Activity size={13} />
            <span>Usage &amp; Cost</span>
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-1.5">
            <Receipt size={13} />
            <span>Invoices</span>
          </TabsTrigger>
          <TabsTrigger value="cache" className="flex items-center gap-1.5">
            <Database size={13} />
            <span>Cache Admin</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Plans */}
        <TabsContent value="plans" className="space-y-4">
          <div>
            <h3
              style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
              className="text-xl font-bold text-[#292929] tracking-tight"
            >
              Available Subscription Tiers
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Switch plans to immediately expand monthly request volume and cache retention
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {availablePlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrent={currentPlan?.id === plan.id || currentPlan?.name === plan.name}
                onUpgrade={handleUpgrade}
                isLoading={isLoading}
                userRole={role}
              />
            ))}
          </div>
        </TabsContent>

        {/* Tab 2: Usage & Cost */}
        <TabsContent value="usage" className="space-y-6">
          <UsageBreakdown usage={usage} />
          <CostSummary usage={usage} />
        </TabsContent>

        {/* Tab 3: Invoices */}
        <TabsContent value="invoices" className="space-y-4">
          <InvoicesTable invoices={invoices} />
        </TabsContent>

        {/* Tab 4: Semantic Cache Admin */}
        <TabsContent value="cache" className="space-y-4">
          <CacheStats userRole={role} isActive={activeTab === 'cache'} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
