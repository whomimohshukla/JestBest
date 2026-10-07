import { llmService } from './llmService';
import { explorerAgent } from './explorerAgent';
import { testGeneratorAgent } from './testGeneratorAgent';
import { failureAnalyzerAgent } from './failureAnalyzerAgent';
import { bugDetectionAgent } from './bugDetectionAgent';
import { healingAgent } from './healingAgent';
import { codeAnalysisAgent } from './codeAnalysisAgent';
import { agentRunRepository } from '../../repositories/agentRun.repository';
import { usageService } from '../billing/usageService';
import { logger } from '../../config/logger';
import { NotFoundError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { SUPPORTED_AGENT_TYPES, isSupportedAgentType } from '../../constants/agents';
import { StateGraphBuilder } from './stateGraph';
import type { AgentType } from '@prisma/client';
import type { AgentContext, AgentResult } from './agentService';

type AgentInput = unknown;

export interface AgentGraphState {
  agentType?: AgentType;
  agentInput?: AgentInput;
  context?: AgentContext;
  result?: AgentResult<unknown>;
  [key: string]: unknown;
}

const SELECT_NODE = 'select_agent';
const EXPLORER_NODE = 'agent:EXPLORER';
const TEST_GENERATOR_NODE = 'agent:TEST_GENERATOR';
const FAILURE_ANALYZER_NODE = 'agent:FAILURE_ANALYZER';
const BUG_AGENT_NODE = 'agent:BUG_AGENT';
const HEALING_AGENT_NODE = 'agent:HEALING_AGENT';
const CODE_AGENT_NODE = 'agent:CODE_AGENT';
const PERSIST_NODE = 'persist';

const AGENTS: Record<
  string,
  { execute(context: AgentContext, input: AgentInput): Promise<AgentResult<unknown>> }
> = {
  EXPLORER: explorerAgent,
  TEST_GENERATOR: testGeneratorAgent,
  FAILURE_ANALYZER: failureAnalyzerAgent,
  BUG_AGENT: bugDetectionAgent,
  HEALING_AGENT: healingAgent,
  CODE_AGENT: codeAnalysisAgent,
  FIX_AGENT: codeAnalysisAgent,
};

const buildAgentGraph = () => {
  const builder = new StateGraphBuilder<AgentGraphState>();

  builder
    .node(SELECT_NODE, ({ agentType, agentInput, context }) => ({ agentType, agentInput, context }))
    .addConditionalEdges(SELECT_NODE, (state) => state.agentType ?? 'UNKNOWN', {
      EXPLORER: EXPLORER_NODE,
      TEST_GENERATOR: TEST_GENERATOR_NODE,
      FAILURE_ANALYZER: FAILURE_ANALYZER_NODE,
      BUG_AGENT: BUG_AGENT_NODE,
      HEALING_AGENT: HEALING_AGENT_NODE,
      CODE_AGENT: CODE_AGENT_NODE,
      FIX_AGENT: CODE_AGENT_NODE,
    })
    .node(EXPLORER_NODE, (s) => executeAgent('EXPLORER', s.context!, s.agentInput))
    .node(TEST_GENERATOR_NODE, (s) => executeAgent('TEST_GENERATOR', s.context!, s.agentInput))
    .node(FAILURE_ANALYZER_NODE, (s) => executeAgent('FAILURE_ANALYZER', s.context!, s.agentInput))
    .node(BUG_AGENT_NODE, (s) => executeAgent('BUG_AGENT', s.context!, s.agentInput))
    .node(HEALING_AGENT_NODE, (s) => executeAgent('HEALING_AGENT', s.context!, s.agentInput))
    .node(CODE_AGENT_NODE, (s) =>
      executeAgent((s.agentType ?? 'CODE_AGENT') as AgentType, s.context!, s.agentInput)
    )
    .node(PERSIST_NODE, () => ({}));

  for (const nodeId of [
    EXPLORER_NODE,
    TEST_GENERATOR_NODE,
    FAILURE_ANALYZER_NODE,
    BUG_AGENT_NODE,
    HEALING_AGENT_NODE,
    CODE_AGENT_NODE,
  ]) {
    builder.addEdge(nodeId, PERSIST_NODE);
  }
  builder.addEdge(PERSIST_NODE, '__end__');

  return builder.compile(SELECT_NODE, '__end__');
};

const executeAgent = async (
  agentType: string,
  context: AgentContext,
  input: AgentInput
): Promise<{ result: AgentResult<unknown> }> => {
  const agent = AGENTS[agentType];
  if (!agent) {
    return {
      result: {
        output: { status: 'not_implemented' },
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
        messages: [],
      },
    };
  }
  return { result: await agent.execute(context, input) };
};

export const agentOrchestrator = {
  async run(agentRunId: string, organizationId: string): Promise<void> {
    const agentRun = await agentRunRepository.findById(agentRunId);
    if (!agentRun) {
      throw new NotFoundError(Messages.AGENT.NOT_FOUND);
    }
    void organizationId;

    // Guard the same set the trigger validator enforces. Without this, an
    // internal caller (or a future route that skips validation) can pass an
    // AgentType with no graph node and get a StateGraphError.
    if (!isSupportedAgentType(agentRun.agentType)) {
      await agentRunRepository.update(agentRunId, {
        status: 'FAILED',
        errorMessage: `Agent type ${agentRun.agentType} is not implemented. Supported: ${SUPPORTED_AGENT_TYPES.join(', ')}.`,
        completedAt: new Date(),
      });
      logger.error({ agentRunId, agentType: agentRun.agentType }, 'refusing to run unsupported agent type');
      return;
    }

    await agentRunRepository.update(agentRunId, {
      status: 'RUNNING',
      startedAt: new Date(),
    });

    try {
      const context: AgentContext = {
        agentRunId,
        organizationId,
        applicationId: undefined,
        projectId: undefined,
        testRunId: agentRun.testRunId ?? undefined,
        testCaseId: agentRun.testCaseId ?? undefined,
        ...((agentRun.input as Record<string, unknown>) ?? {}),
      };

      const startedAt = Date.now();
      const graph = buildAgentGraph();
      const { state, trace } = await graph.invoke({
        agentType: agentRun.agentType,
        agentInput: agentRun.input,
        context,
      });
      const result = state.result;

      if (!result) {
        throw new Error('Agent graph completed without producing an agent result.');
      }

      await agentRunRepository.update(agentRunId, {
        status: 'COMPLETED',
        output: result.output as object,
        tokensUsed: result.usage.totalTokens,
        costUsd: result.usage.costUsd,
        toolCalls: 0,
        duration: Date.now() - startedAt,
        completedAt: new Date(),
      });

      await usageService.increment(organizationId, {
        agentRunsExecuted: 1,
        aiTokensUsed: result.usage.totalTokens,
        estimatedCostUsd: result.usage.costUsd,
      });

      logger.info({ agentRunId, agentType: agentRun.agentType, path: trace.visited }, 'agent run completed');
    } catch (error) {
      await agentRunRepository.update(agentRunId, {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message.slice(0, 4000) : 'Agent failed',
        completedAt: new Date(),
      });
      logger.error({ agentRunId, err: error }, 'agent run failed');
    }
  },
};

export const llmConfigured = (): boolean => llmService.isConfigured();
