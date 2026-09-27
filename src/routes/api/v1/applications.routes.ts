import { Router } from 'express';
import {
  listApplications,
  createApplication,
  getApplication,
  updateApplication,
  deleteApplication,
  addEnvironment,
  addTestUser,
  scanApplication,
  getScanStatus,
  getApplicationMap,
} from '../../../controllers/applications';
import { authenticate, tenantMiddleware, validate, requirePermission } from '../../../middleware';
import { Permissions } from '../../../constants/permissions';
import {
  createApplicationSchema,
  updateApplicationSchema,
  applicationParamsSchema,
  addEnvironmentSchema,
  addTestUserSchema,
  scanApplicationSchema,
  applicationScanParamsSchema,
} from '../../../validators';

const router = Router();

router.use(authenticate(), tenantMiddleware);

router.post(
  '/',
  requirePermission(Permissions.APPLICATION_CREATE),
  validate(createApplicationSchema),
  createApplication
);
router.get(
  '/',
  requirePermission(Permissions.APPLICATION_READ),
  listApplications
);
router.get(
  '/:applicationId/map',
  requirePermission(Permissions.APPLICATION_READ),
  validate(applicationParamsSchema, 'params'),
  getApplicationMap
);
router.get(
  '/:applicationId',
  requirePermission(Permissions.APPLICATION_READ),
  validate(applicationParamsSchema, 'params'),
  getApplication
);
router.patch(
  '/:applicationId',
  requirePermission(Permissions.APPLICATION_UPDATE),
  validate(applicationParamsSchema, 'params'),
  validate(updateApplicationSchema),
  updateApplication
);
router.delete(
  '/:applicationId',
  requirePermission(Permissions.APPLICATION_DELETE),
  validate(applicationParamsSchema, 'params'),
  deleteApplication
);

router.post(
  '/:applicationId/environments',
  requirePermission(Permissions.APPLICATION_UPDATE),
  validate(applicationParamsSchema, 'params'),
  validate(addEnvironmentSchema),
  addEnvironment
);
router.post(
  '/:applicationId/test-users',
  requirePermission(Permissions.APPLICATION_UPDATE),
  validate(applicationParamsSchema, 'params'),
  validate(addTestUserSchema),
  addTestUser
);
router.post(
  '/:applicationId/scan',
  requirePermission(Permissions.APPLICATION_SCAN),
  validate(applicationParamsSchema, 'params'),
  validate(scanApplicationSchema),
  scanApplication
);
// Polls a scan started above. Declared after the POST so the literal paths win.
router.get(
  '/:applicationId/scan/:scanId',
  requirePermission(Permissions.APPLICATION_SCAN),
  validate(applicationScanParamsSchema, 'params'),
  getScanStatus
);

export default router;
