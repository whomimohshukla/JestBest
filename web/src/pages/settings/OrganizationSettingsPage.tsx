import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationApi } from '../../api';
import { getErrorMessage } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { PageLoader } from '../../components/ui';
import { Building2, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OrganizationSettingsPage() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const updateOrganization = useAuthStore((s) => s.updateOrganization);
  const queryClient = useQueryClient();

  const { data: org, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['org', orgId],
    queryFn: () => organizationApi.get(orgId as string),
    enabled: Boolean(orgId),
  });

  const [form, setForm] = useState({ name: '', logo: '' });
  const [formInitialized, setFormInitialized] = useState(false);

  // Seed the form from the server response during render rather than in an
  // effect: an effect would commit one frame with the empty defaults and cause
  // a cascading render.
  if (org && !formInitialized) {
    setForm({ name: org.name ?? '', logo: org.logo ?? '' });
    setFormInitialized(true);
  }

  const updateOrgMutation = useMutation({
    mutationFn: (data: { name: string; logo: string }) =>
      organizationApi.update(orgId as string, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['org', orgId] });
      updateOrganization(updated);
      toast.success('Organization updated successfully! 🎉');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrgMutation.mutate(form);
  };

  if (isLoading && !org) {
    return <PageLoader label="Loading organization..." />;
  }

  if (isError && !org) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-red-500 font-medium mb-4">Failed to load your organization.</p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="glass p-6 rounded-xl max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-red-600/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Organization</h2>
            <p className="text-sm text-muted-foreground">Manage your organization details</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Organization Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Acme Corp"
              disabled={updateOrgMutation.isPending}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Slug</label>
            <input
              type="text"
              value={org?.slug ?? ''}
              disabled
              readOnly
              className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 opacity-60"
            />
            <p className="text-xs text-muted-foreground mt-1">Slug is fixed</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Logo URL</label>
            <input
              type="text"
              value={form.logo}
              onChange={(e) => setForm({ ...form, logo: e.target.value })}
              className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="https://example.com/logo.png"
              disabled={updateOrgMutation.isPending}
            />
            <p className="text-xs text-muted-foreground mt-1">Optional</p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={updateOrgMutation.isPending || !orgId}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-600/90 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {updateOrgMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}