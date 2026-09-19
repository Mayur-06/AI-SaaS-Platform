import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ProgressBar } from '../ui/ProgressBar';
import { Skeleton } from '../ui/Skeleton';

export const KpiCard = ({
  title,
  value,
  subtitle,
  badge,
  progress,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <Card variant="bordered" className="flex flex-col justify-between p-6 space-y-3.5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-4 w-12 rounded-full" />
        </div>
        <Skeleton className="h-8 w-28 my-1" />
        <Skeleton className="h-3 w-36" />
      </Card>
    );
  }

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
