import { z } from 'zod';
import { AgentType } from '@prisma/client';

import { SUPPORTED_AGENT_TYPES } from '../constants/agents';

export const triggerAgentSchema = z.object({
  // Deliberately narrower than the Prisma enum: EXECUTION and REPORT_AGENT have
  // no implementation, and accepting them would surface as a 500 from the graph.
  agentType: z.enum(SUPPORTED_AGENT_TYPES as unknown as [AgentType, ...AgentType[]]),
  input: z.record(z.string(), z.unknown()).optional(),
  testRunId: z.string().optional(),
  testCaseId: z.string().optional(),
  projectId: z.string().optional(),
  applicationId: z.string().optional(),
});

export const agentParamsSchema = z.object({
  agentRunId: z.string().min(1),
});

export const listAgentRunsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  agentType: z.nativeEnum(AgentType).optional(),
  status: z.string().optional(),
});

export type TriggerAgentInput = z.infer<typeof triggerAgentSchema>;
