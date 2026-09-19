import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * Skeleton Component
 * Shimmer pulse placeholder for loading states
 */
function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('animate-pulse rounded-xl bg-gray-200/80', className)}
      {...props}
    />
  );
}

export { Skeleton };
