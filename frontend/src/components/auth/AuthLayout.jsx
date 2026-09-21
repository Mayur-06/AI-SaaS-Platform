import React from 'react';
import { Link } from 'react-router-dom';

/**
 * AuthLayout — Split-screen wrapper used by Login, Register, PasswordReset, VerifyEmail.
 *
 * Left panel: brand dark (#292929) with Hapy wordmark + quote + decorative shapes
 * Right panel: white, centers the form content
 */
export const AuthLayout = ({ children, quote }) => {
  return (
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] bg-[#292929] flex-col justify-between p-10 relative overflow-hidden">

        {/* Decorative lime circles */}
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-[#b2c147] opacity-[0.07] pointer-events-none" />
        <div className="absolute bottom-10 right-[-60px] w-96 h-96 rounded-full bg-[#b2c147] opacity-[0.05] pointer-events-none" />
        <div className="absolute top-1/2 left-1/3 w-40 h-40 rounded-full bg-[#b2c147] opacity-[0.04] pointer-events-none" />

        {/* Logo */}
        <Link to="/" className="relative z-10 no-underline">
          <span
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-2xl font-bold text-white tracking-tight"
          >
            Hapy<span className="text-[#b2c147]">●</span>
          </span>
        </Link>

        {/* Quote block */}
        <div className="relative z-10 animate-fade-up">
          <blockquote className="text-white/80 text-lg leading-relaxed font-light italic">
            &ldquo;{quote || 'The best insights shouldn\'t be buried under hundreds of pages.'}&rdquo;
          </blockquote>
          <p className="mt-4 text-[#b2c147] text-sm font-semibold not-italic">
            AI-Powered Document Intelligence
          </p>
        </div>

        {/* Spacer to preserve vertical balance */}
        <div className="relative z-10" aria-hidden="true" />
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white">
        {/* Mobile logo (shown only on small screens where left panel is hidden) */}
        <Link
          to="/"
          className="lg:hidden mb-8 no-underline"
          style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
        >
          <span className="text-2xl font-bold text-[#292929]">
            Hapy<span className="text-[#b2c147]">●</span>
          </span>
        </Link>

        <div className="w-full max-w-sm animate-fade-up">
          {children}
        </div>
      </div>

    </div>
  );
};
