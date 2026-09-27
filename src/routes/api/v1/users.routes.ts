import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  deleteAccount,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  suspendAccount,
  reactivateAccount,
} from '../../../controllers/users';
import { changePassword } from '../../../controllers/auth';
import { authenticate, validate } from '../../../middleware';
import {
  changePasswordSchema,
  setupTwoFactorSchema,
  enableTwoFactorSchema,
  disableTwoFactorSchema,
  suspendAccountSchema,
} from '../../../validators';

const router = Router();

router.get('/me', authenticate(), getProfile);
router.patch('/me', authenticate(), updateProfile);
router.post('/me/change-password', authenticate(), validate(changePasswordSchema), changePassword);
router.delete('/me', authenticate(), deleteAccount);

router.post('/me/2fa/setup', authenticate(), validate(setupTwoFactorSchema), setupTwoFactor);
router.post('/me/2fa/enable', authenticate(), validate(enableTwoFactorSchema), enableTwoFactor);
router.post('/me/2fa/disable', authenticate(), validate(disableTwoFactorSchema), disableTwoFactor);

router.post('/me/suspend', authenticate(), validate(suspendAccountSchema), suspendAccount);
router.post('/me/reactivate', authenticate({ allowSuspended: true }), reactivateAccount);

export default router;
