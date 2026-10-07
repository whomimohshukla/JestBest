import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge, EmptyState, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui';
import { flakyScoreVariant } from '../lib/flakyScore';
import type { FlakyTest } from '../types';

/**
 * Flaky tests are cases that pass and fail without a code change. They are the
 * single most misleading signal a test suite can produce (a red build gets
 * retried, a real regression gets waved through), so Analytics surfaces them
 * as a first-class list rather than burying the number inside the quality
 * score.
 */
export function FlakyTestsList({ tests }: { tests: FlakyTest[] }) {
  if (tests.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        iconSize="sm"
        title="No flaky tests detected"
        description="Records are written after runs complete. Tests that alternate between pass and fail will appear here."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Test case</TableHead>
          <TableHead scope="col">Pattern</TableHead>
          <TableHead scope="col">Pass / fail</TableHead>
          <TableHead scope="col">Flaky score</TableHead>
          <TableHead scope="col">Last occurred</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tests.map((test) => (
          <TableRow key={test.testCaseId}>
            <TableCell>
              <p className="font-medium">{test.testCaseTitle}</p>
              <p
                className="mt-0.5 max-w-[36ch] truncate text-xs text-muted-foreground"
                title={test.rootCauseAnalysis}
              >
                {test.rootCauseAnalysis}
              </p>
            </TableCell>
            <TableCell className="text-muted-foreground">{test.pattern}</TableCell>
            <TableCell className="whitespace-nowrap tabular-nums">
              <span className="text-emerald-500">{test.passCount}</span>
              <span className="text-muted-foreground"> / </span>
              <span className="text-red-500">{test.failCount}</span>
              <span className="text-xs text-muted-foreground"> of {test.totalRuns}</span>
            </TableCell>
            <TableCell>
              <Badge variant={flakyScoreVariant(test.flakyScore)}>{Math.round(test.flakyScore)}</Badge>
            </TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              {new Date(test.lastOccurred).toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function FlakyTestsPanel({ tests, isLoading }: { tests: FlakyTest[]; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading flaky tests">
        {[0, 1].map((row) => (
          <div key={row} className="h-9 animate-pulse rounded-lg bg-secondary/60" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-semibold">Flaky Tests</h3>
            <p className="text-xs text-muted-foreground">
              Pass/fail without a code change — ranked by flakiness
            </p>
          </div>
        </div>
        <Badge variant={tests.length > 0 ? 'warning' : 'secondary'}>
          {tests.length} detected
        </Badge>
      </div>
      <FlakyTestsList tests={tests} />
    </div>
  );
}
