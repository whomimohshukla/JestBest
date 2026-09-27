import { Request, Response } from 'express';
import { agentRunRepository } from '../../repositories/agentRun.repository';
import { aiQueue } from '../../queues/aiQueue';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';

export const cancelAgent = async (req: Request, res: Response): Promise<void> => {
  if (!req.orgId) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const { agentRunId } = req.params as { agentRunId: string };
  const agentRun = await agentRunRepository.findById(agentRunId);
  if (!agentRun) {
    throw new NotFoundError(Messages.AGENT.NOT_FOUND);
  }
  if (agentRun.organizationId && agentRun.organizationId !== req.orgId) {
    throw new ForbiddenError(Messages.AGENT.NOT_FOUND);
  }
  if (agentRun.status === 'PENDING' || agentRun.status === 'RUNNING') {
    const metadata = agentRun.metadata as { jobId?: string } | null;
    if (metadata?.jobId) {
      try {
        await aiQueue.remove(metadata.jobId);
      } catch {
        // job may already have started or completed — fall through
      }
    }
    await agentRunRepository.update(agentRunId, {
      status: 'FAILED',
      errorMessage: 'Cancelled by user',
      completedAt: new Date(),
    });
  }
  res.status(200).json(ok(null, { message: Messages.AGENT.CANCELLED }));
};
