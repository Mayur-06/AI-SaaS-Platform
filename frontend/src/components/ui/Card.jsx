import React from 'react';

/**
 * Card Component
 * @param {'default' | 'bordered' | 'dark' | 'subtle'} variant
 */
export const Card = ({
  variant = 'default',
  className = '',
  children,
  ...props
}) => {
  const variants = {
    default: 'bg-white rounded-2xl border border-gray-200/90 shadow-sm p-6',
    bordered: 'bg-white rounded-2xl border border-gray-200 p-6',
    dark: 'bg-[#292929] text-white rounded-2xl border border-white/10 shadow-lg p-6',
    subtle: 'bg-gray-50/80 rounded-2xl border border-gray-200/70 p-6',
  };

  return (
    <div className={`${variants[variant] || variants.default} ${className}`} {...props}>
      {children}
    </div>
  );
};
