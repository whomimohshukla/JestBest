// ===== Common =====
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    message?: string;
    items?: T[];
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
  message?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ===== Auth =====
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  suspendedUntil: string | null;
  createdAt: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface AuthOrganization {
  id: string;
  name: string;
  slug: string;
  requireTwoFactor: boolean;
}

export interface AuthResult {
  user: User;
  organization: AuthOrganization | null;
  tokens: TokenPair;
}

export interface TwoFactorSetupBundle {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

export interface TwoFactorAuthResult {
  requiresTwoFactor: true;
  twoFactorToken: string;
  user: User;
  organization: AuthOrganization | null;
  setup?: TwoFactorSetupBundle;
}

export interface VerificationRequiredAuthResult {
  verificationRequired: true;
  verificationToken: string;
  user: User;
  organization: AuthOrganization | null;
}

export type AuthResponse = AuthResult | TwoFactorAuthResult | VerificationRequiredAuthResult;

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
  organizationName?: string;
}

// ===== Organization =====
export type MembershipRole = 'OWNER' | 'ADMIN' | 'QA_MANAGER' | 'DEVELOPER' | 'TESTER' | 'VIEWER';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  createdAt?: string;
  description?: string | null;
  website?: string | null;
  requireTwoFactor?: boolean;
}

export interface Membership {
  id: string;
  organizationId: string;
  userId: string;
  role: MembershipRole;
  joinedAt: string;
  user?: Pick<User, 'id' | 'email' | 'name' | 'avatar' | 'emailVerified'>;
}

export interface OrganizationInvite {
  id: string;
  organizationId: string;
  email: string;
  role: MembershipRole;
  status: string;
  createdAt: string;
}

