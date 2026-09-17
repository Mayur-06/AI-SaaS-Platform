import React, { useState } from 'react';

export const KeyList = ({
  keys,
  onRevoke,
  onRegenerate,
  onUpdate,
  isLoading,
  canManage,
}) => {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPerm, setEditPerm] = useState('write');

  const startEdit = (k) => {
    setEditingId(k.id);
    setEditName(k.name);
    setEditPerm(k.permissions);
  };

  const saveEdit = async (id) => {
    await onUpdate(id, editName, editPerm);
    setEditingId(null);
  };

  if (!keys || keys.length === 0) {
    return (
      <div className="card">
        <p style={{ color: '#777', fontStyle: 'italic', padding: '1rem' }}>
          {canManage
            ? 'No API keys created yet. Click "Generate New Key" above to create one.'
            : 'No API keys have been created for this organization yet.'}
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Key Name</th>
              <th>Prefix</th>
              <th>Permissions</th>
              <th>Rate Limit</th>
              <th>Status</th>
              <th>Created</th>
              <th>Last Used</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} style={{ opacity: k.is_active ? 1 : 0.6 }}>
                <td>
                  {editingId === k.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{ padding: '0.2rem', width: '120px' }}
                    />
                  ) : (
                    <strong>{k.name}</strong>
                  )}
                </td>
                <td>
                  <code>{k.key_prefix}...</code>
                </td>
                <td>
                  {editingId === k.id ? (
                    <select
                      value={editPerm}
                      onChange={(e) => setEditPerm(e.target.value)}
                      style={{ padding: '0.2rem' }}
                    >
                      <option value="write">write</option>
                      <option value="read">read</option>
                      <option value="admin">admin</option>
                    </select>
                  ) : (
                    <span className="badge">{k.permissions}</span>
                  )}
                </td>
                <td>
                  {k.rate_limit_override ? `${k.rate_limit_override} RPM` : <span style={{ color: '#888' }}>Plan limit</span>}
                </td>
                <td>
                  {k.is_active ? (
                    <span className="badge badge-active">ACTIVE</span>
                  ) : (
                    <span className="badge" style={{ color: '#900' }}>REVOKED</span>
                  )}
                </td>
                <td style={{ fontSize: '0.8rem' }}>
                  {new Date(k.created_at).toLocaleDateString()}
                </td>
                <td style={{ fontSize: '0.8rem' }}>
                  {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
                </td>
                <td>
                  {canManage && k.is_active ? (
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      {editingId === k.id ? (
                        <>
                          <button
                            onClick={() => saveEdit(k.id)}
                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                            disabled={isLoading}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(k)}
                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                            title="Edit key settings"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => onRegenerate(k.id)}
                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                            title="Regenerate key and revoke previous"
                            disabled={isLoading}
                          >
                            Regen
                          </button>
                          <button
                            onClick={() => onRevoke(k.id)}
                            className="btn-danger"
                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                            title="Immediately revoke key"
                            disabled={isLoading}
                          >
                            Revoke
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: '#999' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
