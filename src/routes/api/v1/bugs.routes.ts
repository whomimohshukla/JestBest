import { Router } from 'express';
import {
  createBug,
  getBug,
  updateBug,
  deleteBug,
  changeBugStatus,
  assignBug,
  addBugComment,
  listBugComments,
  listBugs,
  raiseOnGithub,
} from '../../../controllers/bugs';
import { authenticate, tenantMiddleware, validate, requirePermission } from '../../../middleware';
import { Permissions } from '../../../constants/permissions';
import {
  createBugSchema,
  updateBugSchema,
  bugParamsSchema,
  changeBugStatusSchema,
  assignBugSchema,
  addBugCommentSchema,
  listBugsQuerySchema,
} from '../../../validators';

const router = Router();

router.use(authenticate(), tenantMiddleware);

router.post('/', requirePermission(Permissions.BUG_CREATE), validate(createBugSchema), createBug);
router.get('/', requirePermission(Permissions.BUG_READ), validate(listBugsQuerySchema, 'query'), listBugs);
router.get('/:bugId', requirePermission(Permissions.BUG_READ), validate(bugParamsSchema, 'params'), getBug);
router.patch(
  '/:bugId',
  requirePermission(Permissions.BUG_UPDATE),
  validate(bugParamsSchema, 'params'),
  validate(updateBugSchema),
  updateBug
);
router.delete(
  '/:bugId',
  requirePermission(Permissions.BUG_DELETE),
  validate(bugParamsSchema, 'params'),
  deleteBug
);
router.patch(
  '/:bugId/status',
  requirePermission(Permissions.BUG_UPDATE),
  validate(bugParamsSchema, 'params'),
  validate(changeBugStatusSchema),
  changeBugStatus
);
router.patch(
  '/:bugId/assignee',
  requirePermission(Permissions.BUG_UPDATE),
  validate(bugParamsSchema, 'params'),
  validate(assignBugSchema),
  assignBug
);
router.post(
  '/:bugId/raise-github',
  requirePermission(Permissions.BUG_UPDATE),
  validate(bugParamsSchema, 'params'),
  raiseOnGithub
);
router.post(
  '/:bugId/comments',
  requirePermission(Permissions.BUG_UPDATE),
  validate(bugParamsSchema, 'params'),
  validate(addBugCommentSchema),
  addBugComment
);
router.get(
  '/:bugId/comments',
  requirePermission(Permissions.BUG_READ),
  validate(bugParamsSchema, 'params'),
  listBugComments
);

export default router;
