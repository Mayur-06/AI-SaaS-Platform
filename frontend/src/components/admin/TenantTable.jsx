import React from 'react';

export const TenantTable = ({
  tenants,
  totalCount,
  currentPage,
  onPageChange,
  isLoading,
}) => {
  const totalPages = Math.ceil(totalCount / 20) || 1;

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Tenant Fleet Management ({totalCount} Organizations)</h3>
      </div>

      {isLoading ? (
        <p style={{ color: '#777', padding: '1rem' }}>Loading tenants...</p>
      ) : !tenants || tenants.length === 0 ? (
        <p style={{ color: '#777', fontStyle: 'italic', padding: '1rem' }}>No tenant organizations registered yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Organization</th>
                <th>Slug</th>
                <th>Plan Tier</th>
                <th>Members</th>
                <th>Monthly Requests</th>
                <th>Monthly Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.name}</strong></td>
                  <td><code>{t.slug}</code></td>
                  <td>
                    <span className="badge badge-active">{t.plan?.name || t.plan || 'Free'}</span>
                  </td>
                  <td>{t.member_count}</td>
                  <td>{t.monthly_requests?.toLocaleString?.() ?? t.monthly_requests}</td>
                  <td>${Number(t.monthly_cost).toFixed(4)}</td>
                  <td>
                    {t.is_active ? (
                      <span className="badge badge-active">ACTIVE</span>
                    ) : (
                      <span className="badge" style={{ color: '#900' }}>SUSPENDED</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="pagination" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.85rem', color: '#666' }}>
          Page {currentPage} of {totalPages}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            disabled={currentPage <= 1 || isLoading}
            onClick={() => onPageChange(currentPage - 1)}
            style={{ padding: '0.25rem 0.5rem' }}
          >
            Previous
          </button>
          <button
            disabled={currentPage >= totalPages || isLoading}
            onClick={() => onPageChange(currentPage + 1)}
            style={{ padding: '0.25rem 0.5rem' }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
