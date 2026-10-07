import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { testSuitesApi, testCasesApi, projectsApi } from '../../api';
import { getErrorMessage } from '../../api/client';
import Layout from '../../components/Layout';
import {
  Plus,
  PlaySquare,
  Trash2,
  FolderKanban,
  ListChecks,
  Calendar,
  RefreshCw,
  Settings2,
  X,
  PlusCircle,
  MinusCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { EmptyState, Select, PageLoader, ButtonLoader, useConfirm } from '../../components/ui';

export default function TestSuitesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(searchParams.get('projectId') ?? '');
  const [newSuite, setNewSuite] = useState({ name: '', description: '', projectId: '' });
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);
  const [testCaseToAdd, setTestCaseToAdd] = useState('');

  const { data: suiteList, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['test-suites', selectedProjectId],
    queryFn: () =>
      testSuitesApi.list({
        pageSize: 100,
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
      }),
    enabled: !!selectedProjectId,
  });

  const { data: projectList, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', 'select'],
    queryFn: () => projectsApi.list({ pageSize: 100 }),
  });

  const { data: selectedSuite, isLoading: selectedSuiteLoading } = useQuery({
    queryKey: ['test-suite', selectedSuiteId],
    queryFn: () => testSuitesApi.get(selectedSuiteId as string),
    enabled: Boolean(selectedSuiteId),
  });

  const { data: projectCases } = useQuery({
    queryKey: ['test-cases', selectedProjectId],
    queryFn: () => testCasesApi.list({ pageSize: 100, projectId: selectedProjectId }),
    enabled: Boolean(selectedProjectId && selectedSuiteId),
  });

  const createSuiteMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; projectId: string }) =>
      testSuitesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-suites'] });
      toast.success('Test suite created successfully!');
      setShowCreateModal(false);
      setNewSuite({ name: '', description: '', projectId: '' });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const deleteSuiteMutation = useMutation({
    mutationFn: (id: string) => testSuitesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-suites'] });
      toast.success('Test suite deleted');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const runSuiteMutation = useMutation({
    mutationFn: (id: string) => testSuitesApi.run(id),
    onSuccess: (run) => {
      toast.success('Test suite run started');
      navigate(`/runs/${run.id}`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const addTestCaseMutation = useMutation({
    mutationFn: (testCaseId: string) => testSuitesApi.addTestCase(selectedSuiteId as string, testCaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-suite', selectedSuiteId] });
      queryClient.invalidateQueries({ queryKey: ['test-suites'] });
      toast.success('Test case added to suite');
      setTestCaseToAdd('');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const removeTestCaseMutation = useMutation({
    mutationFn: (suiteItemId: string) => testSuitesApi.removeTestCase(selectedSuiteId as string, suiteItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-suite', selectedSuiteId] });
      queryClient.invalidateQueries({ queryKey: ['test-suites'] });
      toast.success('Test case removed from suite');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleCreateSuite = (e: React.FormEvent) => {
    e.preventDefault();
    createSuiteMutation.mutate(newSuite);
  };

  const suites = suiteList?.items ?? [];

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
            <h1 className="text-4xl font-bold mb-2 gradient-text">Test Suites</h1>
            <p className="text-muted-foreground">Group test cases and run them together</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            New Test Suite
          </button>
        </div>

        {/* Project Filter */}
        <div className="mb-8 max-w-sm">
          <label className="block text-sm font-medium mb-2">Filter by Project</label>
          <Select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={projectsLoading}
            className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">Select a project</option>
            {(projectList?.items ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </div>

        {!selectedProjectId && !projectsLoading && (
          <div className="glass rounded-xl p-8 text-center">
            <p className="text-muted-foreground mb-4">Select a project to view its test suites.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              New Test Suite
            </button>
          </div>
        )}

        {/* Loading State */}
        {selectedProjectId && isLoading && <PageLoader label="Loading test suites..." />}

        {/* Error State */}
        {selectedProjectId && !isLoading && isError && (
          <div className="glass rounded-xl p-8 text-center">
            <p className="text-red-500 font-medium mb-4">Failed to load test suites.</p>
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
        {selectedProjectId && !isLoading && !isError && suites.length === 0 && (
          <EmptyState
            icon={FolderKanban}
            title="No test suites yet"
            description="Create your first test suite to group test cases and run them together."
            action={
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors font-medium"
              >
                <Plus className="w-5 h-5" />
                New Test Suite
              </button>
            }
          />
        )}

        {/* Suites Grid */}
        {selectedProjectId && !isLoading && !isError && suites.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {suites.map((suite, index) => (
              <motion.div
                key={suite.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass p-6 rounded-xl hover:shadow-lg transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-red-600/10 rounded-lg flex items-center justify-center group-hover:bg-red-600/20 transition-colors">
                    <ListChecks className="w-6 h-6 text-red-500" />
                  </div>
                </div>

                <h3 className="text-xl font-semibold mb-2 group-hover:text-red-500 transition-colors">
                  {suite.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {suite.description || 'No description provided'}
                </p>

                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <ListChecks className="w-4 h-4" />
                    <span>{suite.testCases.length} test case{suite.testCases.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(suite.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-border">
                  <button
                    onClick={() => setSelectedSuiteId(suite.id)}
                    className="px-3 py-2 bg-secondary hover:bg-secondary/80 text-sm rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Settings2 className="w-4 h-4" />
                    Manage
                  </button>
                  <button
                    onClick={() => runSuiteMutation.mutate(suite.id)}
                    disabled={runSuiteMutation.isPending}
                    className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-600/90 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {runSuiteMutation.isPending ? (
                      <ButtonLoader />
                    ) : (
                      <PlaySquare className="w-4 h-4" />
                    )}
                    Run
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Delete test suite',
                        message: `Delete test suite "${suite.name}"? This cannot be undone.`,
                        confirmLabel: 'Delete',
                      });
                      if (ok) deleteSuiteMutation.mutate(suite.id);
                    }}
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

      {/* Manage Suite Modal */}
      {selectedSuiteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl glass p-8 rounded-2xl"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">{selectedSuite?.name ?? 'Test Suite'}</h2>
                <p className="text-muted-foreground text-sm mt-1">Compose the test cases in this suite</p>
              </div>
              <button
                onClick={() => {
                  setSelectedSuiteId(null);
                  setTestCaseToAdd('');
                }}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedSuiteLoading && <PageLoader label="Loading suite..." />}

            {selectedSuite && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Test cases ({selectedSuite.testCases.length})</h3>
                  {selectedSuite.testCases.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 bg-secondary/30 rounded-lg">
                      No test cases in this suite yet. Add one below.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-auto pr-1">
                      {selectedSuite.testCases.map((testCase, index) => {
                        const item = selectedSuite.items.find((i) => i.testCaseId === testCase.id);
                        return (
                          <div
                            key={testCase.id}
                            className="flex items-center justify-between gap-3 p-3 bg-secondary/30 border border-border rounded-lg"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-xs text-muted-foreground font-mono w-6 shrink-0">
                                {index + 1}.
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{testCase.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{testCase.type}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => item && removeTestCaseMutation.mutate(item.id)}
                              disabled={removeTestCaseMutation.isPending}
                              className="p-2 hover:bg-red-600/10 text-red-500 rounded-lg transition-colors shrink-0"
                              title="Remove from suite"
                            >
                              <MinusCircle className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Add test case</h3>
                  <div className="flex gap-3">
                    <Select
                      value={testCaseToAdd}
                      onChange={(e) => setTestCaseToAdd(e.target.value)}
                      className="flex-1 px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      disabled={addTestCaseMutation.isPending}
                    >
                      <option value="">Select a test case...</option>
                      {(projectCases?.items ?? [])
                        .filter((tc) => !selectedSuite.testCases.some((s) => s.id === tc.id))
                        .map((tc) => (
                          <option key={tc.id} value={tc.id}>
                            {tc.title}
                          </option>
                        ))}
                    </Select>
                    <button
                      onClick={() => testCaseToAdd && addTestCaseMutation.mutate(testCaseToAdd)}
                      disabled={!testCaseToAdd || addTestCaseMutation.isPending}
                      className="px-4 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {addTestCaseMutation.isPending ? (
                        <ButtonLoader />
                      ) : (
                        <PlusCircle className="w-4 h-4" />
                      )}
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Create Test Suite Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md glass p-8 rounded-2xl"
          >
            <h2 className="text-2xl font-bold mb-2">Create New Test Suite</h2>
            <p className="text-muted-foreground text-sm mb-6">Group your test cases into a runnable suite</p>

            <form onSubmit={handleCreateSuite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name *</label>
                <input
                  type="text"
                  value={newSuite.name}
                  onChange={(e) => setNewSuite({ ...newSuite, name: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Checkout Regression Suite"
                  required
                  disabled={createSuiteMutation.isPending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={newSuite.description}
                  onChange={(e) => setNewSuite({ ...newSuite, description: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  placeholder="Automated checks for the checkout flow..."
                  rows={3}
                  disabled={createSuiteMutation.isPending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Project *</label>
                <Select
                  value={newSuite.projectId}
                  onChange={(e) => setNewSuite({ ...newSuite, projectId: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                  disabled={createSuiteMutation.isPending}
                >
                  <option value="">Select a project</option>
                  {(projectList?.items ?? []).map((project) => (
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
                  disabled={createSuiteMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSuiteMutation.isPending}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createSuiteMutation.isPending ? (
                    <>
                      <ButtonLoader />
                      Creating...
                    </>
                  ) : (
                    'Create Test Suite'
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