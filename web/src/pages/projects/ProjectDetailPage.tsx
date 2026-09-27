import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../../api';
import { getErrorMessage, getErrorKind } from '../../api/client';
import Layout from '../../components/Layout';
import {
  PageLoader,
  EmptyState,
  StatCard,
  RunStatusBadge,
  ErrorState,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui';
import {
  ArrowLeft,
  FileText,
  PlaySquare,
  Bug,
  CheckCircle2,
  FlaskConical,
  Layers,
} from 'lucide-react';
import type { TestRun } from '../../types';

interface ProjectDashboard {
  project: {
    id: string;
    name: string;
    description: string | null;
    archivedAt: string | null;
  };
  counts: {
    totalTests: number;
    totalRuns: number;
    passedRuns: number;
    failedRuns: number;
    openBugs: number;
  };
  recentRuns: TestRun[];
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['project-dashboard', projectId],
    queryFn: () => projectsApi.dashboard(projectId as string),
    enabled: !!projectId,
  });

  const dashboard = data as ProjectDashboard | undefined;
  const project = dashboard?.project;
  const counts = dashboard?.counts;
  const recentRuns = dashboard?.recentRuns ?? [];

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
            <Link
              to="/projects"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Projects
            </Link>
            <h1 className="text-4xl font-bold mb-2 gradient-text">
              {project?.name || 'Project'}
            </h1>
            <p className="text-muted-foreground">
              {project?.description || 'No description provided'}
            </p>
          </div>
        </div>

        {isLoading && <PageLoader label="Loading project..." />}

        {!isLoading && isError && (
          <ErrorState
            kind={getErrorKind(error)}
            title="Failed to load project"
            description={getErrorMessage(error)}
            onRetry={() => void refetch()}
            isRetrying={isFetching}
          />
        )}

        {!isLoading && !isError && (
          <>
            {/* Stats */}
            {counts && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                  label="Total Test Cases"
                  value={counts.totalTests}
                  icon={FileText}
                />
                <StatCard
                  label="Test Runs"
                  value={counts.totalRuns}
                  icon={PlaySquare}
                />
                <StatCard
                  label="Passed Runs"
                  value={counts.passedRuns}
                  icon={CheckCircle2}
                  accent="success"
                />
                <StatCard
                  label="Open Bugs"
                  value={counts.openBugs}
                  icon={Bug}
                  accent="danger"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 mb-8">
              <Link
                to={`/tests?projectId=${projectId}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-600/90 text-white rounded-lg text-sm font-medium"
              >
                <FlaskConical className="w-4 h-4" />
                New Test Case
              </Link>
              <Link
                to={`/runs?projectId=${projectId}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-600/90 text-white rounded-lg text-sm font-medium"
              >
                <PlaySquare className="w-4 h-4" />
                New Run
              </Link>
              <Link
                to={`/bugs?projectId=${projectId}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg text-sm font-medium"
              >
                <Bug className="w-4 h-4" />
                View Bugs
              </Link>
              <Link
                to={`/applications?projectId=${projectId}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg text-sm font-medium"
              >
                <Layers className="w-4 h-4" />
                Add Application
              </Link>
            </div>

            {/* Recent Runs */}
            <div className="glass p-6 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">Recent Runs</h3>
                {recentRuns.length > 0 && (
                  <button
                    onClick={() => navigate(`/runs?projectId=${projectId}`)}
                    className="text-sm text-red-500 hover:underline"
                  >
                    View all
                  </button>
                )}
              </div>

              {recentRuns.length === 0 ? (
                <EmptyState
                  icon={PlaySquare}
                  title="No recent runs"
                  description="Kick off a test run to see results here."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total Tests</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentRuns.map((run) => (
                      <TableRow key={run.id} className="cursor-pointer" onClick={() => navigate(`/runs/${run.id}`)}>
                        <TableCell>
                          <Link to={`/runs/${run.id}`} className="text-red-500 hover:underline font-mono text-sm">
                            {run.id.slice(0, 8)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <RunStatusBadge status={run.status} />
                        </TableCell>
                        <TableCell>{run.totalTests}</TableCell>
                        <TableCell>{new Date(run.createdAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </>
        )}
      </motion.div>
    </Layout>
  );
}