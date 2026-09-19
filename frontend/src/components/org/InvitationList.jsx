import React, { useState } from 'react';
import { Mail, Clock, Trash2, MoreHorizontal } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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

export const InvitationList = ({
  invitations = [],
  canManage = false,
  onRevoke,
  isLoading = false,
}) => {
  const [pendingRevoke, setPendingRevoke] = useState(null); // { id, email }
  const pendingInvites = invitations.filter((inv) => !inv.accepted_at);

  const handleConfirmRevoke = async () => {
    if (!pendingRevoke) return;
    try {
      await onRevoke(pendingRevoke.id);
    } finally {
      setPendingRevoke(null);
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
              Pending Invitations
            </h3>
          </div>
        </div>

        {pendingInvites.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400">
            No pending invitations. Click &ldquo;+ Invite Team Member&rdquo; above to dispatch new tokens.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 text-xs font-mono text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3.5">Invited Email</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Expires</th>
                  <th className="px-5 py-3.5">Status</th>
                  {canManage && <th className="px-5 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {pendingInvites.map((inv) => {
                  const isExpired = new Date(inv.expires_at) < new Date();

                  return (
                    <tr key={inv.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <Mail size={15} className="text-gray-400" />
                          <span className="font-semibold text-xs text-[#292929]">
                            {inv.email}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <Badge variant={inv.role === 'admin' ? 'purple' : 'gray'}>
                          {String(inv.role).toUpperCase()}
                        </Badge>
                      </td>

                      <td className="px-5 py-3.5 text-xs font-mono text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-gray-400" />
                          <span>{new Date(inv.expires_at).toLocaleDateString()}</span>
                          {isExpired && (
                            <span className="text-red-600 font-semibold text-[10px] bg-red-50 px-1.5 py-0.2 rounded">
                              Expired
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <Badge variant={isExpired ? 'red' : 'lime'}>
                          {isExpired ? 'EXPIRED' : 'PENDING'}
                        </Badge>
                      </td>

                      {canManage && (
                        <td className="px-5 py-3.5 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="p-1.5 text-gray-400 hover:text-[#292929] hover:bg-gray-100 rounded-lg transition-colors cursor-pointer outline-none"
                                title="Invitation actions"
                              >
                                <MoreHorizontal size={15} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Invitation Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                destructive
                                onClick={() => setPendingRevoke({ id: inv.id, email: inv.email })}
                              >
                                <Trash2 size={13} />
                                Revoke Invitation
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Revoke Invitation AlertDialog */}
      <AlertDialog
        open={Boolean(pendingRevoke)}
        onOpenChange={(open) => { if (!open) setPendingRevoke(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke the invitation token for{' '}
              <strong>{pendingRevoke?.email}</strong>? They will no longer be able to use the link to join the organization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              onClick={handleConfirmRevoke}
              disabled={isLoading}
            >
              {isLoading ? 'Revoking…' : 'Revoke invitation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
