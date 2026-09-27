import { Request, Response } from 'express';
import { bugService } from '../../services/bug/bugService';
import { auditService } from '../../services/audit/auditTrailService';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { created } from '../../utils/formatters';
import { prisma } from '../../config/database';
import { notificationService } from '../../services/notification/notificationService';

export const createBug = async (req: Request, res: Response): Promise<void> => {
  if (!req.user || !req.orgId) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const {
    projectId,
    applicationId,
    testCaseId,
    title,
    description,
    severity,
    priority,
    status,
    rootCause,
    reproductionSteps,
    expectedBehavior,
    actualBehavior,
  } = req.body as {
    projectId: string;
    applicationId?: string;
    testCaseId?: string;
    title: string;
    description?: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    status: 'OPEN' | 'IN_PROGRESS' | 'FIXED' | 'VERIFIED' | 'CLOSED' | 'REJECTED' | 'DUPLICATE';
    rootCause?: string;
    reproductionSteps?: string[];
    expectedBehavior?: string;
    actualBehavior?: string;
  };
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.organizationId !== req.orgId) {
    throw new ForbiddenError(Messages.PROJECT.NOT_FOUND);
  }
  const bug = await bugService.create(
    {
      projectId,
      applicationId,
      testCaseId,
      title,
      description,
      severity,
      priority,
      status,
      rootCause,
      reproductionSteps,
      expectedBehavior,
      actualBehavior,
    },
    req.orgId,
    req.user.id
  );
  await auditService.log(
    {
      organizationId: req.orgId,
      userId: req.user.id,
      projectId,
      actionType: 'CREATE',
      resourceType: 'bug',
      resourceId: bug.id,
      changes: { title, severity, priority, status },
    },
    req
  );
  await notificationService.notifyBugCreated({
    id: bug.id,
    title: bug.title,
    description: bug.description,
    severity: bug.severity,
    priority: bug.priority,
    projectId: bug.projectId,
    organizationId: req.orgId,
  });
  res.status(201).json(created(bug, { message: Messages.BUG.CREATED }));
};