// ===== App / Project =====
export interface Project {
  id: string;
  name: string;
  description: string | null;
  organizationId: string;
  status: string;
  testSuites: number;
  testCases: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface Application {
  id: string;
  projectId: string;
  name: string;
  baseUrl: string;
  description: string | null;
  type: string;
  isActive: boolean;
  createdAt: string;
}

export type TestCaseType = 'FUNCTIONAL' | 'HAPPY_PATH' | 'NEGATIVE' | 'EDGE_CASE' | 'REGRESSION' | 'SMOKE';
export type TestStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED';

export interface TestStep {
  id?: string;
  action: string;
  selector?: string;
  value?: string;
  url?: string;
}

export interface TestCase {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  type: TestCaseType;
  priority: string;
  status: string;
  steps: TestStep[];
  tags: string[];
  createdById: string;
  isGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TestRunStatus = 'PENDING' | 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERRORED' | 'CANCELLED';

export interface TestRun {
  id: string;
  projectId: string;
  testSuiteId?: string | null;
  environmentId?: string | null;
  testUserId?: string | null;
  createdById: string | null;
  status: TestRunStatus;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number | null;
  executionStartedAt?: string | null;
  executionCompletedAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface TestResult {
  id: string;
  testRunId: string;
  testCaseId: string;
  status: TestStatus;
  duration: number | null;
  errorMessage: string | null;
  screenshotUrl: string | null;
  videoUrl: string | null;
  consoleLogs: string[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  testCase: TestCase;
}

// ===== Bugs =====
export type BugSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type BugPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type BugStatus = 'OPEN' | 'IN_PROGRESS' | 'FIXED' | 'VERIFIED' | 'CLOSED' | 'WONT_FIX';

export interface Bug {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  severity: BugSeverity;
  priority: BugPriority;
  status: BugStatus;
  assigneeId: string | null;
  createdById: string | null;
  testResultId: string | null;
  githubIssueUrl: string | null;
  evidence: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  assignee?: User | null;
  creator?: User | null;
}

// ===== Analytics =====
export interface DashboardStats {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  passRate: number;
  totalRuns: number;
  activeProjects: number;
  openBugs: number;
  criticalBugs: number;
}

export interface TestTrendPoint {
  date: string;
  passed: number;
  failed: number;
  total: number;
}

export interface FlakyTest {
  testCaseId: string;
  testCaseTitle: string;
  totalRuns: number;
  passCount: number;
  failCount: number;
  flakyScore: number;
  rootCauseAnalysis: string;
  lastOccurred: string;
  pattern: string;
}

export interface AnalyticsSummary {
  testsRun: number;
  passRate: number;
  bugsFound: number;
  activeProjects: number;
  avgRunDuration: number;
  trends: TestTrendPoint[];
  flakyTests: FlakyTest[];
}

// ===== Dashboard / Analytics API payloads (mirrors backend analytics controller) =====
export type QualityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface QualityScore {
  score: number;
  level: QualityLevel;
  components: {
    passRate: number;
    testCoverage: number;
    bugBurden: number;
    flakiness: number;
  };
}

export interface RiskScore {
  riskScore: number;
  riskLevel: RiskLevel;
  details: {
    openCriticalBugs: number;
    failureRate: number;
    qualityScore: number;
  };
}

export interface DashboardAnalytics {
  projects: Project[];
  recentRuns: TestRun[];
  openBugs: number;
  totalCases: number;
  quality: QualityScore | null;
  risk: RiskScore | null;
}

export interface TestMetricsResponse {
  daily: Array<{ date: string; runs: number; passed: number; failed: number; skipped: number }>;
  totals: { runs: number; passed: number; failed: number; skipped: number; passRate: number };
}

export interface AgentMetrics {
  totals: { total: number; completed: number; failed: number; successRate: number };
  byType: Record<string, number>;
  cost: { usd: number; tokensUsed: number };
}

// ===== Agents =====
export type AgentType = 'TEST_EXPLORER' | 'BUG_HUNTER' | 'REGRESSION_ANALYST' | 'PERFORMANCE_AUDITOR' | 'CODE_QUALITY';
export type AgentStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'ERROR';

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  description: string;
  status: AgentStatus;
  configuration: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRun {
  id: string;
  agentType: string;
  projectId: string | null;
  status: string;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  tokensUsed: number | null;
  costUsd: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

// ===== Integrations / Webhooks =====
export type IntegrationType = 'GITHUB' | 'SLACK' | 'JIRA' | 'SENTRY' | 'CIRCLE_CI';

export interface Integration {
  id: string;
  organizationId: string;
  type: IntegrationType;
  name: string;
  isActive: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Must match the Prisma `WebhookEventType` enum; the API rejects anything else. */
export type WebhookEventType =
  | 'TEST_STARTED'
  | 'TEST_COMPLETED'
  | 'TEST_FAILED'
  | 'BUG_CREATED'
  | 'BUG_FIXED'
  | 'DEPLOYMENT_STARTED'
  | 'DEPLOYMENT_COMPLETED'
  | 'DEPLOYMENT_FAILED';

export interface Webhook {
  id: string;
  organizationId: string;
  projectId: string | null;
  url: string;
  secret: string;
  eventTypes: WebhookEventType[];
  isActive: boolean;
  lastTriggeredAt: string | null;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
  /** The API persists the HTTP status directly; there is no separate status field. */
  responseStatus: number | null;
  responseBody: string | null;
  attempts: number;
  nextRetryAt: string | null;
  succeededAt: string | null;
  failedAt: string | null;
  createdAt: string;
}

// ===== API Keys =====
export interface ApiKey {
  id: string;
  name: string;
  key: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

// ===== Billing =====
export interface BillingPlan {
  key: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  testRunLimit: number;
  features: string[];
}

export interface Billing {
  id: string;
  organizationId: string;
  plan: string;
  status: string;
  testRunsUsed: number;
  testRunLimit: number;
  renewalDate: string | null;
}

// ===== Audit =====
export interface AuditLogEntry {
  id: string;
  organizationId: string;
  userId: string | null;
  actionType: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user?: { name: string | null; email: string } | null;
}