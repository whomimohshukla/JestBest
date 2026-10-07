import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Layout from '../../components/Layout';
import {
  Activity,
  CheckCircle2,
  Bug,
  FolderKanban,
  ArrowRight,
  AlertTriangle,
  ShieldAlert,
  PlaySquare,
  Plus,
  RefreshCcw,
} from 'lucide-react';
import { analyticsApi, projectsApi } from '../../api';
import { PageHeader, StatCard, Skeleton, SkeletonCard, SkeletonRows, EmptyState, RunStatusBadge, Badge } from '../../components/ui';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../api/client';
import type { Project, TestRun, DashboardAnalytics } from '../../types';

export default function DashboardPage() {
  // The quality score and release-risk cards are project-scoped on the server:
  // the API returns them only when `projectId` is supplied, and always returned
  // null before, so both cards silently never rendered. The selector below is
  // what makes them populate.
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const {
    data: dash,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<DashboardAnalytics>({
    queryKey: ['dashboard-analytics', selectedProjectId],
    queryFn: () =>
      analyticsApi.dashboard(selectedProjectId || undefined) as Promise<DashboardAnalytics>,
  });

  const { data: projects } = useQuery<{ items: Project[] }>({
    queryKey: ['projects', 'dashboard'],
    // The API caps pageSize at 100; 200 was rejected with a 400.
    queryFn: () => projectsApi.list({ pageSize: 100 }) as Promise<{ items: Project[] }>,
    enabled: !isLoading,
  });

  const recentRuns: TestRun[] = dash?.recentRuns ?? [];
  const projectList: Project[] = projects?.items ?? [];

  const stats = [
    {
      label: 'Total Tests',
      value: dash?.totalCases ?? 0,
      icon: Activity,
      accent: 'info' as const,
      href: '/tests',
    },
    {
      label: 'Passing Run Rate',
      value: recentRuns.length
        ? `${Math.round((recentRuns.filter((r) => r.status === 'PASSED').length / recentRuns.length) * 100)}%`
        : '—',
      icon: CheckCircle2,
      accent: 'success' as const,
      href: '/runs',
    },
    {
      label: 'Open Bugs',
      value: dash?.openBugs ?? 0,
      icon: Bug,
      accent: 'danger' as const,
      href: '/bugs',
    },
    {
      label: 'Active Projects',
      value: projectList.filter((p) => !p.archivedAt).length,
      icon: FolderKanban,
      accent: 'default' as const,
      href: '/projects',
    },
  ];

  const handleRefresh = async () => {
    try {
      await refetch();
      toast.success('Dashboard refreshed');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here's what's happening across your QA."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isFetching}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-50"
            >
              <RefreshCcw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              to="/tests"
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-destructive-foreground shadow-lg shadow-primary/25 hover:bg-red-600/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Test Case
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="dashboard-project" className="text-sm text-muted-foreground">
          Project
        </label>
        <select
          id="dashboard-project"
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium"
        >
          <option value="">All projects</option>
          {projectList.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {!selectedProjectId && (
          <p className="text-xs text-muted-foreground">
            Quality score and release risk are computed per project — pick one to see them.
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-card/50 p-5">
                <Skeleton className="mb-3 h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="rounded-xl border border-border/60 bg-card/50 p-6">
            <Skeleton className="mb-4 h-5 w-32" />
            <SkeletonRows rows={4} />
          </div>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-card/50 px-6 py-20 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <div>
            <h3 className="text-lg font-semibold">Failed to load dashboard</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              We couldn't reach the API. Make sure the backend is running and try again.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
          >
            <RefreshCcw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Try again
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          {/* Quality & Risk */}
          <div className="grid gap-4 md:grid-cols-2">
            {dash?.quality && (
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground">Quality Score</h3>
                  <Badge variant={dash.quality.level === 'LOW' ? 'success' : dash.quality.level === 'MEDIUM' ? 'info' : 'warning'}>
                    {dash.quality.level}
                  </Badge>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold gradient-text">{dash.quality.score}</span>
                  <span className="text-sm text-muted-foreground">/ 100</span>
                </div>
                <div className="mt-4 space-y-3">
                  {[
                    { label: 'Pass rate', value: dash.quality.components.passRate },
                    { label: 'Test coverage', value: dash.quality.components.testCoverage },
                    { label: 'Bug burden', value: dash.quality.components.bugBurden },
                    { label: 'Flakiness', value: dash.quality.components.flakiness },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>{item.label}</span>
                        <span>{item.value}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-700 transition-all"
                          style={{ width: `${Math.min(100, item.value)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {dash?.risk && (
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground">Release Risk</h3>
                  <Badge variant={dash.risk.riskLevel === 'LOW' ? 'success' : dash.risk.riskLevel === 'MEDIUM' ? 'warning' : 'destructive'}>
                    {dash.risk.riskLevel}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <span className="text-5xl font-extrabold gradient-text">{dash.risk.riskScore}</span>
                  <div className="flex-1">
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full transition-all ${
                          dash.risk.riskLevel === 'CRITICAL' || dash.risk.riskLevel === 'HIGH'
                            ? 'bg-red-500'
                            : dash.risk.riskLevel === 'MEDIUM'
                              ? 'bg-yellow-400'
                              : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, dash.risk.riskScore)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-secondary/40 p-3">
                    <p className="text-lg font-bold text-red-400">{dash.risk.details.openCriticalBugs}</p>
                    <p className="text-xs text-muted-foreground">Critical bugs</p>
                  </div>
                  <div className="rounded-lg bg-secondary/40 p-3">
                    <p className="text-lg font-bold">{dash.risk.details.failureRate}%</p>
                    <p className="text-xs text-muted-foreground">Failure rate</p>
                  </div>
                  <div className="rounded-lg bg-secondary/40 p-3">
                    <p className="text-lg font-bold">{dash.risk.details.qualityScore}</p>
                    <p className="text-xs text-muted-foreground">Quality</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Link key={stat.label} to={stat.href} className="block">
                  <StatCard
                    label={stat.label}
                    value={stat.value}
                    icon={Icon}
                    accent={stat.accent}
                  />
                </Link>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Recent runs */}
            <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Recent Test Runs</h3>
                  <p className="text-sm text-muted-foreground">Latest executions across projects</p>
                </div>
                <Link to="/runs" className="inline-flex items-center gap-1 text-sm text-red-500 hover:underline">
                  View all <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {recentRuns.length === 0 ? (
                <EmptyState
                  icon={PlaySquare}
                  title="No test runs yet"
                  description="Create a test case and run it to see results here."
                  action={
                    <Link to="/tests" className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-red-600/90">
                      <Plus className="h-4 w-4" /> Create test case
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {recentRuns.slice(0, 6).map((run) => (
                    <Link
                      key={run.id}
                      to={`/runs/${run.id}`}
                      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-secondary/20 p-4 transition-colors hover:bg-secondary/40"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            run.status === 'PASSED'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : run.status === 'FAILED'
                                ? 'bg-red-500/10 text-red-400'
                                : 'bg-secondary text-muted-foreground'
                          }`}
                        >
                          {run.status === 'PASSED' ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : run.status === 'FAILED' ? (
                            <Bug className="h-4 w-4" />
                          ) : (
                            <Activity className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            Run #{run.id.slice(0, 8)} · {(run.projectId ?? '').slice(0, 8)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {new Date(run.createdAt).toLocaleString()} · {run.totalTests} tests
                          </p>
                        </div>
                      </div>
                      <RunStatusBadge status={run.status} />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Projects */}
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Projects</h3>
                  <p className="text-sm text-muted-foreground">Your active projects</p>
                </div>
                <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-red-500 hover:underline">
                  View all <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {projectList.length === 0 ? (
                <EmptyState
                  icon={FolderKanban}
                  title="No projects yet"
                  description="Create your first project to start automating tests."
                  action={
                    <Link to="/projects" className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-red-600/90">
                      <Plus className="h-4 w-4" /> New project
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {projectList.slice(0, 5).map((project) => (
                    <Link
                      key={project.id}
                      to={`/projects/${project.id}`}
                      className="flex items-center gap-3 rounded-lg border border-border bg-secondary/20 p-3 transition-colors hover:bg-secondary/40"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-600/10 text-red-500">
                        <FolderKanban className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{project.name}</p>
                        <p className="text-xs text-muted-foreground">Created {new Date(project.createdAt).toLocaleDateString()}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Alert banner if critical bugs */}
          {Number(dash?.openBugs) > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-red-500/10 p-5">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p className="font-medium text-red-400">
                  {dash?.openBugs} open bug{dash?.openBugs === 1 ? '' : 's'} require attention
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  High-quality releases start with resolving known issues. Review the open bugs in your projects.
                </p>
                <Link
                  to="/bugs"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/30 transition-colors"
                >
                  <ShieldAlert className="h-4 w-4" />
                  Review bugs
                </Link>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </Layout>
  );
}