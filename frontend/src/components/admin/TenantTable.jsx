import React from 'react';
import { Building2, Users } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

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

      {isLoading ? (
        <div className="text-center py-10 text-xs text-gray-400">Loading registered tenant organizations…</div>
      ) : !tenants || tenants.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400">
          No tenant organizations registered on this platform yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
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
              {tenants.map((t) => (
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
              ))}
            </tbody>
          </table>
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
