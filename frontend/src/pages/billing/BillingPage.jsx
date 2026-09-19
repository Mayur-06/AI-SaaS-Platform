import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RotateCw, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import { useBillingStore } from '../../store/billingStore';
import { useAuthStore } from '../../store/authStore';
import { PlanCard } from '../../components/billing/PlanCard';
import { UsageBreakdown } from '../../components/billing/UsageBreakdown';
import { CostSummary } from '../../components/billing/CostSummary';
import { InvoicesTable } from '../../components/billing/InvoicesTable';
import { extractErrorMessage } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

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

  const [upgradeMessage, setUpgradeMessage] = useState(null);
  const [upgradeError, setUpgradeError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (organization || !user?.is_staff) {
      fetchBillingData();
    }
  }, [fetchBillingData, organization, user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBillingData(true);
    setRefreshing(false);
  };

  const handleUpgrade = async (planId) => {
    setUpgradeMessage(null);
    setUpgradeError(null);
    try {
      await upgradePlan(planId);
      setUpgradeMessage('Plan upgraded successfully! New limits and rates are now active.');
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setUpgradeError(message || 'Failed to upgrade plan.');
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
          <Link to="/admin" className="no-underline">
            <Button variant="dark" size="md">
              Go to Superadmin Console →
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
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

      {/* Upgrade Notifications */}
      {upgradeMessage && (
        <div className="px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-800 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          <span>{upgradeMessage}</span>
        </div>
      )}
      {upgradeError && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="text-red-600 shrink-0" />
          <span>{upgradeError}</span>
        </div>
      )}

      {/* Quota & Usage Progress */}
      <UsageBreakdown usage={usage} />

      {/* Cost & Cache Efficiency */}
      <CostSummary usage={usage} />

      {/* Subscription Plans Comparison */}
      <div className="space-y-4">
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
      </div>

      {/* Invoices */}
      <InvoicesTable invoices={invoices} />
    </div>
  );
};
