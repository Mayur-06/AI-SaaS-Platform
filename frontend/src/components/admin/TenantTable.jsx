import React from 'react';
import { Building2, Users } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';

export const TenantTable = ({
  tenants,
  totalCount,
  currentPage,
  onPageChange,
  isLoading,
}) => {
  const totalPages = Math.ceil(totalCount / 20) || 1;

  return (
    <Card variant="bordered" className="shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <h3
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-lg font-bold text-[#292929] tracking-tight"
          >
            Tenant Fleet Management
          </h3>
          <Badge variant="lime">{totalCount} Organizations</Badge>
        </div>
      </div>

      {!isLoading && (!tenants || tenants.length === 0) ? (
        <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400">
          No tenant organizations registered on this platform yet.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          {/* Mobile Tenant List (< md) */}
          <div className="block md:hidden divide-y divide-gray-100 bg-white">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))
            ) : (
              (tenants || []).map((t) => (
                <div key={t.id} className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 size={16} className="text-gray-400 shrink-0" />
                      <span className="font-semibold text-xs text-[#292929] truncate">{t.name}</span>
                    </div>
                    <Badge variant={t.is_active ? 'green' : 'red'}>
                      {t.is_active ? 'ACTIVE' : 'SUSPENDED'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 text-[11px]">
                      <code>{t.slug}</code>
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="gray">{t.plan?.name || t.plan || 'Free'}</Badge>
                      <span className="text-gray-500 text-[11px] flex items-center gap-1">
                        <Users size={11} className="text-gray-400" />
                        {t.member_count ?? 0}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono pt-0.5 border-t border-gray-50">
                    <span className="text-gray-500 text-[11px]">
                      Req: <strong className="text-[#292929]">{Number(t.monthly_requests || 0).toLocaleString()}</strong>
                    </span>
                    <span className="text-emerald-700 font-semibold">
                      ${Number(t.monthly_cost || 0).toFixed(4)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 text-xs font-mono text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3.5">Organization</th>
                  <th className="px-5 py-3.5">Slug</th>
                  <th className="px-5 py-3.5">Plan Tier</th>
                  <th className="px-5 py-3.5">Members</th>
                  <th className="px-5 py-3.5">Requests (Mo)</th>
                  <th className="px-5 py-3.5">Cost Incurred</th>
                  <th className="px-5 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-12" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-16" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-16" /></td>
                      <td className="px-5 py-4 text-right"><Skeleton className="h-5 w-16 ml-auto rounded-full" /></td>
                    </tr>
                  ))
                ) : (
                  (tenants || []).map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-gray-400 shrink-0" />
                        <span className="font-semibold text-xs text-[#292929]">
                          {t.name}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 font-mono text-xs text-gray-500">
                      <code>{t.slug}</code>
                    </td>

                    <td className="px-5 py-3.5">
                      <Badge variant="gray">{t.plan?.name || t.plan || 'Free'}</Badge>
                    </td>

                    <td className="px-5 py-3.5 text-xs font-mono text-gray-600">
                      <div className="flex items-center gap-1">
                        <Users size={12} className="text-gray-400" />
                        <span>{t.member_count ?? 0}</span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 font-mono text-xs text-gray-600">
                      {Number(t.monthly_requests || 0).toLocaleString()}
                    </td>

                    <td className="px-5 py-3.5 font-mono text-xs text-emerald-700 font-semibold">
                      ${Number(t.monthly_cost || 0).toFixed(4)}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <Badge variant={t.is_active ? 'green' : 'red'}>
                        {t.is_active ? 'ACTIVE' : 'SUSPENDED'}
                      </Badge>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-500 pt-2">
        <span>
          Showing page <strong className="text-[#292929]">{currentPage}</strong> of{' '}
          <strong className="text-[#292929]">{totalPages}</strong>
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={currentPage <= 1 || isLoading}
            onClick={() => onPageChange(currentPage - 1)}
          >
            ← Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={currentPage >= totalPages || isLoading}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next →
          </Button>
        </div>
      </div>
    </Card>
  );
};
