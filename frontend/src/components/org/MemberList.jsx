import React, { useState } from 'react';
import { Users, Calendar, MoreHorizontal, Trash2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Avatar, AvatarFallback } from '../ui/Avatar';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '../ui/DropdownMenu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '../ui/AlertDialog';

export const MemberList = ({
  members,
  currentUserId,
  currentUserRole,
  onUpdateRole,
  onRemoveMember,
  isLoading,
}) => {
  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin';

  // AlertDialog state — tracks which member is pending removal
  const [pendingRemove, setPendingRemove] = useState(null); // { id, email }

  const handleConfirmRemove = async () => {
    if (!pendingRemove) return;
    try {
      await onRemoveMember(pendingRemove.id);
      // toast shown by parent handler; close dialog
    } catch {
      // error toast shown by parent handler
    } finally {
      setPendingRemove(null);
    }
  };

  return (
    <>
      <Card variant="bordered" className="shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h3
              style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
              className="text-lg font-bold text-[#292929] tracking-tight"
            >
              Team Members
            </h3>
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
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarFallback variant="lime">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-[#292929]">
                            {memberEmail}
                          </span>
                          {isSelf && (
                            <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              You
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      {canEditThisMember && m?.role !== 'admin' ? (
                        <Select
                          value={m.role}
                          onValueChange={(value) => {
                            onUpdateRole(m.id, value);
                            toast.success(`Role updated to ${value}.`);
                          }}
                          disabled={isLoading}
                        >
                          <SelectTrigger className="h-8 text-xs w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="p-1.5 text-gray-400 hover:text-[#292929] hover:bg-gray-100 rounded-lg transition-colors cursor-pointer outline-none"
                              title="Member actions"
                            >
                              <MoreHorizontal size={15} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Member Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              destructive
                              onClick={() => setPendingRemove({ id: m.id, email: memberEmail })}
                            >
                              <Trash2 size={13} />
                              Delete account
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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

      {/* Confirm Remove Member Dialog */}
      <AlertDialog
        open={Boolean(pendingRemove)}
        onOpenChange={(open) => { if (!open) setPendingRemove(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong className="text-red-600">permanently delete</strong> the account for{' '}
              <strong>{pendingRemove?.email}</strong>. They will no longer be able to log in and this action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              onClick={handleConfirmRemove}
              disabled={isLoading}
            >
              {isLoading ? 'Deleting…' : 'Delete account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
