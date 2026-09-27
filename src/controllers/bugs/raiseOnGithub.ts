import { Request, Response } from 'express';
import { bugService } from '../../services/bug/bugService';
import { githubService } from '../../services/integration/github/githubService';
import { integrationConfigOf } from '../../services/integration/integrationService';
import { UnauthorizedError, NotFoundError, BadRequestError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';
import { integrationRepository } from '../../repositories/integration.repository';

export const raiseOnGithub = async (req: Request, res: Response): Promise<void> => {
  if (!req.orgId) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const { bugId } = req.params as { bugId: string };

  const bug = await bugService.get(bugId);
  if (!bug || bug.organizationId !== req.orgId) {
    throw new NotFoundError(Messages.BUG.NOT_FOUND);
  }

  if (bug.githubIssueUrl) {
    res.status(200).json(ok({ ...bug, githubIssueUrl: bug.githubIssueUrl }, { message: 'Bug is already linked to a GitHub issue.' }));
    return;
  }

  // Scoped to the bug's project first, then any org-wide GitHub integration, so
  // a bug is never filed into an unrelated project's repository.
  const integration = await integrationRepository.findForProject(req.orgId, 'GITHUB', bug.projectId);
  if (!integration) {
    throw new NotFoundError('GitHub is not connected for this organization. Connect GitHub under Integrations first.');
  }

  const config = integrationConfigOf(integration);
  if (!config.token) {
    throw new BadRequestError('GitHub integration is missing an access token. Reconnect it from Integrations.');
  }
  const repository = config.repository;
  if (!repository) {
    throw new BadRequestError('GitHub integration has no default repository. Set the repository field under Integrations → GitHub.');
  }

  const { issueUrl } = await githubService.createBugIssue(
    config,
    {
      title: bug.title,
      description: bug.description ?? undefined,
      severity: bug.severity,
      priority: bug.priority,
      reproductionSteps: bug.reproductionSteps,
      expectedBehavior: bug.expectedBehavior ?? undefined,
      actualBehavior: bug.actualBehavior ?? undefined,
    },
    repository
  );

  const updated = await bugService.update(bugId, { githubIssueUrl: issueUrl });
  res.status(200).json(ok(updated, { message: `Bug reported to GitHub: ${issueUrl}` }));
};