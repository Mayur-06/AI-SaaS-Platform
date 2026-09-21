import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export const LandingNavbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated } = useAuthStore();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/90 border-b border-gray-100 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-1.5 no-underline group">
          <span
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-2xl font-bold text-[#292929] tracking-tight"
          >
            Hapy<span className="text-[#b2c147]">●</span>
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
          <a
            href="#how-it-works"
            className="hover:text-[#292929] transition-colors no-underline"
          >
            How It Works
          </a>
          <a
            href="#features"
            className="hover:text-[#292929] transition-colors no-underline"
          >
            Features
          </a>
          <a
            href="#pricing"
            className="hover:text-[#292929] transition-colors no-underline"
          >
            Pricing
          </a>
          <a
            href="#faq"
            className="hover:text-[#292929] transition-colors no-underline"
          >
            FAQ
          </a>
        </nav>

        {/* Auth CTA Actions */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-[#292929] bg-[#b2c147] hover:brightness-105 active:scale-[0.98] rounded-lg shadow-sm transition-all no-underline"
            >
              Go to Dashboard →
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-semibold text-[#292929] hover:text-black hover:bg-gray-50 rounded-lg transition-colors no-underline"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-[#292929] bg-[#b2c147] hover:brightness-105 active:scale-[0.98] rounded-lg shadow-sm transition-all no-underline"
              >
                Start for Free →
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-gray-600 hover:text-[#292929] hover:bg-gray-100 focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-gray-100 bg-white px-4 pt-2 pb-6 space-y-3 animate-fade-in">
          <a
            href="#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md no-underline"
          >
            How It Works
          </a>
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md no-underline"
          >
            Features
          </a>
          <a
            href="#pricing"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md no-underline"
          >
            Pricing
          </a>
          <a
            href="#faq"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md no-underline"
          >
            FAQ
          </a>
          <div className="pt-4 border-t border-gray-100 flex flex-col gap-2">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 text-sm font-semibold text-[#292929] bg-[#b2c147] hover:brightness-105 rounded-lg no-underline"
              >
                Go to Dashboard →
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 text-sm font-semibold text-[#292929] bg-gray-50 hover:bg-gray-100 rounded-lg no-underline"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 text-sm font-semibold text-[#292929] bg-[#b2c147] hover:brightness-105 rounded-lg no-underline"
                >
                  Start for Free →
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
