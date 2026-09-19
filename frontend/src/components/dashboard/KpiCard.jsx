import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ProgressBar } from '../ui/ProgressBar';

export const KpiCard = ({
  title,
  value,
  subtitle,
  badge,
  progress,
}) => {
  return (
    <Card
      variant="bordered"
      className="hover:shadow-md hover:border-gray-300 transition-all duration-200 flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider font-mono">
            {title}
          </span>
          {badge && (
            <Badge variant={badge === 'QUOTA ALERT' ? 'red' : 'lime'}>
              {badge}
            </Badge>
          )}
        </div>

        <div
          style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
          className="text-3xl font-bold text-[#292929] my-1.5 tracking-tight"
        >
          {value}
        </div>

        {progress !== undefined && (
          <div className="my-2">
            <ProgressBar value={progress.used} max={progress.max} size="sm" />
          </div>
        )}
      </div>

      {subtitle && (
        <div className="text-xs text-gray-500 font-medium mt-1">
          {subtitle}
        </div>
      )}
    </Card>
  );
};
