import { Request, Response } from 'express';
import { authService } from '../../services/auth/authService';
import { auditService } from '../../services/audit/auditTrailService';
import { UnauthorizedError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';

export const switchOrganization = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }

  const { organizationId, refreshToken } = req.body as {
    organizationId: string;
    refreshToken?: string;
  };

  const result = await authService.switchOrganization(req.user.id, organizationId, refreshToken);

  // Audited from the *destination* organization, because that is the tenant
  // whose data the new session can read. `from` keeps the jump reconstructable.
  await auditService.log(
    {
      organizationId: result.organization.id,
      userId: req.user.id,
      actionType: 'AUTHENTICATION',
      resourceType: 'auth',
      resourceId: req.user.id,
      metadata: {
        action: 'auth.switch_organization',
        from: req.orgId ?? req.user.orgId ?? null,
        to: organizationId,
      },
    },
    req
  );

  res.status(200).json(ok(result, { message: Messages.ORG.SWITCHED }));
};
