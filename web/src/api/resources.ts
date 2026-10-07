import { apiGet, apiPost, apiPatch, apiDelete, apiPaginated } from './client';
import type {
  Project,
  Application,
  TestCase,
  TestRun,
  TestResult,
  Bug,
  Paginated,
  DashboardAnalytics,
  TestMetricsResponse,
  AgentMetrics,
  FlakyTest,
} from '../types';

export interface BugComment {
  id: string;
  bugId: string;
  content: string;
  createdById: string | null;
  createdAt: string;
  /** The Prisma relation on BugComment is `user`, not `creator`. */
  user?: { id: string; name: string | null; email: string } | null;
}

export const projectsApi = {
  list: (params?: Record<string, unknown>) => apiPaginated<Project>('/projects', params),
  get: (id: string) => apiGet<Project>(`/projects/${id}`),
  create: (data: { name: string; description?: string }) =>
    apiPost<Project>('/projects', data),
  update: (id: string, data: Record<string, unknown>) =>
    apiPatch<Project>(`/projects/${id}`, data),
  archive: (id: string) => apiPatch<Project>(`/projects/${id}/archive`),
  dashboard: (projectId: string) =>
    apiGet<Record<string, unknown>>('/projects/dashboard', { projectId }),
};

export const applicationsApi = {
  list: (projectId: string) => apiGet<Application[]>(`/applications?projectId=${projectId}`),
  get: (id: string) => apiGet<Application>(`/applications/${id}`),
  create: (data: { projectId: string; name: string; baseUrl: string; description?: string; type?: string }) =>
    apiPost<Application>('/applications', data),
  update: (id: string, data: Record<string, unknown>) =>
    apiPatch<Application>(`/applications/${id}`, data),
  remove: (id: string) => apiDelete<{ message: string }>(`/applications/${id}`),
  map: (id: string) => apiGet<Record<string, unknown>>(`/applications/${id}/map`),
  scan: (id: string) =>
    apiPost<{ scanId: string }>(`/applications/${id}/scan`),
  scanStatus: (id: string, scanId: string) =>
    apiGet<{
      id: string;
      completedAt: string | null;
      pagesDiscovered: number;
      componentsDiscovered: number;
      workflowsDiscovered: number;
    }>(`/applications/${id}/scan/${scanId}`),
  addEnvironment: (id: string, data: Record<string, unknown>) =>
    apiPost<Record<string, unknown>>(`/applications/${id}/environments`, data),
  addTestUser: (id: string, data: Record<string, unknown>) =>
    apiPost<Record<string, unknown>>(`/applications/${id}/test-users`, data),
};

export const testCasesApi = {
  list: (params?: Record<string, unknown>) => apiPaginated<TestCase>('/test-cases', params),
  get: (id: string) => apiGet<TestCase>(`/test-cases/${id}`),
  create: (data: Partial<TestCase>) => apiPost<TestCase>('/test-cases', data),
  update: (id: string, data: Partial<TestCase>) =>
    apiPatch<TestCase>(`/test-cases/${id}`, data),
  remove: (id: string) => apiDelete<{ message: string }>(`/test-cases/${id}`),
  archive: (id: string) => apiPatch<TestCase>(`/test-cases/${id}/archive`),
  duplicate: (id: string) =>
    apiPost<TestCase>(`/test-cases/${id}/duplicate`),
  generate: (data: {
    applicationId: string;
    projectId: string;
    requirements?: string;
    types?: string[];
    count?: number;
  }) => apiPost<{ queued: boolean }>('/test-cases/generate', data),
};

export interface TestSuite {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  testCases: TestCase[];
  items: Array<{ id: string; testCaseId: string; order: number }>;
  createdAt: string;
  updatedAt: string;
}

