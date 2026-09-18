import React from 'react';

/**
 * ProgressBar Component
 * Color-adaptive:
 * - < 60%: Lime (#b2c147)
 * - 60% - 80%: Amber (#f59e0b)
 * - >= 80%: Red (#ef4444)
 */
export const ProgressBar = ({
  value = 0,
  max = 100,
  percentage,
  size = 'md',
  className = '',
  showLabel = false,
}) => {
  const calculatedPct =
    percentage !== undefined
      ? Math.min(100, Math.max(0, percentage))
      : max > 0
      ? Math.min(100, Math.max(0, (value / max) * 100))
      : 0;

  const pct = Math.round(calculatedPct * 10) / 10;

  const color =
    pct >= 80
      ? 'bg-red-500'
      : pct >= 60
      ? 'bg-amber-400'
      : 'bg-[#b2c147]';

  const heights = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-3.5',
  };

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs font-mono text-gray-500 mb-1.5">
          <span>Usage</span>
          <span className="font-semibold text-[#292929]">{pct}%</span>
        </div>
      )}
      <div
        className={`w-full ${
          heights[size] || heights.md
        } bg-gray-100 rounded-full overflow-hidden p-0.5`}
      >
        <div
          className={`${heights[size] || heights.md} ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};
