import { Request, Response } from 'express';
import { organizationService } from '../../services/organization/organizationService';
import { UnauthorizedError } from '../../utils/errors';
import { ok } from '../../utils/formatters';
import { Messages } from '../../constants/messages';

export const updateOrganization = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const { organizationId } = req.params as { organizationId: string };
  const { name, description, website, logo, requireTwoFactor } = req.body as {
    name?: string;
    description?: string;
    website?: string;
    logo?: string;
    requireTwoFactor?: boolean;
  };
  const organization = await organizationService.update(
    organizationId,
    {
      name,
      description,
      website,
      logo,
      requireTwoFactor,
    },
    req.user.id
  );
  res.status(200).json(ok(organization, { message: Messages.ORG.UPDATED }));
};
