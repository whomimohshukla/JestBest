import type { Job } from 'bullmq';
import { processFailureAnalysisJob } from '../../../src/jobs/failureAnalysis';
import { failureAnalyzerAgent } from '../../../src/services/ai/failureAnalyzerAgent';
import { bugDetectionService } from '../../../src/services/bug/bugDetectionService';
import { testResultRepository } from '../../../src/repositories/testResult.repository';

jest.mock('../../../src/services/ai/failureAnalyzerAgent', () => ({
  failureAnalyzerAgent: { execute: jest.fn() },
}));
jest.mock('../../../src/services/bug/bugDetectionService', () => ({
  bugDetectionService: { detect: jest.fn() },
}));
jest.mock('../../../src/repositories/testResult.repository', () => ({
  testResultRepository: { findById: jest.fn(), update: jest.fn() },
}));
jest.mock('../../../src/config/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

const analyzerMock = failureAnalyzerAgent as jest.Mocked<typeof failureAnalyzerAgent>;
const detectMock = bugDetectionService as jest.Mocked<typeof bugDetectionService>;
const repoMock = testResultRepository as jest.Mocked<typeof testResultRepository>;

const job = (data: Record<string, unknown>): Job =>
  ({ name: 'analyze-failure', data } as unknown as Job);

describe('processFailureAnalysisJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    analyzerMock.execute.mockResolvedValue({
      output: { analysis: { category: 'ElementNotFound' } },
    } as never);
    detectMock.detect.mockResolvedValue({ bugsCreated: 0 });
    repoMock.findById.mockResolvedValue({
      id: 'r1',
      errorMessage: 'boom',
      consoleLog: [],
      domSnapshot: '{}',
      testCase: { title: 'case' },
    } as never);
    repoMock.update.mockResolvedValue({} as never);
  });

  it('analyzes every failing result in the run, not just the first', async () => {
    const failingResults = [
      { testResultId: 'r1', testCaseId: 'c1', testCaseTitle: 'first failure' },
      { testResultId: 'r2', testCaseId: 'c2', testCaseTitle: 'second failure' },
    ];

    await processFailureAnalysisJob(
      job({ testResultId: 'r1', organizationId: 'org', testRunId: 'run', projectId: 'proj', failingResults })
    );

    expect(analyzerMock.execute).toHaveBeenCalledTimes(2);
    expect(repoMock.update).toHaveBeenCalledTimes(2);
    expect(repoMock.update).toHaveBeenCalledWith('r1', expect.objectContaining({ failureAnalysis: expect.anything() }));
    expect(repoMock.update).toHaveBeenCalledWith('r2', expect.objectContaining({ failureAnalysis: expect.anything() }));
    expect(detectMock.detect).toHaveBeenCalledWith(
      expect.objectContaining({ failingResults, testRunId: 'run', projectId: 'proj' })
    );
  });

  it('still analyzes a single testResultId when no failingResults list is present', async () => {
    await processFailureAnalysisJob(
      job({ testResultId: 'r1', organizationId: 'org', testRunId: 'run', projectId: 'proj' })
    );

    expect(analyzerMock.execute).toHaveBeenCalledTimes(1);
    expect(repoMock.update).toHaveBeenCalledWith('r1', expect.objectContaining({ failureAnalysis: expect.anything() }));
    expect(detectMock.detect).toHaveBeenCalledWith(
      expect.objectContaining({ failingResults: [{ testResultId: 'r1', testCaseId: '', testCaseTitle: '' }] })
    );
  });

  it('skips results that no longer exist without aborting the whole job', async () => {
    (repoMock.findById as jest.Mock).mockImplementation(async (id: string) =>
      id === 'r1' ? ({ id: 'r1', errorMessage: 'x', consoleLog: [], testCase: { title: 't' } } as never) : null
    );

    await processFailureAnalysisJob(
      job({
        testResultId: 'r1',
        organizationId: 'org',
        testRunId: 'run',
        failingResults: [
          { testResultId: 'r1', testCaseId: 'c1', testCaseTitle: 'ok' },
          { testResultId: 'missing', testCaseId: 'c2', testCaseTitle: 'gone' },
        ],
      })
    );

    expect(analyzerMock.execute).toHaveBeenCalledTimes(1);
    expect(repoMock.update).toHaveBeenCalledTimes(1);
  });
});
