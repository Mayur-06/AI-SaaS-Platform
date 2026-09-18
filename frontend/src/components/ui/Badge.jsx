import React from 'react';

/**
 * Badge Component
 * @param {'lime' | 'gray' | 'red' | 'green' | 'dark' | 'purple'} variant
 */
export const Badge = ({ variant = 'gray', className = '', children }) => {
  const base =
    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono uppercase tracking-wider transition-colors';

  const variants = {
    lime: 'bg-[#b2c147]/20 text-[#292929] border border-[#b2c147]/40 font-bold',
    gray: 'bg-gray-100 text-gray-700 border border-gray-200 font-medium',
    red: 'bg-red-50 text-red-700 border border-red-200 font-semibold',
    green: 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold',
    dark: 'bg-[#292929] text-white border border-white/10 font-semibold',
    purple: 'bg-purple-50 text-purple-700 border border-purple-200 font-semibold',
  };

  return (
    <span className={`${base} ${variants[variant] || variants.gray} ${className}`}>
      {children}
    </span>
  );
};
