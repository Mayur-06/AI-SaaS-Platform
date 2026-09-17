import React from 'react';

export const InvitationList = ({
  invitations = [],
  canManage = false,
  onRevoke,
  isLoading = false,
}) => {
  const pendingInvites = invitations.filter((inv) => !inv.accepted_at);

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Pending Invitations ({pendingInvites.length})</h3>
      </div>

      {pendingInvites.length === 0 ? (
        <p style={{ color: '#777', fontStyle: 'italic', padding: '1rem 0' }}>
          No pending invitations. Use the "+ Invite Team Member" button above to send invitations.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Invited Email</th>
                <th>Role</th>
                <th>Expires</th>
                <th>Status</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {pendingInvites.map((inv) => {
                const isExpired = new Date(inv.expires_at) < new Date();
                return (
                  <tr key={inv.id}>
                    <td>
                      <strong>{inv.email}</strong>
                    </td>
                    <td>
                      <span className="badge badge-active">{String(inv.role).toUpperCase()}</span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {new Date(inv.expires_at).toLocaleDateString()}
                      {isExpired && (
                        <span style={{ color: '#a8071a', marginLeft: '6px', fontSize: '0.75rem' }}>(Expired)</span>
                      )}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: isExpired ? '#fff1f0' : '#e6f7ff',
                          color: isExpired ? '#a8071a' : '#0958d9',
                        }}
                      >
                        {isExpired ? 'EXPIRED' : 'PENDING'}
                      </span>
                    </td>
                    {canManage && (
                      <td>
                        <button
                          onClick={() => {
                            if (confirm(`Revoke invitation for ${inv.email}?`)) {
                              onRevoke(inv.id);
                            }
                          }}
                          className="btn-danger"
                          disabled={isLoading}
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          Revoke
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
