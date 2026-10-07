import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, organizationApi } from '../api';
import { getErrorMessage } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { Building2, Check, Loader2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Workspace picker for accounts that belong to more than one organization.
 *
 * Switching is a token exchange, not a filter: the returned pair replaces the
 * session (the access token carries the new orgId claim) and the whole query
 * cache is dropped, because every cached key — project lists, dashboards,
 * pagination cursors — was resolved against the workspace we just left.
 */
export function WorkspaceSwitcher({
  currentOrganizationId,
}: {
  currentOrganizationId?: string | null;
}) {
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  const { data: organizations, isLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizationApi.listMine(),
  });

  const switchMutation = useMutation({
    mutationFn: (organizationId: string) => authApi.switchOrganization(organizationId),
    onSuccess: (result) => {
      setAuth(result);
      queryClient.clear();
      toast.success(`Switched to ${result.organization?.name ?? 'workspace'}`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => organizationApi.create({ name }),
    onSuccess: (organization) => {
      setNewWorkspaceName('');
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      // Land in the workspace that was just created instead of making the user
      // click through a list that only grew by one entry.
      switchMutation.mutate(organization.id);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    const name = newWorkspaceName.trim();
    if (!name) return;
    createMutation.mutate(name);
  };

  const isSwitching = switchMutation.isPending || createMutation.isPending;

  return (
    <section
      aria-labelledby="workspaces-heading"
      className="glass p-6 rounded-xl max-w-2xl mt-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-red-600/10 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-red-500" aria-hidden="true" />
        </div>
        <div>
          <h3 id="workspaces-heading" className="text-lg font-semibold">
            Workspaces
          </h3>
          <p className="text-sm text-muted-foreground">
            One account, several organizations. Switching re-issues your session
            for the selected workspace.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading workspaces...</p>
      ) : (
        <ul className="space-y-2">
          {(organizations ?? []).map((organization) => {
            const isCurrent = organization.id === currentOrganizationId;
            return (
              <li
                key={organization.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
              >
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <Building2
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="truncate">{organization.name}</span>
                </span>
                {isCurrent ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    Current
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => switchMutation.mutate(organization.id)}
                    disabled={isSwitching}
                    aria-label={`Switch to ${organization.name}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary/60 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {switchMutation.isPending &&
                      switchMutation.variables === organization.id && (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      )}
                    Switch
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleCreate} className="mt-5 flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="new-workspace" className="block text-sm font-medium mb-2">
            New workspace
          </label>
          <input
            id="new-workspace"
            type="text"
            value={newWorkspaceName}
            onChange={(event) => setNewWorkspaceName(event.target.value)}
            placeholder="Side Project Ltd"
            disabled={isSwitching}
            className="w-full px-4 py-2.5 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <button
          type="submit"
          disabled={isSwitching || !newWorkspaceName.trim()}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-600/90 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {createMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="h-4 w-4" aria-hidden="true" />
          )}
          Create
        </button>
      </form>
    </section>
  );
}
