import { Request, Response } from 'express';
import type { AgentType } from '@prisma/client';
import { agentRunRepository } from '../../repositories/agentRun.repository';
import { UnauthorizedError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok, pagination } from '../../utils/formatters';

export const listAgentRuns = async (req: Request, res: Response): Promise<void> => {
  if (!req.orgId) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 20);
  const agentType = req.query.agentType as AgentType | undefined;
  const status = req.query.status as string | undefined;

  const where = {
    organizationId: req.orgId,
    ...(agentType ? { agentType } : {}),
    ...(status ? { status: status as never } : {}),
  };

  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    agentRunRepository.list(skip, pageSize, where),
    agentRunRepository.count(where),
  ]);
  res.status(200).json(ok(pagination(items, total, { page, pageSize })));
};
