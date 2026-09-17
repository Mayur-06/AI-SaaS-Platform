import React from 'react';

export const MemberList = ({
  members,
  currentUserId,
  currentUserRole,
  onUpdateRole,
  onRemoveMember,
  isLoading,
}) => {
  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin';

  return (
    <div className="card">
      <div className="card-header">
        <h3>Team Members ({(members || []).length})</h3>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Member Email</th>
              <th>Role</th>
              <th>Joined Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(members || []).filter(Boolean).map((m) => {
              const isOwner = m?.role === 'owner';
              const memberUserId = m?.user?.id || m?.user_id;
              const memberEmail = m?.user?.email || m?.user_email || 'Member';
              const isSelf = Boolean(memberUserId && currentUserId && memberUserId === currentUserId);
              // Admin cannot change owner
              const canEditThisMember =
                canManage && !isOwner && !(currentUserRole === 'admin' && m?.role === 'admin' && !isSelf);

              return (
                <tr key={m.id}>
                  <td>
                    <strong>{memberEmail}</strong>
                    {isSelf && <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '6px' }}>(You)</span>}
                  </td>
                  <td>
                    {canEditThisMember ? (
                      <select
                        value={m.role}
                        onChange={(e) => onUpdateRole(m.id, e.target.value)}
                        disabled={isLoading}
                        style={{ padding: '0.2rem 0.4rem', width: 'auto' }}
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className={`badge ${isOwner ? 'badge-active' : ''}`}>{String(m.role || 'member').toUpperCase()}</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    {canEditThisMember && !isSelf ? (
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${memberEmail} from organization?`)) {
                            onRemoveMember(m.id);
                          }
                        }}
                        className="btn-danger"
                        disabled={isLoading}
                        style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                      >
                        Remove
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: '#888' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
