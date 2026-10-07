import { formatDuration } from '../../lib/format';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { testRunsApi } from '../../api';
import { getErrorMessage } from '../../api/client';
import Layout from '../../components/Layout';
import {
  RefreshCw,
  Ban,
  ArrowLeft,
  ListChecks,
  ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  StatCard,
  PageHeader,
  PageLoader,
  RunStatusBadge,
  EmptyState,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  ButtonLoader } from '../../components/ui';
import type { TestRun, TestResult } from '../../types';
import { isActiveRecord, pollWhileActive } from '../../lib/polling';

const RESULT_STATUS_COLORS: Record<string, string> = {
  PASSED: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  FAILED: 'text-red-400 bg-red-500/10 border-red-500/20',
  SKIPPED: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
  PENDING: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
};

export default function TestRunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const queryClient = useQueryClient();

  const { data: run, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['test-run', runId],
    queryFn: () => testRunsApi.get(runId as string),
    enabled: !!runId,
    // Follow the run while it executes, then stop.
    refetchInterval: (q) => pollWhileActive(() => isActiveRecord(q.state.data), 3000),
  });

  const cancelRunMutation = useMutation({
    mutationFn: (id: string) => testRunsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-run', runId] });
      queryClient.invalidateQueries({ queryKey: ['test-runs'] });
      toast.success('Test run cancelled');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const testResults = (run as (TestRun & { testResults?: TestResult[] }))?.testResults ?? [];

  const isCancelable = !!run && ['PENDING', 'QUEUED', 'RUNNING'].includes(run.status);

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Link
          to="/runs"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Test Runs
        </Link>

        {isLoading && <PageLoader label="Loading run details..." />}

        {!isLoading && isError && (
          <div className="glass rounded-xl p-8 text-center">
            <p className="text-red-500 font-medium mb-4">Failed to load test run details.</p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors text-sm font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && run && (
          <>
            <PageHeader
              title={`Run #${run.id.slice(0, 8)}`}
              description={`Triggered ${new Date(run.createdAt).toLocaleString()}`}
              actions={
                <>
                  <button
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ['test-run', runId] });
                      toast.success('Run refreshed');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors text-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </button>
                  {isCancelable && (
                    <button
                      onClick={() => cancelRunMutation.mutate(run.id)}
                      disabled={cancelRunMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors text-sm text-red-500 disabled:opacity-50"
                    >
                      {cancelRunMutation.isPending ? (
                        <ButtonLoader />
                      ) : (
                        <Ban className="w-4 h-4" />
                      )}
                      Cancel Run
                    </button>
                  )}
                </>
              }
            />

            <div className="flex items-center gap-3 mb-8">
              <RunStatusBadge status={run.status} />
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              <StatCard label="Total Tests" value={run.totalTests} icon={ListChecks} />
              <StatCard label="Passed" value={run.passedTests} accent="success" />
              <StatCard label="Failed" value={run.failedTests} accent="danger" />
              <StatCard label="Skipped" value={run.skippedTests} />
              <StatCard label="Duration" value={formatDuration(run.duration)} />
              <StatCard
                label="Completed"
                value={run.executionCompletedAt ? new Date(run.executionCompletedAt).toLocaleString() : '—'}
              />
            </div>

            {/* Results */}
            <h2 className="text-xl font-semibold mb-4 gradient-text">Results</h2>

            {testResults.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="No results yet"
                description="Results will appear here once the run starts executing test cases."
              />
            ) : (
              <div className="glass rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Test Case</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {testResults.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell className="font-medium">
                          {result.testCase?.title ?? result.testCaseId}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${RESULT_STATUS_COLORS[result.status] ?? 'text-muted-foreground bg-secondary border-border'}`}>
                            {result.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDuration(result.duration)}
                        </TableCell>
                        <TableCell className="max-w-md">
                          {result.errorMessage ? (
                            <details className="group">
                              <summary className="flex items-center gap-1.5 text-xs text-red-400 cursor-pointer list-none">
                                <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                                <span className="line-clamp-1">{result.errorMessage}</span>
                              </summary>
                              <p className="mt-2 text-xs text-muted-foreground bg-secondary/40 rounded-lg p-3 whitespace-pre-wrap break-words">
                                {result.errorMessage}
                              </p>
                            </details>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </motion.div>
    </Layout>
  );
}