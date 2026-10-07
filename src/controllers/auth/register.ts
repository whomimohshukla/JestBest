import { Request, Response } from 'express';
import { authService } from '../../services/auth/authService';
import { auditService } from '../../services/audit/auditTrailService';

import { created } from '../../utils/formatters';
import { Messages } from '../../constants/messages';

export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, name, organizationName } = req.body as {
    email: string;
    password: string;
    name?: string;
    organizationName?: string;
  };
  const result = await authService.register({ email, password, name, organizationName });

  // authService.register already sent the verification email (it owns the
  // token). Do not send a second, link-less welcome email here -- that was
  // both redundant and the reason the only "welcome" mail had no verify link.

  await auditService.log(
    {
      organizationId: result.organization.id,
      userId: result.user.id,
      actionType: 'AUTHENTICATION',
      resourceType: 'auth',
      resourceId: result.user.id,
      metadata: { action: 'register', email: result.user.email, organizationName },
    },
    req
  );
  res.status(201).json(created(result, { message: Messages.AUTH.REGISTERED }));
};
