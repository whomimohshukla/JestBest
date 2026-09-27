import { AgentType } from '@prisma/client';

/**
 * Agent types the orchestrator can actually run.
 *
 * The Prisma `AgentType` enum is a superset: EXECUTION and REPORT_AGENT are
 * reserved values with no implementation and no graph node. Accepting them over
 * HTTP used to end in a StateGraphError (a 500), so they are rejected up front
 * with a clear 400 and the orchestrator guards the same set for internal callers.
 */
export const SUPPORTED_AGENT_TYPES = [
  AgentType.EXPLORER,
  AgentType.TEST_GENERATOR,
  AgentType.FAILURE_ANALYZER,
  AgentType.BUG_AGENT,
  AgentType.HEALING_AGENT,
  AgentType.CODE_AGENT,
  AgentType.FIX_AGENT,
] as const;

export type SupportedAgentType = (typeof SUPPORTED_AGENT_TYPES)[number];

export const isSupportedAgentType = (value: string): value is SupportedAgentType =>
  (SUPPORTED_AGENT_TYPES as readonly string[]).includes(value);
