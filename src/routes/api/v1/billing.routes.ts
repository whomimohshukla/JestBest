import { Router } from 'express';
import {
  getSubscription,
  updateSubscriptionPlan,
  getUsage,
  billingWebhook,
} from '../../../controllers/billing';
import { authenticate, tenantMiddleware, requirePermission, validate } from '../../../middleware';
import { Permissions } from '../../../constants/permissions';
import { updateSubscriptionPlanSchema } from '../../../validators';

const router = Router();

// Public: authenticated by Stripe signature, not by JWT. The raw body is
// captured by the global express.json() `verify` hook in server.ts.
router.post('/webhooks/stripe', billingWebhook);

router.use(authenticate(), tenantMiddleware);

router.get('/subscription', getSubscription);
router.patch(
  '/subscription',
  requirePermission(Permissions.BILLING_MANAGE),
  validate(updateSubscriptionPlanSchema),
  updateSubscriptionPlan
);
router.get('/usage', getUsage);

export default router;
