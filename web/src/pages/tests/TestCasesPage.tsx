import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { testCasesApi, projectsApi, applicationsApi } from '../../api';
import { getErrorMessage } from '../../api/client';
import Layout from '../../components/Layout';
import {
  Plus,
  Loader2,
  Copy,
  Archive,
  Trash2,
  CircleDot,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Badge,
  Select,
  PriorityBadge,
  EmptyState,
  PageLoader,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui';
import type { TestCase, TestCaseType } from '../../types';

const TEST_TYPES: TestCaseType[] = ['FUNCTIONAL', 'HAPPY_PATH', 'NEGATIVE', 'EDGE_CASE', 'REGRESSION', 'SMOKE'];

const TYPE_LABELS: Record<string, string> = {
  FUNCTIONAL: 'Functional',
  HAPPY_PATH: 'Happy Path',
  NEGATIVE: 'Negative',
  EDGE_CASE: 'Edge Case',
  REGRESSION: 'Regression',
  SMOKE: 'Smoke',
};

const PRIORITIES = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const STEP_ACTIONS = ['goto', 'click', 'fill', 'press', 'waitForSelector', 'waitForTimeout', 'expectVisible', 'expectText', 'screenshot']; 

interface StepDraft {
  action: string;
  selector: string;
  value: string;
}

const TYPE_COLORS: Record<string, string> = {
  FUNCTIONAL: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  HAPPY_PATH: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  NEGATIVE: 'text-red-400 bg-red-500/10 border-red-500/20',
  EDGE_CASE: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  REGRESSION: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  SMOKE: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
};

export default function TestCasesPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(searchParams.get('projectId') ?? '');
  const [newTestCase, setNewTestCase] = useState({
    title: '',
    description: '',
    type: 'FUNCTIONAL' as TestCaseType,
    priority: 'medium',
    projectId: '',
    applicationId: '' as string | undefined,
    steps: [] as StepDraft[],
  });
  const [generateForm, setGenerateForm] = useState({
    applicationId: '',
    requirements: '',
    count: 5,
  });

  const { data: testCaseList, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['test-cases', selectedProjectId],
    queryFn: () =>
      testCasesApi.list({
        pageSize: 100,
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
      }),
  });

  const { data: projectList } = useQuery({
    queryKey: ['projects', 'select'],
    queryFn: () => projectsApi.list({ pageSize: 100 }),
  });

  const { data: applicationList } = useQuery({
    queryKey: ['applications', newTestCase.projectId],
    queryFn: () => applicationsApi.list(newTestCase.projectId),
    enabled: !!newTestCase.projectId,
  });

  const createTestCaseMutation = useMutation({
    mutationFn: (data: {
      title: string;
      description: string;
      type: TestCaseType;
      priority: string;
      projectId: string;
      applicationId?: string;
      steps?: StepDraft[];
    }) => testCasesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-cases'] });
      toast.success('Test case created successfully! 🎉');
      setShowCreateModal(false);
      setNewTestCase({ title: '', description: '', type: 'FUNCTIONAL', priority: 'medium', projectId: '', applicationId: '', steps: [] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const generateTestCaseMutation = useMutation({
    mutationFn: (data: {
      applicationId: string;
      projectId: string;
      requirements?: string;
      types?: string[];
      count?: number;
    }) => testCasesApi.generate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-cases'] });
      toast.success('Test case generation queued. They will appear once the AI completes. 🎉');
      setShowGenerateModal(false);
      setGenerateForm({ applicationId: '', requirements: '', count: 5 });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const duplicateTestCaseMutation = useMutation({
    mutationFn: (id: string) => testCasesApi.duplicate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-cases'] });
      toast.success('Test case duplicated');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const archiveTestCaseMutation = useMutation({
    mutationFn: (id: string) => testCasesApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-cases'] });
      toast.success('Test case archived');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const deleteTestCaseMutation = useMutation({
    mutationFn: (id: string) => testCasesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-cases'] });
      toast.success('Test case deleted');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleCreateTestCase = (e: React.FormEvent) => {
    e.preventDefault();
    createTestCaseMutation.mutate({
      ...newTestCase,
      applicationId: newTestCase.applicationId || undefined,
    });
  };

  const testCases = testCaseList?.items ?? [];

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
            <h1 className="text-4xl font-bold mb-2 gradient-text">Test Cases</h1>
            <p className="text-muted-foreground">Manage and organize your QA test cases</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowGenerateModal(true)}
              className="flex items-center gap-2 px-4 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors font-medium"
            >
              <Sparkles className="w-5 h-5" />
              Generate with AI
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              New Test Case
            </button>
          </div>
        </div>

        {/* Project Filter */}
        <div className="mb-8 max-w-sm">
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

        {/* Loading State */}
        {isLoading && <PageLoader label="Loading test cases..." />}

        {/* Error State */}
        {!isLoading && isError && (
          <div className="glass rounded-xl p-8 text-center">
            <p className="text-red-500 font-medium mb-4">Failed to load test cases.</p>
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
        {!isLoading && !isError && testCases.length === 0 && (
          <EmptyState
            icon={CircleDot}
            title="No test cases yet"
            description={
              selectedProjectId
                ? 'No test cases found for the selected project.'
                : 'Create your first test case to get started.'
            }
            action={
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors font-medium"
              >
                <Plus className="w-5 h-5" />
                New Test Case
              </button>
            }
          />
        )}

        {/* Test Cases Table */}
        {!isLoading && !isError && testCases.length > 0 && (
          <div className="glass rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testCases.map((testCase: TestCase) => (
                  <TableRow key={testCase.id}>
                    <TableCell>
                      <p className="font-medium">{testCase.title}</p>
                      {testCase.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-1 max-w-md">
                          {testCase.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TYPE_COLORS[testCase.type] ?? 'text-muted-foreground bg-secondary border-border'}`}>
                        {TYPE_LABELS[testCase.type] ?? testCase.type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={testCase.priority} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{testCase.status.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(testCase.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => duplicateTestCaseMutation.mutate(testCase.id)}
                          className="px-3 py-2 bg-secondary hover:bg-secondary/80 text-sm rounded-lg transition-colors flex items-center gap-1.5"
                          title="Duplicate"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => archiveTestCaseMutation.mutate(testCase.id)}
                          className="px-3 py-2 bg-secondary hover:bg-secondary/80 text-sm rounded-lg transition-colors flex items-center gap-1.5"
                          title="Archive"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete test case "${testCase.title}"?`)) {
                              deleteTestCaseMutation.mutate(testCase.id);
                            }
                          }}
                          className="px-3 py-2 bg-secondary hover:bg-secondary/80 text-sm rounded-lg transition-colors text-red-500 flex items-center gap-1.5"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </motion.div>

      {/* Generate Test Cases Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg glass p-8 rounded-2xl"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <h2 className="text-2xl font-bold">Generate with AI</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Describe the feature and the agent will draft test cases.
                </p>
              </div>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!selectedProjectId && (
              <p className="text-amber-500 text-sm mb-4">Select a project in the filter above to choose an application.</p>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!selectedProjectId || !generateForm.applicationId) return;
                generateTestCaseMutation.mutate({
                  applicationId: generateForm.applicationId,
                  projectId: selectedProjectId,
                  requirements: generateForm.requirements || undefined,
                  types: undefined,
                  count: generateForm.count,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-2">Application *</label>
                <Select
                  value={generateForm.applicationId}
                  onChange={(e) => setGenerateForm({ ...generateForm, applicationId: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                  disabled={!selectedProjectId || generateTestCaseMutation.isPending}
                >
                  <option value="">Select an application</option>
                  {(applicationList ?? []).map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Requirements / Feature description</label>
                <textarea
                  value={generateForm.requirements}
                  onChange={(e) => setGenerateForm({ ...generateForm, requirements: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  placeholder="e.g. Users should be able to reset their password via email link, and the link expires after 30 minutes."
                  rows={4}
                  disabled={generateTestCaseMutation.isPending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Number of test cases</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={generateForm.count}
                  onChange={(e) => setGenerateForm({ ...generateForm, count: Number(e.target.value) })}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={generateTestCaseMutation.isPending}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="flex-1 px-4 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
                  disabled={generateTestCaseMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedProjectId || !generateForm.applicationId || generateTestCaseMutation.isPending}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {generateTestCaseMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Create Test Case Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl glass p-8 rounded-2xl max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-2xl font-bold mb-2">Create New Test Case</h2>
            <p className="text-muted-foreground text-sm mb-6">Add a test case to your suite</p>

            <form onSubmit={handleCreateTestCase} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title *</label>
                <input
                  type="text"
                  value={newTestCase.title}
                  onChange={(e) => setNewTestCase({ ...newTestCase, title: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Verify user can checkout"
                  required
                  disabled={createTestCaseMutation.isPending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={newTestCase.description}
                  onChange={(e) => setNewTestCase({ ...newTestCase, description: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  placeholder="Steps and expected behavior..."
                  rows={3}
                  disabled={createTestCaseMutation.isPending}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Type</label>
                  <Select
                    value={newTestCase.type}
                    onChange={(e) => setNewTestCase({ ...newTestCase, type: e.target.value as TestCaseType })}
                    className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    disabled={createTestCaseMutation.isPending}
                  >
                    {TEST_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {TYPE_LABELS[type]}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Priority</label>
                  <Select
                    value={newTestCase.priority}
                    onChange={(e) => setNewTestCase({ ...newTestCase, priority: e.target.value })}
                    className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    disabled={createTestCaseMutation.isPending}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">Steps</label>
                  <button
                    type="button"
                    onClick={() =>
                      setNewTestCase({
                        ...newTestCase,
                        steps: [...newTestCase.steps, { action: 'goto', selector: '', value: '' }],
                      })
                    }
                    className="text-sm text-red-500 hover:text-red-400 font-medium"
                    disabled={createTestCaseMutation.isPending}
                  >
                    + Add step
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Optional. Leave empty to run a quick navigation smoke test on the app's base URL.
                </p>
                <div className="space-y-2">
                  {newTestCase.steps.map((step, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="w-6 text-right text-xs text-muted-foreground">{index + 1}.</span>
                      <Select
                        value={step.action}
                        onChange={(e) => {
                          const steps = [...newTestCase.steps];
                          steps[index] = { ...steps[index], action: e.target.value };
                          setNewTestCase({ ...newTestCase, steps });
                        }}
                        className="w-40 px-2 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                        disabled={createTestCaseMutation.isPending}
                      >
                        {STEP_ACTIONS.map((action) => (
                          <option key={action} value={action}>
                            {action}
                          </option>
                        ))}
                      </Select>
                      <input
                        type="text"
                        value={step.selector}
                        onChange={(e) => {
                          const steps = [...newTestCase.steps];
                          steps[index] = { ...steps[index], selector: e.target.value };
                          setNewTestCase({ ...newTestCase, steps });
                        }}
                        placeholder={step.action === 'goto' ? 'URL (e.g. /login)' : 'Selector'}
                        className="flex-1 px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                        disabled={createTestCaseMutation.isPending}
                      />
                      <input
                        type="text"
                        value={step.value}
                        onChange={(e) => {
                          const steps = [...newTestCase.steps];
                          steps[index] = { ...steps[index], value: e.target.value };
                          setNewTestCase({ ...newTestCase, steps });
                        }}
                        placeholder="Value"
                        className="w-40 px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                        disabled={createTestCaseMutation.isPending}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setNewTestCase({
                            ...newTestCase,
                            steps: newTestCase.steps.filter((_, i) => i !== index),
                          })
                        }
                        className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                        disabled={createTestCaseMutation.isPending}
                        aria-label="Remove step"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {newTestCase.steps.length === 0 && (
                    <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg p-3">
                      No steps yet — add actions like <code className="text-red-400">click</code>,{' '}
                      <code className="text-red-400">fill</code> or{' '}
                      <code className="text-red-400">goto</code>.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Project *</label>
                <Select
                  value={newTestCase.projectId}
                  onChange={(e) =>
                    setNewTestCase({ ...newTestCase, projectId: e.target.value, applicationId: '' })
                  }
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                  disabled={createTestCaseMutation.isPending}
                >
                  <option value="">Select a project</option>
                  {(projectList?.items ?? []).map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Application</label>
                <Select
                  value={newTestCase.applicationId}
                  onChange={(e) => setNewTestCase({ ...newTestCase, applicationId: e.target.value || undefined })}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={createTestCaseMutation.isPending || !newTestCase.projectId}
                >
                  <option value="">Select an application (optional)</option>
                  {(applicationList ?? []).map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name}
                    </option>
                  ))}
                </Select>
                {(applicationList ?? []).length === 0 ? (
                  <p className="text-xs text-amber-400/90 mt-2">
                    No applications in this project yet — create one under Apps so runs get a base URL.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-2">
                    Linked applications provide a base URL so runs work even without explicit steps.
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
                  disabled={createTestCaseMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTestCaseMutation.isPending}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createTestCaseMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Test Case'
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