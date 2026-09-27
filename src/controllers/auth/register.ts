import { Request, Response } from 'express';
import { authService } from '../../services/auth/authService';
import { auditService } from '../../services/audit/auditTrailService';
import { notificationService } from '../../services/notification/notificationService';
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
  
  // Send welcome email (async, don't wait)
  notificationService.notifyUserRegistered(result.user).catch(() => {
    // Log error but don't fail the registration
  });
  
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
