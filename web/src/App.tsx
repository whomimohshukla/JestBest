import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PopupViewport } from './components/ui/PopupViewport';
import { useAuthStore } from './store/authStore';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Pages
import LandingPage from './pages/LandingPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import OAuthCallbackPage from './pages/auth/OAuthCallbackPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import ProjectsPage from './pages/projects/ProjectsPage';
import ProjectDetailPage from './pages/projects/ProjectDetailPage';
import ApplicationsPage from './pages/applications/ApplicationsPage';
import TestCasesPage from './pages/tests/TestCasesPage';
import TestSuitesPage from './pages/tests/TestSuitesPage';
import TestRunsPage from './pages/testRuns/TestRunsPage';
import TestRunDetailPage from './pages/testRuns/TestRunDetailPage';
import BugsPage from './pages/bugs/BugsPage';
import BugDetailPage from './pages/bugs/BugDetailPage';
import AnalyticsPage from './pages/analytics/AnalyticsPage';
import AgentsPage from './pages/agents/AgentsPage';
import IntegrationsPage from './pages/integrations/IntegrationsPage';
import DocumentationPage from './pages/DocumentationPage';
import SettingsLayout from './pages/settings/SettingsLayout';
import ProfileSettingsPage from './pages/settings/ProfileSettingsPage';
import OrganizationSettingsPage from './pages/settings/OrganizationSettingsPage';
import MembersSettingsPage from './pages/settings/MembersSettingsPage';
import IntegrationsSettingsPage from './pages/settings/IntegrationsSettingsPage';
import WebhooksSettingsPage from './pages/settings/WebhooksSettingsPage';
import ApiKeysSettingsPage from './pages/settings/ApiKeysSettingsPage';
import BillingSettingsPage from './pages/settings/BillingSettingsPage';
import NotificationsSettingsPage from './pages/settings/NotificationsSettingsPage';

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
          </ErrorBoundary>
        </div>
        <PopupViewport />
      </Router>
    </QueryClientProvider>
  );
}

export default App;