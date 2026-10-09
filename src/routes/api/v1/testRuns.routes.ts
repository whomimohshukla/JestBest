import { Router } from 'express';
import {
  runTests,
  getTestRun,
  getTestRunResults,
  getResultScreenshot,
  cancelTestRun,
  scheduleTestRun,
  listTestRuns,
} from '../../../controllers/testRuns';
import { authenticate, tenantMiddleware, validate, requirePermission } from '../../../middleware';
import { Permissions } from '../../../constants/permissions';
import {
  runTestsSchema,
  scheduleTestRunSchema,
  testRunParamsSchema,
  listTestRunsQuerySchema,
} from '../../../validators';

const router = Router();

router.use(authenticate(), tenantMiddleware);

router.post('/', requirePermission(Permissions.TEST_EXECUTE), validate(runTestsSchema), runTests);
router.post(
  '/scheduled',
  requirePermission(Permissions.TEST_EXECUTE),
  validate(scheduleTestRunSchema),
  scheduleTestRun
);
router.get(
  '/',
  requirePermission(Permissions.TEST_READ),
  validate(listTestRunsQuerySchema, 'query'),
  listTestRuns
);
router.get(
  '/:testRunId',
  requirePermission(Permissions.TEST_READ),
  validate(testRunParamsSchema, 'params'),
  getTestRun
);
router.get(
  '/:testRunId/results',
  requirePermission(Permissions.TEST_READ),
  validate(testRunParamsSchema, 'params'),
  getTestRunResults
);
router.get(
  '/:testRunId/results/:resultId/screenshot',
  requirePermission(Permissions.TEST_READ),
  validate(testRunParamsSchema, 'params'),
  getResultScreenshot
);
router.post(
  '/:testRunId/cancel',
  requirePermission(Permissions.TEST_EXECUTE),
  validate(testRunParamsSchema, 'params'),
  cancelTestRun
);

export default router;
