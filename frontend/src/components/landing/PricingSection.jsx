import React from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';

export const PricingSection = () => {
  const plans = [
    {
      name: 'Free',
      badge: 'Starter',
      priceMonthly: 0,
      desc: 'Ideal for small projects and exploring document intelligence.',
      requests: '100 monthly requests',
      rateLimit: '60 requests / minute',
      cacheTtl: '1 hour semantic cache',
      features: [
        '100 requests per month',
        '60 req / min rate limit',
        'Org-isolated RAG vector search',
        'Standard semantic caching (1h TTL)',
        'Up to 3 team members',
        'Community support',
      ],
      ctaText: 'Start for Free',
      highlighted: false,
    },
    {
      name: 'Pro',
      badge: 'Most Popular',
      priceMonthly: 49,
      desc: 'Designed for fast-growing businesses analyzing reports daily.',
      requests: '5,000 monthly requests',
      rateLimit: '120 requests / minute',
      cacheTtl: '24 hours semantic cache',
      features: [
        '5,000 requests per month',
        '120 req / min rate limit',
        'Org-isolated RAG vector search',
        'Extended semantic cache (24h TTL)',
        'Model auto-fallback routing',
        'Up to 15 team members',
        'Priority email & chat support',
      ],
      ctaText: 'Get Started with Pro',
      highlighted: true,
    },
    {
      name: 'Enterprise',
      badge: 'High Volume',
      priceMonthly: 299,
      desc: 'Unlimited scale and premium throughput for mission-critical apps.',
      requests: '999,999 monthly requests',
      rateLimit: '300 requests / minute',
      cacheTtl: '168 hours semantic cache',
      features: [
        '999,999 requests per month',
        '300 req / min rate limit',
        'Org-isolated RAG vector search',
        'Max cache retention (7 days TTL)',
        'Custom model weights & overrides',
        'Unlimited team seats & API keys',
        '99.9% uptime SLA & dedicated manager',
      ],
      ctaText: 'Contact Sales',
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="py-20 lg:py-28 bg-[#fafafa] border-y border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#b2c147]/15 text-[#292929] text-xs font-semibold uppercase tracking-wider mb-4">
            Transparent Pricing
          </div>
          <h2
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#292929] tracking-tight mb-4"
          >
            Simple Plans for Teams of Any Size
          </h2>
          <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
            Predictable billing grounded in usage. No hidden overage surprises.
          </p>
        </div>

        {/* 3 Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
          {plans.map((p) => {
            const price = p.priceMonthly;

            return (
              <div
                key={p.name}
                className={`rounded-3xl p-8 bg-white transition-all duration-200 flex flex-col justify-between relative ${
                  p.highlighted
                    ? 'border-2 border-[#b2c147] shadow-xl ring-4 ring-[#b2c147]/10'
                    : 'border border-gray-200/90 shadow-sm hover:shadow-md'
                }`}
              >
                {/* Popular Badge */}
                {p.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#b2c147] text-[#292929] text-xs font-bold uppercase tracking-wider px-3.5 py-0.5 rounded-full shadow-sm">
                    {p.badge}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3
                      style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
                      className="text-2xl font-bold text-[#292929]"
                    >
                      {p.name}
                    </h3>
                    {!p.highlighted && (
                      <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {p.badge}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                    {p.desc}
                  </p>

                  {/* Price */}
                  <div className="mb-6 pb-6 border-b border-gray-100">
                    <div className="flex items-baseline gap-1">
                      <span
                        style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
                        className="text-4xl sm:text-5xl font-extrabold text-[#292929]"
                      >
                        ${price}
                      </span>
                      <span className="text-sm text-gray-500 font-medium">/ month</span>
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <ul className="space-y-3 mb-8 text-sm text-gray-600">
                    {p.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-[#b2c147]/25 text-[#292929] flex items-center justify-center shrink-0 mt-0.5">
                          <Check size={11} strokeWidth={3} />
                        </div>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action CTA */}
                <Link
                  to="/register"
                  className={`w-full py-3 text-center text-sm font-bold rounded-xl transition-all no-underline ${
                    p.highlighted
                      ? 'bg-[#b2c147] text-[#292929] hover:brightness-105 active:scale-[0.98] shadow-sm'
                      : 'bg-[#292929] text-white hover:bg-black active:scale-[0.98]'
                  }`}
                >
                  {p.ctaText} →
                </Link>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
