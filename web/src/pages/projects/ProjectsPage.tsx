import { ButtonLoader, Spinner, PageLoader } from '../../components/ui';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api';
import { getErrorMessage } from '../../api/client';
import Layout from '../../components/Layout';
import { 
  Plus, 
  FolderKanban, 
  Search, 
  Calendar,
  Activity,
  Archive,
  ExternalLink,
  TriangleAlert
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });
  const queryClient = useQueryClient();

  // Fetch projects
  const { data: projectList, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list({ pageSize: 100 }),
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: (data: { name: string; description: string }) => projectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created successfully!');
      setShowCreateModal(false);
      setNewProject({ name: '', description: '' });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  // Archive project mutation
  const archiveProjectMutation = useMutation({
    mutationFn: (id: string) => projectsApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project archived');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const filteredProjects = (projectList?.items ?? []).filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    createProjectMutation.mutate(newProject);
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
            <h1 className="text-4xl font-bold mb-2 gradient-text">Projects</h1>
            <p className="text-muted-foreground">Manage your QA automation projects</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            New Project
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoading && <PageLoader label="Loading projects…" />}

        {/* Empty State */}
        {!isLoading && isError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass p-12 rounded-xl text-center"
          >
            <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <TriangleAlert className="w-10 h-10 text-red-500" aria-hidden="true" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Failed to load projects</h3>
            <p className="text-muted-foreground mb-6">
              We couldn't reach the API. Check your connection and try again.
            </p>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="px-6 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors font-medium inline-flex items-center gap-2 disabled:opacity-50"
            >
              {isFetching ? <Spinner size="md" /> : null}
              Retry
            </button>
          </motion.div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && (!filteredProjects || filteredProjects.length === 0) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass p-12 rounded-xl text-center"
          >
            <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <FolderKanban className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery ? 'No projects match your search.' : 'Create your first project to get started with QA automation.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors font-medium inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create Project
              </button>
            )}
          </motion.div>
        )}

        {/* Projects Grid */}
        {!isLoading && !isError && filteredProjects && filteredProjects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="glass p-6 rounded-xl hover:shadow-lg transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-red-600/10 rounded-lg flex items-center justify-center group-hover:bg-red-600/20 transition-colors">
                    <FolderKanban className="w-6 h-6 text-red-500" />
                  </div>
                </div>

                <h3 className="text-xl font-semibold mb-2 group-hover:text-red-500 transition-colors">
                  {project.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {project.description || 'No description provided'}
                </p>

                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Activity className="w-4 h-4" />
                    <span>Active</span>
                  </div>
                </div>

                <div
                  className="flex gap-2 pt-4 border-t border-border"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link
                    to={`/projects/${project.id}`}
                    className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-600/90 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open
                  </Link>
                  <button
                    onClick={() => {
                      if (window.confirm(`Archive project "${project.name}"?`)) {
                        archiveProjectMutation.mutate(project.id);
                      }
                    }}
                    className="px-3 py-2 bg-secondary hover:bg-secondary/80 text-sm rounded-lg transition-colors"
                    title="Archive project"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Stats Footer */}
        {!isLoading && !isError && filteredProjects && filteredProjects.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 glass p-6 rounded-xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-3xl font-bold mb-1">{filteredProjects.length}</p>
                <p className="text-sm text-muted-foreground">Total Projects</p>
              </div>
              <div>
                <p className="text-3xl font-bold mb-1">{filteredProjects.filter(p => !p.archivedAt).length}</p>
                <p className="text-sm text-muted-foreground">Active Projects</p>
              </div>
              <div>
                <p className="text-3xl font-bold mb-1">{filteredProjects.filter(p => p.archivedAt).length}</p>
                <p className="text-sm text-muted-foreground">Archived Projects</p>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md glass p-8 rounded-2xl"
          >
            <h2 className="text-2xl font-bold mb-2">Create New Project</h2>
            <p className="text-muted-foreground text-sm mb-6">Start a new QA automation project</p>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Project Name</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="E-commerce Test Suite"
                  required
                  disabled={createProjectMutation.isPending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  placeholder="Automated tests for checkout flow..."
                  rows={3}
                  disabled={createProjectMutation.isPending}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
                  disabled={createProjectMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createProjectMutation.isPending}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createProjectMutation.isPending ? (
                    <>
                      <ButtonLoader />
                      Creating...
                    </>
                  ) : (
                    'Create Project'
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
