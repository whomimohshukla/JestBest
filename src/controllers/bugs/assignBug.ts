import { Request, Response } from 'express';
import { bugService } from '../../services/bug/bugService';
import { auditService } from '../../services/audit/auditTrailService';
import { ForbiddenError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';
import { prisma } from '../../config/database';
import { organizationRepository } from '../../repositories/organization.repository';
import { notificationService } from '../../services/notification/notificationService';

export const assignBug = async (req: Request, res: Response): Promise<void> => {
  const { bugId } = req.params as { bugId: string };
  // `null` means "unassign"; a non-null value must be an org member.
  const { assigneeId } = req.body as { assigneeId: string | null };
  const existing = await bugService.get(bugId);
  const project = await prisma.project.findUnique({ where: { id: existing.projectId } });
  if (req.orgId && project?.organizationId !== req.orgId) {
    throw new ForbiddenError(Messages.AUTH.FORBIDDEN);
  }
  // The assignee must be a member of the same organization. Without this check a
  // bug can be assigned to an arbitrary user id, leaking the relationship across
  // tenant boundaries and notifying a user who has no access to the project.
  const organizationId = project?.organizationId ?? existing.organizationId;
  if (assigneeId !== null) {
    const membership = await organizationRepository.findMembership(organizationId, assigneeId);
    if (!membership) {
      throw new ForbiddenError(Messages.ORG.MEMBER_NOT_FOUND);
    }
  }
  const bug = await bugService.assign(bugId, assigneeId);
  if (req.orgId && req.user) {
    await auditService.log(
      {
        organizationId: req.orgId,
        userId: req.user.id,
        projectId: existing.projectId,
        actionType: 'UPDATE',
        resourceType: 'bug',
        resourceId: bugId,
        changes: { assigneeId },
      },
      req
    );
  }
  if (bug.assigneeId && req.user) {
    await notificationService.notifyBugAssigned(
      {
        id: bug.id,
        title: bug.title,
        severity: bug.severity,
        priority: bug.priority,
        projectId: bug.projectId,
        assigneeId: bug.assigneeId,
      },
      { name: req.user.name ?? null }
    );
  }
  res.status(200).json(ok(bug, { message: Messages.BUG.ASSIGNED }));
};
