import React from 'react';
import { Check } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export const PlanCard = ({
  plan,
  isCurrent,
  onUpgrade,
  isLoading,
  userRole,
}) => {
  const canUpgrade = userRole === 'owner' || userRole === 'admin';
  const planDisplayName = plan.name ? plan.name.charAt(0).toUpperCase() + plan.name.slice(1) : 'Plan';
  const isUnlimited = plan.monthly_request_limit >= 999999;

  return (
    <Card
      variant="bordered"
      className={`relative flex flex-col justify-between transition-all duration-200 ${
        isCurrent
          ? 'border-2 border-[#b2c147] shadow-xl ring-4 ring-[#b2c147]/10 bg-white'
          : 'border-gray-200/90 shadow-sm hover:shadow-md bg-white'
      }`}
    >
      <div>
        {/* Plan Header */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-2xl font-bold text-[#292929] capitalize"
          >
            {plan.name}
          </h3>
        </div>

        {/* Price */}
        <div className="mb-5 pb-5 border-b border-gray-100">
          <div className="flex items-baseline gap-1">
            <span
              style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
              className="text-4xl font-extrabold text-[#292929]"
            >
              ${Number(plan.price).toFixed(2)}
            </span>
            <span className="text-xs text-gray-500 font-medium">/ month</span>
          </div>
        </div>

        {/* Feature List */}
        <ul className="space-y-3 mb-6 text-xs text-gray-600">
          <li className="flex items-start gap-2.5">
            <div className="w-4 h-4 rounded-full bg-[#b2c147]/20 text-[#292929] flex items-center justify-center shrink-0 mt-0.5">
              <Check size={11} strokeWidth={3} />
            </div>
            <span>
              <strong className="text-[#292929]">
                {isUnlimited ? 'Unlimited' : plan.monthly_request_limit.toLocaleString()}
              </strong>{' '}
              monthly requests
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <div className="w-4 h-4 rounded-full bg-[#b2c147]/20 text-[#292929] flex items-center justify-center shrink-0 mt-0.5">
              <Check size={11} strokeWidth={3} />
            </div>
            <span>
              <strong className="text-[#292929]">
                {plan.requests_per_minute ?? '—'}
              </strong>{' '}
              req / min rate limit
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <div className="w-4 h-4 rounded-full bg-[#b2c147]/20 text-[#292929] flex items-center justify-center shrink-0 mt-0.5">
              <Check size={11} strokeWidth={3} />
            </div>
            <span>
              <strong className="text-[#292929]">
                {plan.name?.toLowerCase() === 'enterprise'
                  ? '1M'
                  : plan.name?.toLowerCase() === 'pro'
                  ? '100K'
                  : '10K'}
              </strong>{' '}
              tokens / min (TPM)
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <div className="w-4 h-4 rounded-full bg-[#b2c147]/20 text-[#292929] flex items-center justify-center shrink-0 mt-0.5">
              <Check size={11} strokeWidth={3} />
            </div>
            <span>
              <strong className="text-[#292929]">{(plan.cache_ttl_seconds / 3600).toFixed(0)}h</strong> semantic cache TTL
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <div className="w-4 h-4 rounded-full bg-[#b2c147]/20 text-[#292929] flex items-center justify-center shrink-0 mt-0.5">
              <Check size={11} strokeWidth={3} />
            </div>
            <span>Org-isolated RAG vector retrieval</span>
          </li>
        </ul>

      </div>

      {/* Action Footer */}
      <div className="pt-2">
        {isCurrent ? (
          <Button variant="secondary" size="md" disabled className="w-full font-bold">
            Active Plan
          </Button>
        ) : canUpgrade ? (
          <Button
            variant="primary"
            size="md"
            className="w-full"
            onClick={() => onUpgrade(plan.id)}
            disabled={isLoading}
          >
            {isLoading ? 'Switching Tier…' : `Switch to ${planDisplayName} →`}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="md"
            disabled
            className="w-full text-gray-400"
            title="Only Owner or Admin can modify plans"
          >
            Switch to {planDisplayName} (Admin Only)
          </Button>
        )}
      </div>
    </Card>
  );
};
