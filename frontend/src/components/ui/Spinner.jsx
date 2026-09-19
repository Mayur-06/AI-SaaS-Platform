import React from 'react';
import { Loader2 } from 'lucide-react';

export const Spinner = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    xl: 'w-12 h-12',
  };

  const selectedSize = sizeClasses[size] || sizeClasses.md;

  return (
    <Loader2
      className={`animate-spin text-[#b2c147] ${selectedSize} ${className}`}
    />
  );
};

export const FullPageSpinner = ({ className = '' }) => {
  return (
    <div
      className={`min-h-screen w-full flex items-center justify-center bg-white ${className}`}
      role="status"
      aria-label="Loading"
    >
      <Spinner size="lg" />
    </div>
  );
};
