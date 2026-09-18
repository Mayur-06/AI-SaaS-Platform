import React from 'react';
import { FileText, Zap, Shuffle, BarChart3, Users, Key } from 'lucide-react';

export const FeaturesSection = () => {
  const features = [
    {
      icon: FileText,
      title: 'RAG Knowledge Hub',
      desc: 'Upload multi-format documents (PDF, DOCX, TXT) with organization-isolated vector indexing and exact page citations.',
      highlight: 'Isolated Vector Storage',
    },
    {
      icon: Zap,
      title: 'Semantic Caching Engine',
      desc: 'Smart vector similarity caching returns repeated queries in sub-milliseconds, cutting external LLM costs by up to 60%.',
      highlight: 'Redis + pgvector',
    },
    {
      icon: Shuffle,
      title: 'Dynamic Model Fallback',
      desc: 'Intelligent multi-model routing cascades requests between Gemini, GPT, and Claude to guarantee 99.9% uptime and prevent rate limits.',
      highlight: 'Auto-Routing & Breakers',
    },
    {
      icon: BarChart3,
      title: 'Real-Time Usage & Budgets',
      desc: 'Track monthly token consumption, active request limits, cost projections, and configure budget alert thresholds.',
      highlight: 'Granular Analytics',
    },
    {
      icon: Users,
      title: 'Multi-Tenant Team Roles',
      desc: 'Manage your organization with granular role-based access: Owner, Admin, Member, and Viewer with invite tokens.',
      highlight: 'Enterprise RBAC',
    },
    {
      icon: Key,
      title: 'Developer API Keys',
      desc: 'Generate secure hashed API keys with scoped permissions to seamlessly integrate Hapy with your existing software stack.',
      highlight: 'RESTful API Ready',
    },
  ];

  return (
    <section id="features" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#b2c147]/15 text-[#292929] text-xs font-semibold uppercase tracking-wider mb-4">
            Platform Capabilities
          </div>
          <h2
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#292929] tracking-tight mb-4"
          >
            Understand More. Search Less.
          </h2>
          <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
            Enterprise-grade document intelligence built on top of high-performance multi-tenant infrastructure.
          </p>
        </div>

        {/* 6 Grid Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="bg-white rounded-2xl p-7 border border-gray-200/90 shadow-sm hover:shadow-md hover:border-[#b2c147] transition-all duration-200 group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-12 h-12 rounded-xl bg-[#b2c147]/15 text-[#292929] flex items-center justify-center group-hover:bg-[#b2c147] transition-colors">
                      <Icon size={22} />
                    </div>
                    <span className="text-[11px] font-mono font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {feat.highlight}
                    </span>
                  </div>

                  <h3
                    style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
                    className="text-xl font-bold text-[#292929] mb-2.5"
                  >
                    {feat.title}
                  </h3>

                  <p className="text-sm text-gray-600 leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
