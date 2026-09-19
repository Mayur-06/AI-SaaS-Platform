import React from 'react';

export const HowItWorksSection = () => {
  const steps = [
    {
      num: '01',
      title: 'Upload Your Documents',
      desc: 'Drop in PDFs, financial reports, technical documentation, or research papers. Hapy indexes and vectors your content with strict multi-tenant isolation.',
      badge: 'Multi-format PDF & Text',
      icon: (
        <svg className="w-6 h-6 text-[#292929]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ),
    },
    {
      num: '02',
      title: 'Ask in Plain English',
      desc: 'Ask complex analytical questions, request bulleted summaries, or search for obscure clauses. No prompt engineering or special query syntax required.',
      badge: 'Natural Conversations',
      icon: (
        <svg className="w-6 h-6 text-[#292929]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
    },
    {
      num: '03',
      title: 'Get Grounded Answers',
      desc: 'Receive exact syntheses backed by precise page and section citations. Instant response times powered by semantic caching at reduced LLM costs.',
      badge: 'Citations & Cache Hits',
      icon: (
        <svg className="w-6 h-6 text-[#292929]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <section id="how-it-works" className="py-20 lg:py-28 bg-[#fafafa] border-y border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <h2
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#292929] tracking-tight mb-4"
          >
            How It Works
          </h2>
          <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
            From dense, chaotic documentation to direct, verified insights in three simple steps.
          </p>
        </div>

        {/* 3 Steps Grid */}
        <div className="grid md:grid-cols-3 gap-8 lg:gap-10 relative">
          
          {steps.map((step, idx) => (
            <div
              key={step.num}
              className="bg-white rounded-2xl p-8 border border-gray-200/80 shadow-sm hover:shadow-md transition-shadow relative flex flex-col justify-between group"
            >
              <div>
                {/* Step Top Bar: Icon + Large Step Number */}
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-xl bg-[#b2c147]/15 flex items-center justify-center group-hover:bg-[#b2c147]/25 transition-colors">
                    {step.icon}
                  </div>
                  <span
                    style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
                    className="text-4xl font-extrabold text-gray-200 group-hover:text-[#b2c147] transition-colors"
                  >
                    {step.num}
                  </span>
                </div>

                {/* Badge */}
                <div className="inline-block px-2.5 py-0.5 rounded-md bg-gray-100 text-[#292929] text-[11px] font-semibold mb-3">
                  {step.badge}
                </div>

                {/* Title */}
                <h3
                  style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
                  className="text-xl font-bold text-[#292929] mb-3"
                >
                  {step.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-gray-600 leading-relaxed">
                  {step.desc}
                </p>
              </div>

              {/* Step indicator arrow for desktop */}
              {idx < steps.length - 1 && (
                <div className="hidden md:block absolute -right-5 top-1/2 -translate-y-1/2 z-10">
                  <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 shadow-sm">
                    →
                  </div>
                </div>
              )}
            </div>
          ))}

        </div>

      </div>
    </section>
  );
};
