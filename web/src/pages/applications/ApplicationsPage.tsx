import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, applicationsApi } from '../../api';
import { getErrorMessage } from '../../api/client';
import Layout from '../../components/Layout';
import { PageLoader, Select, EmptyState, Badge } from '../../components/ui';
import {
  Plus,
  Globe,
  FolderKanban,
  Trash2,
  ScanSearch,
  Loader2,
  Layers,
  Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Application } from '../../types';

const APPLICATION_TYPES = ['WEB', 'MOBILE', 'API', 'BROWSER_EXTENSION'];

export default function ApplicationsPage() {
  const [searchParams] = useSearchParams();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    searchParams.get('projectId')
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newApp, setNewApp] = useState({
    name: '',
    baseUrl: '',
    description: '',
    type: 'WEB',
  });
  const queryClient = useQueryClient();

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list({ pageSize: 100 }),
  });

  const { data: applications, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['applications', selectedProjectId],
    queryFn: () => applicationsApi.list(selectedProjectId as string),
    enabled: !!selectedProjectId,
  });

  const projectsError = projectsData === undefined && !projectsLoading;

  const createMutation = useMutation({
    mutationFn: (data: { projectId: string; name: string; baseUrl: string; description?: string; type?: string }) =>
      applicationsApi.create(data),
    onSuccess: () => {
      if (selectedProjectId) {
        queryClient.invalidateQueries({ queryKey: ['applications', selectedProjectId] });
      }
      toast.success('Application created successfully! 🎉');
      setShowCreateModal(false);
      setNewApp({ name: '', baseUrl: '', description: '', type: 'WEB' });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const scanMutation = useMutation({
    mutationFn: (id: string) => applicationsApi.scan(id),
    onSuccess: () => {
      toast.success('Scan queued');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => applicationsApi.remove(id),
    onSuccess: () => {
      if (selectedProjectId) {
        queryClient.invalidateQueries({ queryKey: ['applications', selectedProjectId] });
      }
      toast.success('Application deleted');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    createMutation.mutate({
      projectId: selectedProjectId,
      name: newApp.name,
      baseUrl: newApp.baseUrl,
      description: newApp.description || undefined,
      type: newApp.type,
    });
  };

  const handleDelete = (app: Application) => {
    if (window.confirm(`Delete application "${app.name}"?`)) {
      deleteMutation.mutate(app.id);
    }
  };

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 gradient-text">Applications</h1>
            <p className="text-muted-foreground">Manage applications across your projects</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!selectedProjectId}
            className="flex items-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-5 h-5" />
            New Application
          </button>
        </div>

        {/* Project Selector */}
        <div className="mb-8">
          <Select
            value={selectedProjectId ?? ''}
            onChange={(e) => setSelectedProjectId(e.target.value || null)}
            className="w-full md:w-64 px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60"
            disabled={projectsLoading}
          >
            <option value="">{projectsLoading ? 'Loading projects…' : 'Select a project…'}</option>
            {(projectsData?.items ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Loading State */}
        {isLoading && <PageLoader label="Loading applications..." />}

        {/* Query error */}
        {isError && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <p className="text-sm font-medium text-red-400">Failed to load applications.</p>
            <p className="text-sm text-muted-foreground">{projectsError ? '' : 'Check your connection and try again.'}</p>            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 transition-colors disabled:opacity-50"
            >
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Retry
            </button>
          </div>
        )}

        {/* No project selected */}
        {!isLoading && !selectedProjectId && (
          <EmptyState
            icon={FolderKanban}
            title="Select a project to view its applications"
            description="Choose a project from the dropdown above to see its registered applications."
          />
        )}

        {/* Empty list */}
        {!isLoading && !isError && selectedProjectId && (!applications || applications.length === 0) && (
          <EmptyState
            icon={Layers}
            title="No applications yet"
            description="Register your first application to start scanning it for bugs."
            action={
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-600/90 text-white rounded-lg text-sm font-medium inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Application
              </button>
            }
          />
        )}

        {/* Applications Grid */}
        {!isLoading && !isError && selectedProjectId && applications && applications.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {applications.map((app, index) => (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass p-6 rounded-xl hover:shadow-lg transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-red-600/10 rounded-lg flex items-center justify-center">
                    <Globe className="w-6 h-6 text-red-500" />
                  </div>
                  <Badge variant={app.isActive ? 'success' : 'destructive'}>
                    {app.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <h3 className="text-xl font-semibold mb-2">{app.name}</h3>
                <Link
                  to={app.baseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-red-500 hover:underline mb-3 truncate block"
                >
                  {app.baseUrl}
                </Link>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {app.description || 'No description provided'}
                </p>

                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <Badge variant="secondary">{app.type}</Badge>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(app.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-border">
                  <button
                    onClick={() => scanMutation.mutate(app.id)}
                    disabled={scanMutation.isPending}
                    className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-600/90 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {scanMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ScanSearch className="w-4 h-4" />
                    )}
                    Scan
                  </button>
                  <button
                    onClick={() => handleDelete(app)}
                    className="px-3 py-2 bg-secondary hover:bg-secondary/80 text-sm rounded-lg transition-colors text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Create Application Modal */}
      {showCreateModal && selectedProjectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md glass p-8 rounded-2xl"
          >
            <h2 className="text-2xl font-bold mb-2">Add Application</h2>
            <p className="text-muted-foreground text-sm mb-6">Register a new application for this project</p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Application Name</label>
                <input
                  type="text"
                  value={newApp.name}
                  onChange={(e) => setNewApp({ ...newApp, name: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Storefront Web"
                  required
                  disabled={createMutation.isPending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Base URL</label>
                <input
                  type="url"
                  value={newApp.baseUrl}
                  onChange={(e) => setNewApp({ ...newApp, baseUrl: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="https://example.com"
                  required
                  disabled={createMutation.isPending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={newApp.description}
                  onChange={(e) => setNewApp({ ...newApp, description: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  placeholder="Short description of the application..."
                  rows={3}
                  disabled={createMutation.isPending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Type</label>
                <Select
                  value={newApp.type}
                  onChange={(e) => setNewApp({ ...newApp, type: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={createMutation.isPending}
                >
                  {APPLICATION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
                  disabled={createMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Application'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </Layout>
  );
}