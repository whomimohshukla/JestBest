import { Request, Response } from 'express';
import { applicationService } from '../../services/application/applicationService';
import { projectRepository } from '../../repositories/project.repository';
import { UnauthorizedError, NotFoundError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';

export const listApplications = async (req: Request, res: Response): Promise<void> => {
  if (!req.orgId) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const { projectId } = req.query as { projectId?: string };

  if (projectId) {
    const project = await projectRepository.findById(projectId);
    if (!project || project.organizationId !== req.orgId) {
      throw new NotFoundError(Messages.PROJECT.NOT_FOUND);
    }
    const applications = await applicationService.listByProject(projectId);
    res.status(200).json(ok(applications));
    return;
  }

  const applications = await applicationService.listByOrganization(req.orgId);
  res.status(200).json(ok(applications));
};
