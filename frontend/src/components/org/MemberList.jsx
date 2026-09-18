import React from 'react';
import { Users, Calendar, Trash2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

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
    <Card variant="bordered" className="shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <h3
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-lg font-bold text-[#292929] tracking-tight"
          >
            Team Members
          </h3>
          <Badge variant="lime">{(members || []).length} Active</Badge>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50/80 text-xs font-mono text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="px-5 py-3.5">Member</th>
              <th className="px-5 py-3.5">Assigned Role</th>
              <th className="px-5 py-3.5">Joined Date</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {(members || []).filter(Boolean).map((m) => {
              const isOwner = m?.role === 'owner';
              const memberUserId = m?.user?.id || m?.user_id;
              const memberEmail = m?.user?.email || m?.user_email || 'Member';
              const isSelf = Boolean(memberUserId && currentUserId && memberUserId === currentUserId);
              const canEditThisMember =
                canManage && !isOwner && !(currentUserRole === 'admin' && m?.role === 'admin' && !isSelf);

              const initials = memberEmail.slice(0, 2).toUpperCase();

              return (
                <tr key={m.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#b2c147]/20 text-[#292929] font-bold text-xs flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-[#292929]">
                          {memberEmail}
                        </span>
                        {isSelf && (
                          <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.2 rounded">
                            You
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-3.5">
                    {canEditThisMember ? (
                      <select
                        value={m.role}
                        onChange={(e) => onUpdateRole(m.id, e.target.value)}
                        disabled={isLoading}
                        className="px-2.5 py-1 border border-gray-200 rounded-lg text-xs bg-white text-[#292929] focus:outline-none focus:ring-2 focus:ring-[#b2c147]"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <Badge variant={isOwner ? 'lime' : m.role === 'admin' ? 'purple' : 'gray'}>
                        {String(m.role || 'member').toUpperCase()}
                      </Badge>
                    )}
                  </td>

                  <td className="px-5 py-3.5 text-xs font-mono text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-gray-400" />
                      <span>{m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '—'}</span>
                    </div>
                  </td>

                  <td className="px-5 py-3.5 text-right">
                    {canEditThisMember && !isSelf ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remove ${memberEmail} from this organization?`)) {
                            onRemoveMember(m.id);
                          }
                        }}
                        disabled={isLoading}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Remove member"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
