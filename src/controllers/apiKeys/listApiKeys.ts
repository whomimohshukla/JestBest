import { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';
import { prisma } from '../../config/database';

export const listApiKeys = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const apiKeys = await prisma.apiKey.findMany({
    where: { userId: req.user.id, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      userId: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
      revokedAt: true,
    },
  });
  res.status(200).json(ok(apiKeys));
};
