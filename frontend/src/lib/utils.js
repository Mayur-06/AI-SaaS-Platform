import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility to merge Tailwind class strings safely.
 * Uses clsx for conditional logic and tailwind-merge to avoid conflicts.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Safely copy text to clipboard with modern API and textarea fallback.
 * Works across HTTPS, HTTP, iframes, and various browsers without crashing.
 */
export async function copyToClipboard(text) {
  if (!text) return false;
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Continue to textarea fallback
    }
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return Boolean(successful);
  } catch (err) {
    console.error('Fallback clipboard copy failed:', err);
    return false;
  }
}
