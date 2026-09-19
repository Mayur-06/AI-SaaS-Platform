import React from 'react';

/**
 * Button Component
 * @param {'primary' | 'secondary' | 'ghost' | 'danger' | 'dark'} variant
 * @param {'sm' | 'md' | 'lg'} size
 */
export const Button = ({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  children,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]';

  const variants = {
    primary:
      'bg-[#b2c147] text-[#292929] hover:brightness-105 shadow-sm focus:ring-[#b2c147]',
    secondary:
      'bg-white border border-gray-200 text-[#292929] hover:bg-gray-50 shadow-sm focus:ring-gray-300',
    ghost:
      'text-[#292929] hover:bg-gray-100 focus:ring-gray-200',
    danger:
      'bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 focus:ring-red-300',
    dark:
      'bg-[#292929] text-white hover:bg-black shadow-sm focus:ring-[#292929]',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  return (
    <button
      disabled={disabled}
      className={`${base} ${variants[variant] || variants.primary} ${
        sizes[size] || sizes.md
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
