import { Request, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '../../config/database';
import { ForbiddenError, NotFoundError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';

const ALLOWED_SCREENSHOT_PREFIX = '/tmp/jestbest-';

export const getResultScreenshot = async (req: Request, res: Response): Promise<void> => {
  const { testRunId, resultId } = req.params as { testRunId: string; resultId: string };

  const testRun = await prisma.testRun.findUnique({ where: { id: testRunId } });
  if (!testRun) {
    throw new NotFoundError(Messages.TEST.RUN_NOT_FOUND);
  }

  const project = await prisma.project.findUnique({ where: { id: testRun.projectId } });
  if (req.orgId && project?.organizationId !== req.orgId) {
    throw new ForbiddenError(Messages.AUTH.FORBIDDEN);
  }

  const result = await prisma.testResult.findFirst({
    where: { id: resultId, testRunId },
    select: { screenshotUrl: true },
  });
  if (!result) {
    throw new NotFoundError('Test result not found.');
  }

  const storedPath = result.screenshotUrl;
  if (!storedPath) {
    res.status(200).json(ok({ dataUrl: null }));
    return;
  }

  const resolved = path.resolve(storedPath);
  if (!resolved.startsWith(ALLOWED_SCREENSHOT_PREFIX)) {
    throw new ForbiddenError(Messages.AUTH.FORBIDDEN);
  }

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(resolved);
  } catch {
    res.status(200).json(ok({ dataUrl: null }));
    return;
  }

  res.status(200).json(ok({ dataUrl: `data:image/png;base64,${buffer.toString('base64')}` }));
};
