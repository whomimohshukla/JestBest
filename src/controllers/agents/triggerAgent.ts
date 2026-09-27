import { Request, Response } from 'express';
import { agentRunRepository } from '../../repositories/agentRun.repository';
import { aiQueue } from '../../queues/aiQueue';
import { UnauthorizedError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { created } from '../../utils/formatters';
import type { AgentType } from '@prisma/client';

export const triggerAgent = async (req: Request, res: Response): Promise<void> => {
  if (!req.user || !req.orgId) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const { agentType, input, testRunId, testCaseId, projectId, applicationId } = req.body as {
    agentType: AgentType;
    input?: unknown;
    testRunId?: string;
    testCaseId?: string;
    projectId?: string;
    applicationId?: string;
  };

  const runInput =
    typeof input === 'object' && input !== null
      ? { ...(input as Record<string, unknown>), ...(applicationId ? { applicationId } : {}) }
      : { ...(applicationId ? { applicationId } : {}) };

  const agentRun = await agentRunRepository.create({
    agentType,
    input: runInput as object,
    testRunId,
    testCaseId,
    organizationId: req.orgId,
    projectId,
    status: 'PENDING',
  });

  const job = await aiQueue.add('run-agent', {
    agentRunId: agentRun.id,
    organizationId: req.orgId,
  });

  await agentRunRepository.update(agentRun.id, {
    metadata: { jobId: job.id },
  });

  res.status(201).json(created(agentRun, { message: Messages.AGENT.TRIGGERED }));
};
