import React, { useState } from 'react';
import { Key, Calendar, Clock, RefreshCw, Trash2, Edit2, Check, X } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

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
      <Card variant="bordered" className="text-center py-12 border-dashed border-gray-200">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
          <Key size={22} />
        </div>
        <h3
          style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
          className="text-base font-bold text-[#292929] mb-1"
        >
          No Active API Keys
        </h3>
        <p className="text-xs text-gray-500 max-w-sm mx-auto">
          {canManage
            ? 'Generate programmatic API credentials above to connect your backend services, microservices, or local scripts.'
            : 'No API credentials have been created for this organization.'}
        </p>
      </Card>
    );
  }

  return (
    <Card variant="bordered" className="shadow-sm overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50/80 text-xs font-mono text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="px-5 py-3.5">Key Name</th>
              <th className="px-5 py-3.5">Prefix</th>
              <th className="px-5 py-3.5">Permissions</th>
              <th className="px-5 py-3.5">Rate Limit</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5">Created</th>
              <th className="px-5 py-3.5">Last Used</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {keys.map((k) => (
              <tr key={k.id} className={`hover:bg-gray-50/80 transition-colors ${!k.is_active ? 'opacity-60 bg-gray-50/40' : ''}`}>
                <td className="px-5 py-3.5">
                  {editingId === k.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="px-2.5 py-1 border border-gray-300 rounded-lg text-xs w-36 bg-white focus:ring-2 focus:ring-[#b2c147] focus:outline-none"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Key size={15} className="text-gray-400 shrink-0" />
                      <span className="font-semibold text-xs text-[#292929]">
                        {k.name}
                      </span>
                    </div>
                  )}
                </td>

                <td className="px-5 py-3.5 font-mono text-xs text-gray-600">
                  <code>{k.key_prefix}••••••••</code>
                </td>

                <td className="px-5 py-3.5">
                  {editingId === k.id ? (
                    <select
                      value={editPerm}
                      onChange={(e) => setEditPerm(e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#b2c147]"
                    >
                      <option value="write">write</option>
                      <option value="read">read</option>
                      <option value="admin">admin</option>
                    </select>
                  ) : (
                    <Badge variant={k.permissions === 'admin' ? 'purple' : 'gray'}>
                      {k.permissions}
                    </Badge>
                  )}
                </td>

                <td className="px-5 py-3.5 font-mono text-xs text-gray-600">
                  {k.rate_limit_override ? (
                    <span>{k.rate_limit_override} RPM</span>
                  ) : (
                    <span className="text-gray-400">Plan limit</span>
                  )}
                </td>

                <td className="px-5 py-3.5">
                  <Badge variant={k.is_active ? 'green' : 'red'}>
                    {k.is_active ? 'ACTIVE' : 'REVOKED'}
                  </Badge>
                </td>

                <td className="px-5 py-3.5 text-xs font-mono text-gray-500">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} className="text-gray-400" />
                    <span>{new Date(k.created_at).toLocaleDateString()}</span>
                  </div>
                </td>

                <td className="px-5 py-3.5 text-xs font-mono text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock size={12} className="text-gray-400" />
                    <span>{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}</span>
                  </div>
                </td>

                <td className="px-5 py-3.5 text-right">
                  {canManage && k.is_active ? (
                    <div className="flex items-center justify-end gap-1.5">
                      {editingId === k.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => saveEdit(k.id)}
                            disabled={isLoading}
                            className="p-1 text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer"
                            title="Save changes"
                          >
                            <Check size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                            title="Cancel"
                          >
                            <X size={15} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(k)}
                            className="p-1 text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit key name or permissions"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRegenerate(k.id)}
                            disabled={isLoading}
                            className="p-1 text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                            title="Regenerate key secret and invalidate old"
                          >
                            <RefreshCw size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRevoke(k.id)}
                            disabled={isLoading}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Immediately revoke access"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
