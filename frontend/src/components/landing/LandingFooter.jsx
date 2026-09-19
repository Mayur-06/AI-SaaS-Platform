import React from 'react';
import { Link } from 'react-router-dom';

export const LandingFooter = () => {
  return (
    <footer className="bg-[#292929] text-white border-t border-white/10 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Footer Content */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
          
          {/* Brand Column */}
          <div className="col-span-2 space-y-4">
            <Link to="/" className="inline-block no-underline">
              <span
                style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
                className="text-2xl font-bold text-white tracking-tight"
              >
                Hapy<span className="text-[#b2c147]">●</span>
              </span>
            </Link>
            <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
              Transform overwhelming reports, research papers, and company documentation into clear, grounded answers.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="text-xs font-semibold text-[#b2c147] uppercase tracking-wider mb-4 font-mono">
              Product
            </h4>
            <ul className="space-y-2.5 text-sm text-gray-400">
              <li>
                <a href="#how-it-works" className="hover:text-white transition-colors no-underline">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-white transition-colors no-underline">
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-white transition-colors no-underline">
                  Pricing Plans
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors no-underline">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Platform Links */}
          <div>
            <h4 className="text-xs font-semibold text-[#b2c147] uppercase tracking-wider mb-4 font-mono">
              App Console
            </h4>
            <ul className="space-y-2.5 text-sm text-gray-400">
              <li>
                <Link to="/dashboard" className="hover:text-white transition-colors no-underline">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link to="/ai" className="hover:text-white transition-colors no-underline">
                  AI Query & RAG
                </Link>
              </li>
              <li>
                <Link to="/billing" className="hover:text-white transition-colors no-underline">
                  Billing & Quota
                </Link>
              </li>
              <li>
                <Link to="/keys" className="hover:text-white transition-colors no-underline">
                  API Keys
                </Link>
              </li>
            </ul>
          </div>

          {/* Security & Access */}
          <div>
            <h4 className="text-xs font-semibold text-[#b2c147] uppercase tracking-wider mb-4 font-mono">
              Account
            </h4>
            <ul className="space-y-2.5 text-sm text-gray-400">
              <li>
                <Link to="/login" className="hover:text-white transition-colors no-underline">
                  Sign In
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-white transition-colors no-underline">
                  Create Account
                </Link>
              </li>
              <li>
                <Link to="/password-reset" className="hover:text-white transition-colors no-underline">
                  Password Reset
                </Link>
              </li>
            </ul>
          </div>

        </div>

      </div>
    </footer>
  );
};
