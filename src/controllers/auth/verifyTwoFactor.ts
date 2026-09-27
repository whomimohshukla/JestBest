import { Request, Response } from 'express';
import { authService } from '../../services/auth/authService';
import { auditService } from '../../services/audit/auditTrailService';
import { ok } from '../../utils/formatters';
import { Messages } from '../../constants/messages';

export const verifyTwoFactor = async (req: Request, res: Response): Promise<void> => {
  const { token, code } = req.body as { token: string; code: string };
  const result = await authService.verifyTwoFactor(token, code);
  await auditService.log(
    {
      organizationId: result.organization.id,
      userId: result.user.id,
      actionType: 'AUTHENTICATION',
      resourceType: 'auth',
      resourceId: result.user.id,
      metadata: { action: 'login.two_factor_verified', email: result.user.email },
    },
    req
  );
  res.status(200).json(ok(result, { message: Messages.AUTH.LOGGED_IN }));
};