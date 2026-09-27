import { llmService, type LlmMessage } from './llmService';
import { knowledgeService } from './knowledgeService';
import type { AgentContext, AgentResult } from './agentService';

export interface FailureAnalyzerInput {
  errorMessage?: string;
  stackTrace?: string;
  consoleLog?: string[];
  domSnapshot?: unknown;
  networkLog?: unknown;
  testTitle?: string;
  testSteps?: unknown;
  failedStep?: unknown;
}

export interface FailureAnalysis {
  rootCause: string;
  category: 'selector' | 'navigation' | 'data' | 'timeout' | 'functional' | 'network' | 'unknown';
  confidence: number;
  evidence: string[];
  suggestedFix: string;
  relatedSelectors: string[];
}

export interface FailureAnalyzerOutput {
  analysis: FailureAnalysis;
}

const buildPrompt = (
  input: FailureAnalyzerInput,
  similar: Array<{ title: string; errorMessage: string | null; rootCause: string | null; suggestedFix: string | null; similarity: number }> = []
): LlmMessage[] => {
  const systemRead =
    'You are an expert QA failure analysis agent. Analyze the test failure data and produce a precise root-cause analysis as JSON with keys: rootCause, category, confidence, evidence, suggestedFix, relatedSelectors.';
  const systemRag =
    similar.length > 0
      ? [
          '\n\nRetrieval-augmented knowledge from historically similar past failures (use these as a strong prior, but trust the current failure data):',
          JSON.stringify(similar, null, 2),
        ].join('\n')
      : '';

  return [
    {
      role: 'system',
      content: systemRead + systemRag,
    },
    {
      role: 'user',
      content: JSON.stringify(input),
    },
  ];
};

export const fallbackAnalysis = (input: FailureAnalyzerInput): FailureAnalysis => {
  const message = input.errorMessage ?? 'Unknown failure';
  return {
    rootCause: message.slice(0, 1000),
    category: 'unknown',
    confidence: 10,
    evidence: input.consoleLog?.slice(0, 20) ?? [],
    suggestedFix: 'Review the failure evidence and fix the referenced element or flow.',
    relatedSelectors: [],
  };
};

export const failureAnalyzerAgent = {
  type: 'FAILURE_ANALYZER' as const,

  async execute(
    context: AgentContext,
    input: FailureAnalyzerInput
  ): Promise<AgentResult<FailureAnalyzerOutput>> {
    const similarityQuery = [input.testTitle, input.errorMessage, input.stackTrace]
      .filter(Boolean)
      .join('\n');
    const similar =
      context.organizationId && similarityQuery
        ? await knowledgeService.retrieveSimilar({
            organizationId: context.organizationId,
            query: similarityQuery,
            limit: 3,
          })
        : [];

    const messages = buildPrompt(input, similar);

    if (!llmService.isConfigured()) {
      return {
        output: { analysis: fallbackAnalysis(input) },
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
        messages,
      };
    }

    const response = await llmService.chatJson<FailureAnalyzerOutput>(messages);
    const analysis = {
      ...fallbackAnalysis(input),
      ...response.data.analysis,
    };

    if (context.organizationId) {
      await knowledgeService.index({
        organizationId: context.organizationId,
        projectId: context.projectId,
        testCaseId: context.testCaseId,
        testRunId: context.testRunId,
        title: input.testTitle ?? input.errorMessage?.slice(0, 120) ?? 'Test failure',
        errorMessage: input.errorMessage,
        rootCause: analysis.rootCause,
        suggestedFix: analysis.suggestedFix,
        category: analysis.category,
        metadata: { source: 'failure_analyzer', similarIds: similar.map((s) => s.id) },
      });
    }

    return {
      output: { analysis },
      usage: response.usage,
      messages,
    };
  },
};
