import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import type { ReleaseRiskLevel } from '@prisma/client';

export interface ReleaseRiskAnalysis {
  gitCommitHash: string;
  branchName: string;
  changedFiles: number;
  affectedFeatures: number;
  historicalFailures: number;
  flakyTests: number;
  riskScore: number;
  riskLevel: ReleaseRiskLevel;
  recommendedTests: number;
  analysisDetails: {
    affectedTests: Array<{ id: string; title: string; failureRate?: number }>;
    highRiskAreas: string[];
    recommendations: string[];
  };
}

export const releaseRiskService = {
  /**
   * Calculate release risk score for a deployment
   */
  async calculateReleaseRisk(
    projectId: string,
    gitCommitHash: string,
    branchName: string,
    changedFiles: string[]
  ): Promise<ReleaseRiskAnalysis> {
    logger.info({ projectId, gitCommitHash, fileCount: changedFiles.length }, 'Calculating release risk');

    // Find tests that cover the changed files
    const affectedTests = await this.findAffectedTests(projectId, changedFiles);

    // Analyze historical failures for these tests
    const historicalFailures = await this.getHistoricalFailures(
      affectedTests.map((t) => t.id),
      30 // last 30 days
    );

    // Check for flaky tests in the affected set
    const flakyTests = await this.countFlakyTests(affectedTests.map((t) => t.id));

    // Calculate base risk score
    const riskScore = this.calculateRiskScore({
      changedFilesCount: changedFiles.length,
      affectedTestsCount: affectedTests.length,
      historicalFailures,
      flakyTests,
    });

    const riskLevel = this.getRiskLevel(riskScore);

    // Identify high-risk areas
    const highRiskAreas = this.identifyHighRiskAreas(changedFiles, affectedTests, historicalFailures);

    // Generate recommendations
    const recommendations = this.generateRecommendations(riskLevel, affectedTests.length, flakyTests);

    const analysis: ReleaseRiskAnalysis = {
      gitCommitHash,
      branchName,
      changedFiles: changedFiles.length,
      affectedFeatures: affectedTests.length,
      historicalFailures,
      flakyTests,
      riskScore,
      riskLevel,
      recommendedTests: affectedTests.length,
      analysisDetails: {
        affectedTests: affectedTests.map((t) => ({
          id: t.id,
          title: t.title,
          failureRate: t.failureRate,
        })),
        highRiskAreas,
        recommendations,
      },
    };

    // Save to database
    await prisma.releaseAnalysis.create({
      data: {
        projectId,
        gitCommitHash,
        branchName,
        changedFiles: changedFiles.length,
        affectedFeatures: affectedTests.length,
        historicalFailures,
        flakyTests,
        riskScore,
        riskLevel,
        recommendedTests: affectedTests.length,
        analysisDetails: analysis.analysisDetails as any,
      },
    });

    logger.info({ projectId, gitCommitHash, riskScore, riskLevel }, 'Release risk calculation complete');

    return analysis;
  },

  /**
   * Find tests that might be affected by file changes
   */
  async findAffectedTests(
    projectId: string,
    changedFiles: string[]
  ): Promise<Array<{ id: string; title: string; failureRate?: number }>> {
    // Get all tests for the project
    const tests = await prisma.testCase.findMany({
      where: {
        projectId,
        archivedAt: null,
      },
      include: {
        testResults: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Simple heuristic: tests that mention changed files or features
    // In a real implementation, this would use code coverage data
    const affectedTests = tests
      .map((test) => {
        // Check if test title or description mentions any changed files
        const testContent = `${test.title} ${test.description || ''}`.toLowerCase();
        const isAffected = changedFiles.some((file) => {
          const filename = file.split('/').pop()?.toLowerCase() || '';
          const feature = filename.split('.')[0];
          return testContent.includes(feature);
        });

        if (!isAffected && changedFiles.length > 5) {
          // If many files changed, consider all tests affected
          return { test, isAffected: true };
        }

        return { test, isAffected };
      })
      .filter((t) => t.isAffected)
      .map(({ test }) => {
        // Calculate failure rate
        const results = test.testResults;
        const failureRate =
          results.length > 0 ? results.filter((r) => r.status === 'FAILED').length / results.length : 0;

        return {
          id: test.id,
          title: test.title,
          failureRate,
        };
      });

    // If no specific tests found, return high-priority tests
    if (affectedTests.length === 0) {
      return tests
        .filter((t) => t.priority === 'high')
        .slice(0, 10)
        .map((t) => ({ id: t.id, title: t.title }));
    }

    return affectedTests;
  },

  /**
   * Get historical failure count for tests
   */
  async getHistoricalFailures(testCaseIds: string[], days: number): Promise<number> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const count = await prisma.testResult.count({
      where: {
        testCaseId: { in: testCaseIds },
        status: 'FAILED',
        createdAt: { gte: since },
      },
    });

    return count;
  },

  /**
   * Count flaky tests in the set
   */
  async countFlakyTests(testCaseIds: string[]): Promise<number> {
    const count = await prisma.flakyTestRecord.count({
      where: {
        testCaseId: { in: testCaseIds },
        flakyScore: { gte: 20 },
      },
    });

    return count;
  },

  /**
   * Calculate risk score (0-100)
   */
  calculateRiskScore(factors: {
    changedFilesCount: number;
    affectedTestsCount: number;
    historicalFailures: number;
    flakyTests: number;
  }): number {
    // Weights for different factors
    const weights = {
      changedFiles: 0.2,
      affectedTests: 0.2,
      historicalFailures: 0.4,
      flakyTests: 0.2,
    };

    // Normalize factors to 0-100 scale
    const normalizedChangedFiles = Math.min(factors.changedFilesCount * 2, 100);
    const normalizedAffectedTests = Math.min(factors.affectedTestsCount * 1.5, 100);
    const normalizedHistoricalFailures = Math.min(factors.historicalFailures * 5, 100);
    const normalizedFlakyTests = Math.min(factors.flakyTests * 10, 100);

    // Calculate weighted score
    const score =
      normalizedChangedFiles * weights.changedFiles +
      normalizedAffectedTests * weights.affectedTests +
      normalizedHistoricalFailures * weights.historicalFailures +
      normalizedFlakyTests * weights.flakyTests;

    return Math.round(Math.min(100, Math.max(0, score)));
  },

  /**
   * Determine risk level from score
   */
  getRiskLevel(score: number): ReleaseRiskLevel {
    if (score >= 75) return 'CRITICAL';
    if (score >= 50) return 'HIGH';
    if (score >= 25) return 'MEDIUM';
    return 'LOW';
  },

  /**
   * Identify high-risk areas based on changes and test history
   */
  identifyHighRiskAreas(
    changedFiles: string[],
    affectedTests: Array<{ title: string; failureRate?: number }>,
    historicalFailures: number
  ): string[] {
    const areas: string[] = [];

    // Check for critical file types
    const criticalPatterns = [
      { pattern: /auth|login|security/, area: 'Authentication & Security' },
      { pattern: /payment|billing|checkout/, area: 'Payment Processing' },
      { pattern: /database|migration|schema/, area: 'Database Schema' },
      { pattern: /api|endpoint|route/, area: 'API Endpoints' },
      { pattern: /config|env/, area: 'Configuration' },
    ];

    for (const { pattern, area } of criticalPatterns) {
      if (changedFiles.some((file) => pattern.test(file.toLowerCase()))) {
        areas.push(area);
      }
    }

    // Check test failure rates
    const highFailureTests = affectedTests.filter((t) => (t.failureRate || 0) > 0.3);
    if (highFailureTests.length > 0) {
      areas.push(`${highFailureTests.length} tests with high failure rates`);
    }

    // Historical failures
    if (historicalFailures > 10) {
      areas.push('Area with frequent recent failures');
    }

    if (areas.length === 0) {
      areas.push('No specific high-risk areas identified');
    }

    return areas;
  },

  /**
   * Generate recommendations based on risk analysis
   */
  generateRecommendations(
    riskLevel: ReleaseRiskLevel,
    affectedTestCount: number,
    flakyTestCount: number
  ): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'CRITICAL') {
      recommendations.push('⛔ Consider delaying deployment until issues are resolved');
      recommendations.push('Run full regression test suite');
      recommendations.push('Perform manual testing of critical paths');
      recommendations.push('Have rollback plan ready');
    } else if (riskLevel === 'HIGH') {
      recommendations.push('⚠️ Deploy during low-traffic hours');
      recommendations.push('Run all affected tests before deployment');
      recommendations.push('Monitor error rates closely after deployment');
      recommendations.push('Have team on standby for issues');
    } else if (riskLevel === 'MEDIUM') {
      recommendations.push('Run affected test suite');
      recommendations.push('Monitor dashboards after deployment');
      recommendations.push('Schedule deployment during business hours');
    } else {
      recommendations.push('✅ Safe to deploy with standard procedures');
      recommendations.push('Run smoke tests after deployment');
    }

    if (affectedTestCount > 0) {
      recommendations.push(`Execute ${affectedTestCount} affected tests before deployment`);
    }

    if (flakyTestCount > 0) {
      recommendations.push(`Fix or disable ${flakyTestCount} flaky tests to improve reliability`);
    }

    return recommendations;
  },

  /**
   * Get release risk history for a project
   */
  async getReleaseHistory(projectId: string, limit = 10) {
    return prisma.releaseAnalysis.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },
};
