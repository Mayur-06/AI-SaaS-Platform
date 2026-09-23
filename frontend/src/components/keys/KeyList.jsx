import React, { useState } from 'react';
import { Key, Calendar, Clock, RefreshCw, Trash2, Edit2, Check, X, MoreHorizontal } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../ui/Select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../ui/DropdownMenu';

const getBadgeVariant = (perm) => {
  if (perm === 'admin' || perm === 'admin:*') return 'purple';
  if (perm === 'write') return 'green';
  if (perm === 'rag:query') return 'blue';
  if (perm === 'documents:write') return 'orange';
  return 'gray';
};

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

  const activeKeys = (keys || []).filter((k) => k && k.is_active !== false);

  if (activeKeys.length === 0) {
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
      {/* Mobile Card List (< md) */}
      <div className="block md:hidden divide-y divide-gray-100">
        {activeKeys.map((k) => (
          <div key={k.id} className="p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Key size={16} className="text-gray-400 shrink-0" />
                {editingId === k.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="px-2.5 py-1 border border-gray-300 rounded-lg text-xs w-full max-w-[150px] bg-white focus:ring-2 focus:ring-[#b2c147] focus:outline-none"
                  />
                ) : (
                  <span className="font-semibold text-xs text-[#292929] truncate">{k.name}</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={k.is_active ? 'green' : 'red'}>
                  {k.is_active ? 'ACTIVE' : 'REVOKED'}
                </Badge>
                {canManage && k.is_active && (
                  editingId === k.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => saveEdit(k.id)}
                        disabled={isLoading}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Save changes"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Cancel"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-1.5 text-gray-400 hover:text-[#292929] hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Key Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => startEdit(k)}>
                          <Edit2 size={13} />
                          Edit Name &amp; Permissions
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onRegenerate(k.id)}>
                          <RefreshCw size={13} />
                          Regenerate Secret
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem destructive onClick={() => onRevoke(k.id)}>
                          <Trash2 size={13} />
                          Revoke Key
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )
                )}
              </div>
            </div>

            {/* Prefix & Permission Row */}
            <div className="flex items-center justify-between text-xs font-mono pt-0.5">
              <span className="text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded text-[11px]">
                <code>{k.key_prefix}••••••••</code>
              </span>
              <div className="flex items-center gap-1.5">
                {editingId === k.id ? (
                  <Select value={editPerm} onValueChange={setEditPerm}>
                    <SelectTrigger className="h-7 text-xs w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="write">write</SelectItem>
                      <SelectItem value="rag:query">rag:query</SelectItem>
                      <SelectItem value="documents:write">documents:write</SelectItem>
                      <SelectItem value="documents:read">documents:read</SelectItem>
                      <SelectItem value="admin">admin</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant={getBadgeVariant(k.permissions)}>
                    {k.permissions}
                  </Badge>
                )}
                <span className="text-gray-400 font-mono text-[11px]">
                  {k.rate_limit_override ? `${k.rate_limit_override} RPM` : 'Plan limit'}
                </span>
              </div>
            </div>

            {/* Timestamps Row */}
            <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono pt-0.5">
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                {new Date(k.created_at).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View (>= md) */}
      <div className="hidden md:block overflow-x-auto">
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
            {activeKeys.map((k) => (
              <tr key={k.id} className="hover:bg-gray-50/80 transition-colors">
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
                    <Select value={editPerm} onValueChange={setEditPerm}>
                      <SelectTrigger className="h-7 text-xs w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="write">write</SelectItem>
                        <SelectItem value="rag:query">rag:query</SelectItem>
                        <SelectItem value="documents:write">documents:write</SelectItem>
                        <SelectItem value="documents:read">documents:read</SelectItem>
                        <SelectItem value="admin">admin</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={getBadgeVariant(k.permissions)}>
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="p-1.5 text-gray-400 hover:text-[#292929] hover:bg-gray-100 rounded-lg transition-colors cursor-pointer outline-none"
                              title="Key actions"
                            >
                              <MoreHorizontal size={15} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Key Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => startEdit(k)}>
                              <Edit2 size={13} />
                              Edit Name &amp; Permissions
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onRegenerate(k.id)}>
                              <RefreshCw size={13} />
                              Regenerate Secret
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem destructive onClick={() => onRevoke(k.id)}>
                              <Trash2 size={13} />
                              Revoke Key
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
