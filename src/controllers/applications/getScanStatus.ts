import { Request, Response } from 'express';
import { applicationService } from '../../services/application/applicationService';
import { UnauthorizedError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';

/**
 * Poll the progress of a scan started by POST /applications/:applicationId/scan.
 *
 * The scan runs asynchronously, so the trigger returns a scanId and this is the
 * only way for a client to learn when it finished.
 */
export const getScanStatus = async (req: Request, res: Response): Promise<void> => {
  if (!req.orgId) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const { applicationId, scanId } = req.params as { applicationId: string; scanId: string };
  await applicationService.assertProjectAccess(req.orgId, applicationId);
  const scan = await applicationService.getScanStatus(scanId, applicationId);
  res.status(200).json(ok(scan));
};
