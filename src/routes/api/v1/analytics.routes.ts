import { Router } from 'express';
import {
  getDashboardAnalytics,
  getTestMetrics,
  generateReport,
  getAgentMetrics,
  getFlakyTests,
} from '../../../controllers/analytics';
import { authenticate, tenantMiddleware, requirePermission } from '../../../middleware';
import { Permissions } from '../../../constants/permissions';

const router = Router();

router.use(authenticate(), tenantMiddleware);

router.get('/dashboard', requirePermission(Permissions.ANALYTICS_READ), getDashboardAnalytics);
router.get('/tests', requirePermission(Permissions.ANALYTICS_READ), getTestMetrics);
router.get('/flaky-tests', requirePermission(Permissions.ANALYTICS_READ), getFlakyTests);
router.get('/agents', requirePermission(Permissions.ANALYTICS_READ), getAgentMetrics);
router.post('/reports', requirePermission(Permissions.ANALYTICS_READ), generateReport);

export default router;
