import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Activity,
  Bug,
  CheckCircle2,
  FolderKanban,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { analyticsApi } from '../../api';
import Layout from '../../components/Layout';
import { PageHeader, StatCard, PageLoader, EmptyState, Badge } from '../../components/ui';
import type { DashboardAnalytics, TestMetricsResponse } from '../../types';

export default function AnalyticsPage() {
  const {
    data: dash,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<DashboardAnalytics>({
    queryKey: ['analytics-dashboard'],
    queryFn: () => analyticsApi.dashboard(),
  });

  const { data: metrics } = useQuery<TestMetricsResponse>({
    queryKey: ['analytics-test-metrics'],
    queryFn: () => analyticsApi.testMetrics({}),
  });

  const daily = metrics?.daily ?? [];
  const totals = metrics?.totals;
  const passRate = totals && totals.passRate != null ? `${totals.passRate}%` : '—';

  const stats = [
    { label: 'Total Test Cases', value: dash?.totalCases ?? 0, icon: Activity, accent: 'info' as const },
    { label: 'Pass Rate', value: passRate, icon: CheckCircle2, accent: 'success' as const },
    { label: 'Open Bugs', value: dash?.openBugs ?? 0, icon: Bug, accent: 'danger' as const },
    { label: 'Project Count', value: dash?.projects?.length ?? 0, icon: FolderKanban, accent: 'default' as const },
  ];

  return (
    <Layout>
      <PageHeader
        title="Analytics"
        description="Quality metrics, test trends and release risk across your workspace"
      />

      {isLoading ? (
        <PageLoader label="Loading analytics..." />
      ) : isError ? (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-red-500 font-medium mb-4">Failed to load analytics.</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Retry
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return <StatCard key={stat.label} label={stat.label} value={stat.value} icon={Icon} accent={stat.accent} />;
            })}
          </div>

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
                  <Badge variant={dash.risk.riskLevel === 'LOW' ? 'success' : dash.risk.riskLevel === 'MEDIUM' ? 'info' : 'warning'}>
                    {dash.risk.riskLevel}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <span className="text-5xl font-extrabold gradient-text">{dash.risk.riskScore}</span>
                  <div className="flex-1">
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full transition-all ${
                          dash.risk.riskLevel === 'CRITICAL'
                            ? 'bg-red-500'
                            : dash.risk.riskLevel === 'HIGH'
                              ? 'bg-orange-500'
                              : dash.risk.riskLevel === 'MEDIUM'
                                ? 'bg-yellow-400'
                                : 'bg-emerald-500'
                        }`}
                        style={{ width: `${dash.risk.riskScore}%` }}
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

          {/* Trend Chart */}
          <div className="glass p-6 rounded-xl">
            <div className="mb-5">
              <h3 className="text-lg font-semibold">Test Run Trends (30d)</h3>
              <p className="text-sm text-muted-foreground">Passed vs failed executions per day</p>
            </div>
            {daily.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No trend data yet"
                description="Run some tests to start tracking daily trends."
              />
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={daily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#71717a' }} stroke="#27272a" />
                    <YAxis tick={{ fontSize: 12, fill: '#71717a' }} stroke="#27272a" />
                    <Tooltip
                      contentStyle={{ background: '#111113', border: '1px solid #27272a', borderRadius: 8 }}
                      labelStyle={{ color: '#fafafa' }}
                      itemStyle={{ color: '#e4e4e7' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#71717a' }} />
                    <Line type="monotone" dataKey="passed" name="Passed" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="failed" name="Failed" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Totals Summary */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="glass p-5 rounded-xl">
              <p className="text-sm text-muted-foreground mb-1">Total Runs</p>
              <p className="text-2xl font-bold">{totals?.runs ?? 0}</p>
            </div>
            <div className="glass p-5 rounded-xl">
              <p className="text-sm text-muted-foreground mb-1">Passed</p>
              <p className="text-2xl font-bold text-red-500">{totals?.passed ?? 0}</p>
            </div>
            <div className="glass p-5 rounded-xl">
              <p className="text-sm text-muted-foreground mb-1">Failed</p>
              <p className="text-2xl font-bold text-red-500">{totals?.failed ?? 0}</p>
            </div>
            <div className="glass p-5 rounded-xl">
              <p className="text-sm text-muted-foreground mb-1">Skipped</p>
              <p className="text-2xl font-bold text-muted-foreground">{totals?.skipped ?? 0}</p>
            </div>
          </div>
        </motion.div>
      )}
    </Layout>
  );
}