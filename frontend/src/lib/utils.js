import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility to merge Tailwind class strings safely.
 * Uses clsx for conditional logic and tailwind-merge to avoid conflicts.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