export const testSuitesApi = {
  list: (params?: Record<string, unknown>) => apiPaginated<TestSuite>('/test-suites', params),
  get: (id: string) => apiGet<TestSuite>(`/test-suites/${id}`),
  create: (data: { name: string; description?: string; projectId?: string }) =>
    apiPost<TestSuite>('/test-suites', data),
  update: (id: string, data: Record<string, unknown>) =>
    apiPatch<TestSuite>(`/test-suites/${id}`, data),
  remove: (id: string) => apiDelete<{ message: string }>(`/test-suites/${id}`),
  run: (id: string, params?: Record<string, unknown>) =>
    apiPost<TestRun>(`/test-suites/${id}/run`, undefined, params),
  addTestCase: (id: string, testCaseId: string, order?: number) =>
    apiPost<{ message: string }>(`/test-suites/${id}/items`, { testCaseId, order }),
  removeTestCase: (id: string, suiteItemId: string) =>
    apiDelete<{ message: string }>(`/test-suites/${id}/items/${suiteItemId}`),
};

export const testRunsApi = {
  list: (params?: Record<string, unknown>) => apiPaginated<TestRun>('/test-runs', params),
  get: (id: string) => apiGet<TestRun>(`/test-runs/${id}`),
  create: (data: { projectId: string; testCaseIds?: string[]; environment?: string; triggerType?: string }) =>
    apiPost<TestRun>('/test-runs', data),
  schedule: (data: { projectId: string; testCaseIds?: string[]; environment?: string; cron?: string }) =>
    apiPost<TestRun>('/test-runs/scheduled', data),
  cancel: (id: string) => apiPost<TestRun>(`/test-runs/${id}/cancel`),
  results: (id: string, params?: Record<string, unknown>) =>
    apiPaginated<TestResult>(`/test-runs/${id}/results`, params),
};

export const bugsApi = {
  list: (params?: Record<string, unknown>) => apiPaginated<Bug>('/bugs', params),
  get: (id: string) => apiGet<Bug>(`/bugs/${id}`),
  create: (data: Partial<Bug>) => apiPost<Bug>('/bugs', data),
  update: (id: string, data: Partial<Bug>) => apiPatch<Bug>(`/bugs/${id}`, data),
  remove: (id: string) => apiDelete<{ message: string }>(`/bugs/${id}`),
  changeStatus: (id: string, status: string) =>
    apiPatch<Bug>(`/bugs/${id}/status`, { status }),
  assign: (id: string, assigneeId: string | null) =>
    apiPatch<Bug>(`/bugs/${id}/assignee`, { assigneeId }),
  comments: (id: string) => apiGet<Paginated<BugComment>>(`/bugs/${id}/comments`),
  addComment: (id: string, content: string) =>
    apiPost<BugComment>(`/bugs/${id}/comments`, { content }),
  raiseOnGithub: (id: string) => apiPost<Bug>(`/bugs/${id}/raise-github`, {}),
};

export const analyticsApi = {
  dashboard: (projectId?: string) =>
    apiGet<DashboardAnalytics>('/analytics/dashboard', { projectId }),
  testMetrics: (params?: Record<string, unknown>) =>
    apiGet<TestMetricsResponse>('/analytics/tests', params),
  agentMetrics: (params?: Record<string, unknown>) =>
    apiGet<AgentMetrics>('/analytics/agents', params),
  // Read-only: records are written by the `detect-flaky-tests` queue job.
  flakyTests: (params?: Record<string, unknown>) =>
    apiGet<FlakyTest[]>('/analytics/flaky-tests', params),
  generateReport: (data: { projectId?: string; testRunId?: string } = {}) =>
    apiPost<{ generated: boolean; queued: boolean }>('/analytics/reports', data),
};

// ===== Notification preferences (persisted via user profile metadata) =====
export interface NotificationPreferences {
  channels: string[];
  events: string[];
}

export const notificationsApi = {
  get: async () => {
    const me = await apiGet<{ notificationPreferences?: NotificationPreferences }>('/users/me');
    return me.notificationPreferences ?? { channels: ['email'], events: [] };
  },
  update: (prefs: NotificationPreferences) =>
    apiPatch<{ message: string }>('/users/me', { notificationPreferences: prefs }),
};