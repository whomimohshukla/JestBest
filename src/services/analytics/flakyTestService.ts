import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

export interface FlakyTestAnalysis {
  testCaseId: string;
  testCaseTitle: string;
  totalRuns: number;
  passCount: number;
  failCount: number;
  flakyScore: number;
  rootCauseAnalysis: string;
  lastOccurred: Date;
  pattern: string;
}

export const flakyTestService = {
  /**
   * Detect flaky tests for a project
   * A test is considered flaky if it sometimes passes and sometimes fails
   * without code changes
   */
  async detectFlakyTests(projectId: string, minRuns = 10): Promise<FlakyTestAnalysis[]> {
    logger.info({ projectId }, 'Detecting flaky tests');

    // Get all test cases for the project with recent results
    const testCases = await prisma.testCase.findMany({
      where: {
        projectId,
        archivedAt: null,
      },
      include: {
        testResults: {
          take: 100,
          orderBy: { createdAt: 'desc' },
          include: {
            testRun: {
              select: {
                id: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    const flakyTests: FlakyTestAnalysis[] = [];

    for (const testCase of testCases) {
      const results = testCase.testResults;
      const total = results.length;

      // Need enough data to determine flakiness
      if (total < minRuns) continue;

      const passed = results.filter((r) => r.status === 'PASSED').length;
      const failed = results.filter((r) => r.status === 'FAILED').length;

      // Skip if all passed or all failed (not flaky, just consistently good/bad)
      if (passed === 0 || failed === 0) continue;

      // Calculate flaky score: how often does it alternate between pass/fail
      // Higher score = more flaky
      const flakyScore = this.calculateFlakinessScore(results);

      // Only consider it flaky if score is above threshold
      if (flakyScore < 15) continue;

      // Analyze the pattern
      const pattern = this.detectPattern(results);
      const rootCause = this.analyzeRootCause(results, pattern);

      const lastFailure = results.find((r) => r.status === 'FAILED');

      flakyTests.push({
        testCaseId: testCase.id,
        testCaseTitle: testCase.title,
        totalRuns: total,
        passCount: passed,
        failCount: failed,
        flakyScore,
        rootCauseAnalysis: rootCause,
        lastOccurred: lastFailure?.createdAt || new Date(),
        pattern,
      });
    }

    // Save to database
    for (const flaky of flakyTests) {
      await prisma.flakyTestRecord.upsert({
        where: { testCaseId: flaky.testCaseId },
        update: {
          totalRuns: flaky.totalRuns,
          passCount: flaky.passCount,
          failCount: flaky.failCount,
          flakyScore: flaky.flakyScore,
          rootCauseAnalysis: flaky.rootCauseAnalysis,
          lastOccurredAt: flaky.lastOccurred,
          updatedAt: new Date(),
        },
        create: {
          testCaseId: flaky.testCaseId,
          totalRuns: flaky.totalRuns,
          passCount: flaky.passCount,
          failCount: flaky.failCount,
          flakyScore: flaky.flakyScore,
          rootCauseAnalysis: flaky.rootCauseAnalysis,
          lastOccurredAt: flaky.lastOccurred,
        },
      });
    }

    logger.info({ projectId, count: flakyTests.length }, 'Flaky test detection complete');

    return flakyTests.sort((a, b) => b.flakyScore - a.flakyScore);
  },

  /**
   * Calculate flakiness score (0-100)
   * Higher = more flaky
   */
  calculateFlakinessScore(results: Array<{ status: string; createdAt: Date }>): number {
    if (results.length < 2) return 0;

    // Count alternations (pass -> fail or fail -> pass)
    let alternations = 0;
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1].status;
      const curr = results[i].status;

      if ((prev === 'PASSED' && curr === 'FAILED') || (prev === 'FAILED' && curr === 'PASSED')) {
        alternations++;
      }
    }

    // Calculate percentage of runs that are alternations
    const alternationRate = (alternations / (results.length - 1)) * 100;

    // Also factor in the ratio of pass/fail
    const passed = results.filter((r) => r.status === 'PASSED').length;
    const failed = results.filter((r) => r.status === 'FAILED').length;
    const balanceScore = (Math.min(passed, failed) / results.length) * 100;

    // Combine both factors
    const score = alternationRate * 0.6 + balanceScore * 0.4;

    return Math.round(Math.min(100, score));
  },

  /**
   * Detect patterns in test failures
   */
  detectPattern(results: Array<{ status: string; createdAt: Date }>): string {
    const statuses = results.map((r) => r.status);

    // Check for time-based patterns
    const hourOfDay = results.filter((r) => r.status === 'FAILED').map((r) => r.createdAt.getHours());

    const hourCounts: Record<number, number> = {};
    hourOfDay.forEach((hour) => {
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const mostCommonHour = Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0];

    if (mostCommonHour && mostCommonHour[1] > results.length * 0.3) {
      return `Time-based: Fails often around ${mostCommonHour[0]}:00`;
    }

    // Check for sequential patterns
    const passFailPattern = statuses.slice(0, 10).join(',');
    if (passFailPattern.includes('PASSED,FAILED,PASSED,FAILED')) {
      return 'Alternating: Regularly switches between pass and fail';
    }

    // Check for burst failures
    let maxConsecutiveFails = 0;
    let currentConsecutive = 0;
    statuses.forEach((status) => {
      if (status === 'FAILED') {
        currentConsecutive++;
        maxConsecutiveFails = Math.max(maxConsecutiveFails, currentConsecutive);
      } else {
        currentConsecutive = 0;
      }
    });

    if (maxConsecutiveFails >= 3) {
      return `Burst failures: Up to ${maxConsecutiveFails} consecutive failures`;
    }

    return 'Random: No clear pattern detected';
  },

  /**
   * Analyze potential root causes
   */
  analyzeRootCause(
    results: Array<{ status: string; errorMessage?: string | null; createdAt: Date }>,
    pattern: string
  ): string {
    const failedResults = results.filter((r) => r.status === 'FAILED');

    if (failedResults.length === 0) return 'Unknown';

    // Check error messages for common issues
    const errorMessages = failedResults.map((r) => r.errorMessage).filter(Boolean) as string[];

    const causes: string[] = [];

    // Timing issues
    if (
      errorMessages.some(
        (msg) =>
          msg.toLowerCase().includes('timeout') ||
          msg.toLowerCase().includes('wait') ||
          msg.toLowerCase().includes('not ready')
      )
    ) {
      causes.push('Timing/synchronization issues');
    }

    // Network issues
    if (
      errorMessages.some(
        (msg) =>
          msg.toLowerCase().includes('network') ||
          msg.toLowerCase().includes('connection') ||
          msg.toLowerCase().includes('fetch')
      )
    ) {
      causes.push('Network instability');
    }

    // Race conditions
    if (pattern.includes('Alternating') || pattern.includes('Random')) {
      causes.push('Possible race condition');
    }

    // Time-based
    if (pattern.includes('Time-based')) {
      causes.push('Time-dependent behavior (timezone, cron, etc.)');
    }

    // Element not found
    if (
      errorMessages.some(
        (msg) => msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('does not exist')
      )
    ) {
      causes.push('Dynamic elements or unstable selectors');
    }

    if (causes.length === 0) {
      return 'Unknown - requires manual investigation';
    }

    return causes.join('; ');
  },

  /**
   * Get flaky tests for a project
   */
  async getFlakyTests(projectId: string, limit = 50): Promise<FlakyTestAnalysis[]> {
    // Fetch the project's test-case ids first so the record query can be scoped
    // in SQL. The previous version selected every FlakyTestRecord in the
    // database and filtered in JS, which both scanned rows belonging to other
    // tenants and returned their test-case ids, titles and root-cause analysis
    // to the caller before discarding them.
    const testCases = await prisma.testCase.findMany({
      where: {
        projectId,
        archivedAt: null,
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (testCases.length === 0) return [];

    const titleById = new Map(testCases.map((tc) => [tc.id, tc.title]));
    const records = await prisma.flakyTestRecord.findMany({
      where: {
        testCaseId: { in: [...titleById.keys()] },
        flakyScore: { gte: 15 },
      },
      orderBy: { flakyScore: 'desc' },
      take: limit,
    });

    return records.map((r) => ({
      testCaseId: r.testCaseId,
      testCaseTitle: titleById.get(r.testCaseId) || 'Unknown',
      totalRuns: r.totalRuns,
      passCount: r.passCount,
      failCount: r.failCount,
      flakyScore: r.flakyScore,
      rootCauseAnalysis: r.rootCauseAnalysis || 'Unknown',
      lastOccurred: r.lastOccurredAt || r.updatedAt,
      pattern: 'See analysis',
    }));
  },
};
