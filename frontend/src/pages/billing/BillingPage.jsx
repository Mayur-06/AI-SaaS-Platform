import React, { useEffect, useState } from 'react';
import { useBillingStore } from '../../store/billingStore';
import { useAuthStore } from '../../store/authStore';
import { PlanCard } from '../../components/billing/PlanCard';
import { UsageBreakdown } from '../../components/billing/UsageBreakdown';
import { CostSummary } from '../../components/billing/CostSummary';
import { CacheStats } from '../../components/billing/CacheStats';
import { InvoicesTable } from '../../components/billing/InvoicesTable';

export const BillingPage = () => {
  const { role } = useAuthStore();
  const { currentPlan, availablePlans, usage, invoices, fetchBillingData, upgradePlan, isLoading } =
    useBillingStore();

  const [upgradeMessage, setUpgradeMessage] = useState(null);
  const [upgradeError, setUpgradeError] = useState(null);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  const handleUpgrade = async (planId) => {
    setUpgradeMessage(null);
    setUpgradeError(null);
    try {
      await upgradePlan(planId);
      setUpgradeMessage('Plan upgraded successfully! New limits and rates are now active.');
    } catch (err) {
      setUpgradeError(err.response?.data?.error || err.message || 'Failed to upgrade plan.');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 'bold' }}>Billing, Plans & Quota</h1>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>
            Manage your subscription tier, track real-time resource utilization, and review invoices.
          </p>
        </div>
        <button onClick={() => fetchBillingData(true)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
          Refresh
        </button>
      </div>

      {upgradeMessage && <div className="alert alert-success">{upgradeMessage}</div>}
      {upgradeError && <div className="alert alert-error">{upgradeError}</div>}

      {/* Quota & Usage Progress */}
      <div style={{ marginBottom: '1.5rem' }}>
        <UsageBreakdown usage={usage} />
      </div>

      {/* Cost & Cache Efficiency */}
      <div style={{ marginBottom: '1.5rem' }}>
        <CostSummary usage={usage} />
      </div>

      {/* Plan Comparison Cards */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.75rem' }}>Subscription Plans</h3>
        <div className="grid-3">
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

      {/* Semantic Cache Administration */}
      <div style={{ marginBottom: '1.5rem' }}>
        <CacheStats userRole={role} />
      </div>

      {/* Invoices */}
      <div>
        <InvoicesTable invoices={invoices} />
      </div>
    </div>
  );
};
