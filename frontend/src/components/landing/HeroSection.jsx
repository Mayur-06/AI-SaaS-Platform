import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export const HeroSection = () => {
  const { isAuthenticated } = useAuthStore();

  return (
    <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 bg-white">
      {/* Subtle lime ambient light blob in background */}
      <div className="absolute top-10 right-1/4 w-96 h-96 bg-[#b2c147]/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/2 -left-20 w-80 h-80 bg-[#b2c147]/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left / Main Text Column */}
          <div className="lg:col-span-6 xl:col-span-6 animate-fade-up">
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#b2c147]/15 border border-[#b2c147]/30 text-[#292929] text-xs font-semibold uppercase tracking-wider mb-6">
              <span className="w-2 h-2 rounded-full bg-[#b2c147] animate-pulse" />
              AI-Powered Document Intelligence
            </div>

            {/* Main Display Headline */}
            <h1
              style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#292929] tracking-tight leading-[1.08] mb-6"
            >
              Complex Documents.<br />
              <span className="text-[#b2c147] relative inline-block">
                Simple
                <svg
                  className="absolute -bottom-1.5 left-0 w-full text-[#b2c147]/40"
                  height="6"
                  viewBox="0 0 100 6"
                  preserveAspectRatio="none"
                >
                  <path d="M0 5 Q 50 0, 100 5" stroke="currentColor" strokeWidth="3" fill="none" />
                </svg>
              </span>{' '}
              Conversations.
            </h1>

            {/* Subheading */}
            <p className="text-lg sm:text-xl text-gray-600 font-normal leading-relaxed mb-8 max-w-xl">
              Turn lengthy reports, research papers, and company knowledge bases into instant, 
              grounded answers with AI. Stop skimming hundreds of pages.
            </p>

            {/* Primary & Secondary CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-10">
              <Link
                to={isAuthenticated ? "/dashboard" : "/register"}
                className="inline-flex items-center justify-center px-6 py-3.5 text-base font-bold text-[#292929] bg-[#b2c147] hover:brightness-105 active:scale-[0.98] rounded-xl shadow-sm transition-all no-underline text-center"
              >
                {isAuthenticated ? "Go to Dashboard →" : "Start for Free →"}
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center px-6 py-3.5 text-base font-semibold text-[#292929] bg-white border border-gray-200 hover:bg-gray-50 active:scale-[0.98] rounded-xl transition-all no-underline text-center"
              >
                See How It Works
              </a>
            </div>

            {/* Editorial Quote */}
            <div className="border-l-2 border-[#b2c147] pl-4 py-1 text-sm text-gray-500 italic max-w-md">
              &ldquo;The best insights shouldn&apos;t be buried under hundreds of pages.&rdquo;
            </div>
          </div>

          {/* Right / Visual Before-and-After Transformation */}
          <div className="lg:col-span-6 xl:col-span-6 animate-fade-up-delay-1">
            <div className="relative mx-auto max-w-lg lg:max-w-none">
              
              {/* Card Container with subtle shadow & border */}
              <div className="bg-gradient-to-br from-gray-50/90 to-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-xl shadow-black/5 relative">
                
                {/* Visual Label Header */}
                <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-200/80 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400/80 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#b2c147] inline-block" />
                    <span className="ml-2 font-mono text-gray-500">Hapy Workspace</span>
                  </div>
                  <span className="text-[#b2c147] font-semibold">Semantic RAG Active</span>
                </div>

                {/* Split Visual: Messy Stack -> AI Synthesis */}
                <div className="space-y-4">
                  
                  {/* Document Pile representation */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                      <span className="font-semibold flex items-center gap-1.5 text-gray-700">
                        📄 Q3_Financial_Audit_2026.pdf (142 pages)
                      </span>
                      <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded font-mono">1.4 MB</span>
                    </div>
                    {/* Simulated document lines */}
                    <div className="space-y-1.5 opacity-60">
                      <div className="h-2 bg-gray-200 rounded w-11/12" />
                      <div className="h-2 bg-gray-200 rounded w-full" />
                      <div className="h-2 bg-gray-200 rounded w-4/5" />
                    </div>
                  </div>

                  {/* Flow Indicator with pulse */}
                  <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#292929] py-1">
                    <div className="h-px w-12 bg-gradient-to-r from-transparent to-[#b2c147]" />
                    <span className="bg-[#b2c147]/20 border border-[#b2c147]/50 text-[#292929] px-2.5 py-0.5 rounded-full text-[11px] font-mono flex items-center gap-1">
                      ⚡ 62% Semantic Cache Hit · 0.12s
                    </span>
                    <div className="h-px w-12 bg-gradient-to-l from-transparent to-[#b2c147]" />
                  </div>

                  {/* Clean Chat Answer Card */}
                  <div className="bg-[#292929] text-white p-5 rounded-2xl shadow-lg border border-white/10 space-y-3">
                    <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
                      <div className="flex items-center gap-2 font-medium">
                        <span className="w-5 h-5 rounded-full bg-[#b2c147] text-[#292929] flex items-center justify-center text-[10px] font-bold">
                          H
                        </span>
                        <span>Prompt: &ldquo;Summarize net margins and key risk factors&rdquo;</span>
                      </div>
                      <span className="text-[10px] text-[#b2c147] font-mono">Grounded</span>
                    </div>

                    <p className="text-xs sm:text-sm text-gray-200 leading-relaxed font-sans">
                      Net operating margin expanded by <strong className="text-[#b2c147] font-semibold">+4.2% YoY</strong> to $18.4M.
                      Key risks identified in section 4.2 include cloud infrastructure amortization and currency exposure in EU operations.
                    </p>

                    {/* Sources Badge Row */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                      <span className="text-gray-400">Sources:</span>
                      <span className="bg-white/10 hover:bg-white/15 px-2 py-0.5 rounded text-gray-300 font-mono text-[10px]">
                        p. 14 §2.1
                      </span>
                      <span className="bg-white/10 hover:bg-white/15 px-2 py-0.5 rounded text-gray-300 font-mono text-[10px]">
                        p. 89 §4.2
                      </span>
                    </div>
                  </div>

                </div>

                {/* Floating Metric Badge */}
                <div className="absolute -bottom-4 -right-4 bg-white border border-gray-200 px-4 py-2.5 rounded-2xl shadow-lg flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#b2c147]/20 text-[#292929] flex items-center justify-center font-bold text-sm">
                    ✓
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#292929]">Zero Hallucination</div>
                    <div className="text-[10px] text-gray-500">Cited to original paragraphs</div>
                  </div>
                </div>

              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
