import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { UnauthorizedError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';

export const listOrganizations = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }

  const organizations = await prisma.organization.findMany({
    where: {
      members: {
        some: {
          userId: req.user.id,
          deletedAt: null,
        },
      },
    },
    include: {
      _count: {
        select: { members: true, projects: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json(ok(organizations));
};