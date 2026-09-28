import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { testRunsApi, projectsApi, testCasesApi } from '../../api';
import { getErrorMessage } from '../../api/client';
import Layout from '../../components/Layout';
import {
  Plus,
  Loader2,
  Ban,
  ExternalLink,
  ListChecks,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  RunStatusBadge,
  Select,
  EmptyState,
  PageLoader,
  HowToBox,
  FieldError } from '../../components/ui';
import type { TestRun, TestCase } from '../../types';

const STATUS_FILTERS = ['ALL', 'PENDING', 'QUEUED', 'RUNNING', 'PASSED', 'FAILED', 'CANCELLED'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export default function TestRunsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState(searchParams.get('projectId') ?? '');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formProjectId, setFormProjectId] = useState('');
  const [selectedTestCaseIds, setSelectedTestCaseIds] = useState<string[]>([]);
  const [testCaseError, setTestCaseError] = useState<string | null>(null);

  const { data: runList, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['test-runs', statusFilter, selectedProjectId],
    queryFn: () =>
      testRunsApi.list({
        pageSize: 100,
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
        ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
      }),
  });

  const { data: projectList } = useQuery({
    queryKey: ['projects', 'select'],
    queryFn: () => projectsApi.list({ pageSize: 100 }),
  });

  const { data: projectTestCases, isFetching: projectTestCasesLoading } = useQuery({
    queryKey: ['test-cases', formProjectId],
    queryFn: () => testCasesApi.list({ pageSize: 100, projectId: formProjectId }),
    enabled: !!formProjectId,
  });

  const createRunMutation = useMutation({
    mutationFn: (data: { projectId: string; testCaseIds: string[]; triggerType: string }) =>
      testRunsApi.create(data),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ['test-runs'] });
      toast.success('Test run created successfully!');
      setShowCreateModal(false);
      setFormProjectId('');
      setSelectedTestCaseIds([]);
      navigate(`/runs/${run.id}`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const cancelRunMutation = useMutation({
    mutationFn: (id: string) => testRunsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-runs'] });
      toast.success('Test run cancelled');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleSelectProject = (projectId: string) => {
    setFormProjectId(projectId);
    setSelectedTestCaseIds([]);
  };

  const toggleTestCase = (id: string) => {
    if (testCaseError) setTestCaseError(null);
    setSelectedTestCaseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreateRun = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTestCaseIds.length === 0) {
      setTestCaseError('Select at least one test case to run.');
      return;
    }
    setTestCaseError(null);
    createRunMutation.mutate({
      projectId: formProjectId,
      testCaseIds: selectedTestCaseIds,
      triggerType: 'MANUAL',
    });
  };

  const runs = runList?.items ?? [];
  const isCancelable = (run: TestRun) => ['PENDING', 'QUEUED', 'RUNNING'].includes(run.status);

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
            <h1 className="text-4xl font-bold mb-2 gradient-text">Test Runs</h1>
            <p className="text-muted-foreground">Execute and monitor your test suites</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            New Run
          </button>
        </div>

        {/* Project Filter */}
        <div className="max-w-sm mb-6">
          <label className="block text-sm font-medium mb-2">Filter by Project</label>
          <Select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">All Projects</option>
            {(projectList?.items ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Status Filter Chips */}
        <div className="flex flex-wrap gap-2 mb-8">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-red-600 text-white'
                  : 'bg-secondary hover:bg-secondary/80 text-muted-foreground'
              }`}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>

        
        <HowToBox
          title="How test runs work"
          steps={[
            {
              title: 'Pick a suite',
              text: 'Choose the test suite you want to execute.',
            },
            {
              title: 'Start the run',
              text: 'Chromium opens and works through every case.',
            },
            {
              title: 'Watch progress',
              text: 'Runs are live: pending, running, then passed or failed.',
            },
            {
              title: 'Analyse a failure',
              text: 'Open the run and send a failure to the Failure Analyzer.',
            },
          ]}
        />
{/* Loading State */}
        {isLoading && <PageLoader label="Loading test runs..." />}

        {/* Error State */}
        {!isLoading && isError && (
          <div className="glass rounded-xl p-8 text-center">
            <p className="text-red-500 font-medium mb-4">Failed to load test runs.</p>
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
        {!isLoading && !isError && runs.length === 0 && (
          <EmptyState
            icon={ListChecks}
            title="No test runs yet"
            description={
              statusFilter !== 'ALL'
                ? `No runs with status "${statusFilter.replace('_', ' ')}" found.`
                : 'Create your first test run to execute your test cases.'
            }
            action={
              statusFilter === 'ALL' ? (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors font-medium"
                >
                  <Plus className="w-5 h-5" />
                  New Run
                </button>
              ) : undefined
            }
          />
        )}

        {/* Runs List */}
        {!isLoading && !isError && runs.length > 0 && (
          <div className="space-y-4">
            {runs.map((run, index) => (
              <motion.div
                key={run.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass p-6 rounded-xl hover:shadow-lg transition-all"
              >
                <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-sm text-muted-foreground">
                        #{run.id.slice(0, 8)}
                      </span>
                      <RunStatusBadge status={run.status} />
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="font-mono">project: {run.projectId.slice(0, 8)}</span>
                      <span>{new Date(run.createdAt).toLocaleString()}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span className="flex items-center gap-1.5">
                        <ListChecks className="w-4 h-4 text-muted-foreground" />
                        {run.totalTests} total
                      </span>
                      <span className="flex items-center gap-1.5 text-red-500">
                        <CheckCircle2 className="w-4 h-4" />
                        {run.passedTests} passed
                      </span>
                      <span className="flex items-center gap-1.5 text-red-500">
                        <XCircle className="w-4 h-4" />
                        {run.failedTests} failed
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 items-center lg:items-end">
                    {isCancelable(run) && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Cancel run #${run.id.slice(0, 8)}?`)) {
                            cancelRunMutation.mutate(run.id);
                          }
                        }}
                        disabled={cancelRunMutation.isPending}
                        className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-sm rounded-lg transition-colors flex items-center gap-2 text-red-500 disabled:opacity-50"
                      >
                        <Ban className="w-4 h-4" />
                        Cancel
                      </button>
                    )}
                    <Link
                      to={`/runs/${run.id}`}
                      className="px-4 py-2 bg-red-600 hover:bg-red-600/90 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Create Run Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg glass p-8 rounded-2xl"
          >
            <h2 className="text-2xl font-bold mb-2">New Test Run</h2>
            <p className="text-muted-foreground text-sm mb-6">Select a project and the test cases to run</p>

            <form onSubmit={handleCreateRun} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2">Project *</label>
                <Select
                  value={formProjectId}
                  onChange={(e) => handleSelectProject(e.target.value)}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                  disabled={createRunMutation.isPending}
                >
                  <option value="">Select a project</option>
                  {(projectList?.items ?? []).map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </div>

              {formProjectId && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Test Cases ({selectedTestCaseIds.length} selected)
                  </label>
                  {projectTestCasesLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading test cases...
                    </div>
                  ) : (projectTestCases?.items ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                      No test cases found for this project.
                    </p>
                  ) : (
                    <div
                      className={`max-h-64 overflow-y-auto border rounded-lg bg-secondary/30 p-2 space-y-1 ${testCaseError ? 'border-red-500/70 ring-1 ring-red-500/40' : 'border-border'}`}
                      aria-describedby={testCaseError ? 'run-testcases-error' : undefined}
                    >
                      {(projectTestCases?.items ?? []).map((testCase: TestCase) => (
                        <label
                          key={testCase.id}
                          className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-secondary cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTestCaseIds.includes(testCase.id)}
                            onChange={() => toggleTestCase(testCase.id)}
                            className="mt-1 accent-primary"
                          />
                          <span className="text-sm">{testCase.title}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <FieldError id="run-testcases-error">{testCaseError}</FieldError>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
                  disabled={createRunMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRunMutation.isPending || !formProjectId}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createRunMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    'Start Run'
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