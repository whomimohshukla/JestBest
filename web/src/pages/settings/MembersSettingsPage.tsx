import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationApi } from '../../api';
import { getErrorMessage } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { PageLoader, Select, FieldError, ButtonLoader, useConfirm } from '../../components/ui';
import { Mail, RefreshCw, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Membership, MembershipRole } from '../../types';

const ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'QA_MANAGER', 'DEVELOPER', 'TESTER', 'VIEWER'];

export default function MembersSettingsPage() {
  const confirm = useConfirm();
  const orgId = useAuthStore((s) => s.organization?.id);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const [invite, setInvite] = useState<{ email: string; role: MembershipRole }>({
    email: '',
    role: 'DEVELOPER',
  });
  const [inviteError, setInviteError] = useState<string | null>(null);

  const { data: members, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['org-members', orgId],
    queryFn: () => organizationApi.members(orgId as string),
    enabled: Boolean(orgId),
  });

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: MembershipRole }) =>
      organizationApi.inviteMember(orgId as string, data.email, data.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members', orgId] });
      setInvite({ email: '', role: 'DEVELOPER' });
      toast.success('Invitation sent!');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: MembershipRole }) =>
      organizationApi.changeRole(orgId as string, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members', orgId] });
      toast.success('Member role updated');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => organizationApi.removeMember(orgId as string, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members', orgId] });
      toast.success('Member removed');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const email = invite.email.trim();
    if (!email) {
      setInviteError('Enter the email address to invite.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError('Enter a valid email address.');
      return;
    }
    setInviteError(null);
    inviteMutation.mutate({ ...invite, email });
  };

  const handleRoleChange = (member: Membership, role: MembershipRole) => {
    if (!member.user?.id) return;
    changeRoleMutation.mutate({ userId: member.user.id, role });
  };

  const handleRemove = async (member: Membership) => {
    if (!member.user?.id) return;
    const ok = await confirm({
      title: 'Remove member',
      message: `Remove ${member.user.name ?? member.user.email} from this organization? They will lose access immediately.`,
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    removeMemberMutation.mutate(member.user.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="glass p-6 rounded-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-600/10 flex items-center justify-center">
            <Mail className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-1">Invite Member</h2>
            <p className="text-sm text-muted-foreground">Send an invitation to join your organization</p>
          </div>
        </div>

        <form onSubmit={handleInvite} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              id="invite-email"
              type="email"
              value={invite.email}
              onChange={(e) => {
                setInvite({ ...invite, email: e.target.value });
                if (inviteError) setInviteError(null);
              }}
              placeholder="teammate@company.com"
              className={`w-full px-4 py-3 bg-secondary/50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${inviteError ? 'border-red-500/70 ring-1 ring-red-500/40' : 'border-border'}`}
              disabled={inviteMutation.isPending}
              aria-invalid={!!inviteError}
              aria-describedby={inviteError ? 'invite-email-error' : undefined}
              required
            />
            <FieldError id="invite-email-error">{inviteError}</FieldError>
          </div>
          <Select
            value={invite.role}
            onChange={(e) => setInvite({ ...invite, role: e.target.value as MembershipRole })}
            className="w-full md:w-56 px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            disabled={inviteMutation.isPending}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </Select>
          <button
            type="submit"
            disabled={inviteMutation.isPending}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-600/90 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {inviteMutation.isPending ? (
              <>
                <ButtonLoader />
                Sending...
              </>
            ) : (
              'Send Invite'
            )}
          </button>
        </form>
      </div>

      <div className="glass p-6 rounded-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-600/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-1">Members</h2>
            <p className="text-sm text-muted-foreground">Manage roles and access for your team</p>
          </div>
        </div>

        {isLoading && <PageLoader label="Loading members..." />}

        {!isLoading && isError && (
          <div className="rounded-xl border border-border bg-secondary/30 p-6 text-center">
            <p className="text-red-500 font-medium mb-4">Failed to load members.</p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors text-sm font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && (!members || members.length === 0) && (
          <p className="text-sm text-muted-foreground py-6 text-center">No members yet.</p>
        )}

        {!isLoading && !isError && members && members.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-3 pr-4 font-medium">Member</th>
                  <th className="py-3 pr-4 font-medium">Email</th>
                  <th className="py-3 pr-4 font-medium">Role</th>
                  <th className="py-3 pr-4 font-medium">Member Since</th>
                  <th className="py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const isSelf = member.user?.id === currentUserId;
                  return (
                    <tr key={member.id} className="border-b border-border/50">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          {member.user?.avatar ? (
                            <img
                              src={member.user.avatar}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center text-xs font-semibold text-white">
                              {(member.user?.name ?? member.user?.email ?? '?')[0]?.toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium">
                            {member.user?.name ?? member.user?.email ?? 'Unknown'}
                            {isSelf && <span className="text-xs text-muted-foreground ml-2">(you)</span>}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{member.user?.email ?? '—'}</td>
                      <td className="py-3 pr-4">
                        <Select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member, e.target.value as MembershipRole)}
                          className="px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleRemove(member)}
                          disabled={isSelf}
                          title={isSelf ? "You can't remove yourself" : 'Remove member'}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}