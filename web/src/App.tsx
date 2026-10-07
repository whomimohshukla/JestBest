import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PopupViewport } from './components/ui/PopupViewport';
import { useAuthStore } from './store/authStore';
import ErrorBoundary from './components/ErrorBoundary';
import { PageLoader } from './components/ui';
import './index.css';

// Landing is the entry point for every new visitor, so it stays eager. Every
// other route is split: the previous single bundle was 1.27 MB and a visitor
// who only saw the login page was downloading the whole product.
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('./pages/auth/VerifyEmailPage'));
const OAuthCallbackPage = lazy(() => import('./pages/auth/OAuthCallbackPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const ProjectsPage = lazy(() => import('./pages/projects/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('./pages/projects/ProjectDetailPage'));
const ApplicationsPage = lazy(() => import('./pages/applications/ApplicationsPage'));
const TestCasesPage = lazy(() => import('./pages/tests/TestCasesPage'));
const TestSuitesPage = lazy(() => import('./pages/tests/TestSuitesPage'));
const TestRunsPage = lazy(() => import('./pages/testRuns/TestRunsPage'));
const TestRunDetailPage = lazy(() => import('./pages/testRuns/TestRunDetailPage'));
const BugsPage = lazy(() => import('./pages/bugs/BugsPage'));
const BugDetailPage = lazy(() => import('./pages/bugs/BugDetailPage'));
const AnalyticsPage = lazy(() => import('./pages/analytics/AnalyticsPage'));
const AgentsPage = lazy(() => import('./pages/agents/AgentsPage'));
const IntegrationsPage = lazy(() => import('./pages/integrations/IntegrationsPage'));
const DocumentationPage = lazy(() => import('./pages/DocumentationPage'));
const SettingsLayout = lazy(() => import('./pages/settings/SettingsLayout'));
const ProfileSettingsPage = lazy(() => import('./pages/settings/ProfileSettingsPage'));
const OrganizationSettingsPage = lazy(() => import('./pages/settings/OrganizationSettingsPage'));
const MembersSettingsPage = lazy(() => import('./pages/settings/MembersSettingsPage'));
const IntegrationsSettingsPage = lazy(() => import('./pages/settings/IntegrationsSettingsPage'));
const WebhooksSettingsPage = lazy(() => import('./pages/settings/WebhooksSettingsPage'));
const ApiKeysSettingsPage = lazy(() => import('./pages/settings/ApiKeysSettingsPage'));
const BillingSettingsPage = lazy(() => import('./pages/settings/BillingSettingsPage'));
const NotificationsSettingsPage = lazy(() => import('./pages/settings/NotificationsSettingsPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? (
    <ErrorBoundary>
      <>{children}</>
    </ErrorBoundary>
  ) : (
    <Navigate to="/auth/login" replace />
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-background text-foreground">
          <ErrorBoundary>
          {/* A chunk is fetched the first time its route is visited. */}
          <Suspense fallback={<PageLoader label="Loading…" />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/auth/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
            <Route path="/auth/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
            <Route path="/auth/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
            <Route path="/auth/verify-email" element={<PublicRoute><VerifyEmailPage /></PublicRoute>} />
            <Route path="/auth/oauth/callback" element={<PublicRoute><OAuthCallbackPage /></PublicRoute>} />

            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
            <Route path="/projects/:projectId" element={<ProtectedRoute><ProjectDetailPage /></ProtectedRoute>} />
            <Route path="/applications" element={<ProtectedRoute><ApplicationsPage /></ProtectedRoute>} />
            <Route path="/tests" element={<ProtectedRoute><TestCasesPage /></ProtectedRoute>} />
            <Route path="/test-suites" element={<ProtectedRoute><TestSuitesPage /></ProtectedRoute>} />
            <Route path="/runs" element={<ProtectedRoute><TestRunsPage /></ProtectedRoute>} />
            <Route path="/runs/:runId" element={<ProtectedRoute><TestRunDetailPage /></ProtectedRoute>} />
            <Route path="/bugs" element={<ProtectedRoute><BugsPage /></ProtectedRoute>} />
            <Route path="/bugs/:bugId" element={<ProtectedRoute><BugDetailPage /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/agents" element={<ProtectedRoute><AgentsPage /></ProtectedRoute>} />
            <Route path="/integrations" element={<ProtectedRoute><IntegrationsPage /></ProtectedRoute>} />
            <Route path="/docs" element={<ProtectedRoute><DocumentationPage /></ProtectedRoute>} />

            <Route path="/settings" element={<ProtectedRoute><SettingsLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/settings/profile" replace />} />
              <Route path="profile" element={<ProfileSettingsPage />} />
              <Route path="organization" element={<OrganizationSettingsPage />} />
              <Route path="members" element={<MembersSettingsPage />} />
              <Route path="integrations" element={<IntegrationsSettingsPage />} />
              <Route path="webhooks" element={<WebhooksSettingsPage />} />
              <Route path="api-keys" element={<ApiKeysSettingsPage />} />
              <Route path="billing" element={<BillingSettingsPage />} />
              <Route path="notifications" element={<NotificationsSettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
          </ErrorBoundary>
        </div>
        <PopupViewport />
      </Router>
    </QueryClientProvider>
  );
}

export default App;