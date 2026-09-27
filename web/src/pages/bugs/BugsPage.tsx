import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, bugsApi } from '../../api';
import { getErrorMessage } from '../../api/client';
import Layout from '../../components/Layout';
import {
  PageLoader,
  EmptyState,
  Select,
  SeverityBadge,
  PriorityBadge,
  BugStatusBadge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui';
import { Plus, Search, Bug, Trash2, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Bug as BugType, BugSeverity, BugPriority } from '../../types';

const SEVERITIES: BugSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const PRIORITIES: BugPriority[] = ['P0', 'P1', 'P2', 'P3'];

export default function BugsPage() {
  const [searchParams] = useSearchParams();
  const [selectedProjectId, setSelectedProjectId] = useState(searchParams.get('projectId') ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBug, setNewBug] = useState<{
    title: string;
    description: string;
    severity: BugSeverity;
    priority: BugPriority;
    projectId: string;
  }>({
    title: '',
    description: '',
    severity: 'MEDIUM',
    priority: 'P2',
    projectId: '',
  });
  const queryClient = useQueryClient();

  // Fetch projects for filter and create modal
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list({ pageSize: 100 }),
  });

  // Fetch bugs
  const { data: bugsData, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['bugs', selectedProjectId],
    queryFn: () =>
      bugsApi.list(selectedProjectId ? { projectId: selectedProjectId, pageSize: 100 } : { pageSize: 100 }),
  });

  const bugs = (bugsData?.items ?? []).filter((bug) =>
    bug.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Create bug mutation
  const createBugMutation = useMutation({
    mutationFn: (data: {
      title: string;
      description: string;
      severity: BugSeverity;
      priority: BugPriority;
      projectId: string;
    }) => bugsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bugs'] });
      toast.success('Bug reported successfully! 🎉');
      setShowCreateModal(false);
      setNewBug({ title: '', description: '', severity: 'MEDIUM', priority: 'P2', projectId: selectedProjectId });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  // Delete bug mutation
  const deleteBugMutation = useMutation({
    mutationFn: (id: string) => bugsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bugs'] });
      toast.success('Bug deleted');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleCreateBug = (e: React.FormEvent) => {
    e.preventDefault();
    createBugMutation.mutate(newBug);
  };

  const handleDelete = (bug: BugType) => {
    if (window.confirm(`Delete bug "${bug.title}"?`)) {
      deleteBugMutation.mutate(bug.id);
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
            <h1 className="text-4xl font-bold mb-2 gradient-text">Bugs</h1>
            <p className="text-muted-foreground">Track and manage discovered bugs</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            New Bug
          </button>
        </div>

        {/* Filters */}
        <div className="space-y-4 mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search bugs by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <Select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full md:w-64 px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">All Projects</option>
            {(projectsData?.items ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Loading State */}
        {isLoading && <PageLoader label="Loading bugs..." />}

        {/* Error State */}
        {!isLoading && isError && (
          <div className="glass rounded-xl p-8 text-center">
            <p className="text-red-500 font-medium mb-4">Failed to load bugs.</p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors text-sm font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && bugs.length === 0 && (
          <EmptyState
            icon={Bug}
            title={searchQuery ? 'No bugs match your search' : 'No bugs yet'}
            description={
              searchQuery
                ? 'Try adjusting your search terms.'
                : 'Great! No bugs have been discovered yet.'
            }
          />
        )}

        {/* Bugs Table */}
        {!isLoading && !isError && bugs.length > 0 && (
          <div className="glass p-6 rounded-xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bugs.map((bug) => (
                  <TableRow key={bug.id}>
                    <TableCell>
                      <Link to={`/bugs/${bug.id}`} className="text-red-500 hover:underline font-medium">
                        {bug.title}
                      </Link>
                      {bug.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-1 max-w-xs truncate">
                          {bug.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={bug.severity} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={bug.priority} />
                    </TableCell>
                    <TableCell>
                      <BugStatusBadge status={bug.status} />
                    </TableCell>
                    <TableCell>{bug.assignee?.name ?? 'Unassigned'}</TableCell>
                    <TableCell>{new Date(bug.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleDelete(bug)}
                        className="p-2 hover:bg-destructive/10 rounded-lg transition-colors text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </motion.div>

      {/* Create Bug Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md glass p-8 rounded-2xl"
          >
            <h2 className="text-2xl font-bold mb-2">Report New Bug</h2>
            <p className="text-muted-foreground text-sm mb-6">Report a bug discovered during testing</p>

            <form onSubmit={handleCreateBug} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  value={newBug.title}
                  onChange={(e) => setNewBug({ ...newBug, title: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Checkout crashes on submit"
                  required
                  disabled={createBugMutation.isPending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={newBug.description}
                  onChange={(e) => setNewBug({ ...newBug, description: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  placeholder="Steps to reproduce, expected vs actual behavior..."
                  rows={3}
                  disabled={createBugMutation.isPending}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Severity</label>
                  <Select
                    value={newBug.severity}
                    onChange={(e) => setNewBug({ ...newBug, severity: e.target.value as BugSeverity })}
                    className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    disabled={createBugMutation.isPending}
                  >
                    {SEVERITIES.map((severity) => (
                      <option key={severity} value={severity}>
                        {severity}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Priority</label>
                  <Select
                    value={newBug.priority}
                    onChange={(e) => setNewBug({ ...newBug, priority: e.target.value as BugPriority })}
                    className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    disabled={createBugMutation.isPending}
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Project</label>
                <Select
                  value={newBug.projectId}
                  onChange={(e) => setNewBug({ ...newBug, projectId: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                  disabled={createBugMutation.isPending}
                >
                  <option value="">Select a project…</option>
                  {(projectsData?.items ?? []).map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
                  disabled={createBugMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBugMutation.isPending}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createBugMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Bug'
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