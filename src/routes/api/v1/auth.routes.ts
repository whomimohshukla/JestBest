import { Router } from 'express';
import {
  register,
  login,
  logout,
  refreshToken,
  requestResetPassword,
  resetPassword,
  verifyEmail as verifyEmailController,
  verifyTwoFactor as verifyTwoFactorController,
  resendVerification as resendVerificationController,
  oauthCallback,
  oauthAuthorize,
} from '../../../controllers/auth';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  requestResetPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  verifyTwoFactorSchema,
} from '../../../validators';
import { validate } from '../../../middleware';
import { authRateLimiter, authenticate } from '../../../middleware';
import { asyncHandler } from '../../../middleware/asyncHandler';

const router = Router();

router.post('/register', authRateLimiter, validate(registerSchema), register);
router.post('/login', authRateLimiter, validate(loginSchema), login);
router.post('/refresh-token', authRateLimiter, validate(refreshTokenSchema), refreshToken);
router.post('/logout', authenticate({ optional: true }), logout);
router.post('/verify-email', validate(verifyEmailSchema), verifyEmailController);
router.post('/verify-2fa', authRateLimiter, validate(verifyTwoFactorSchema), verifyTwoFactorController);
router.post(
  '/resend-verification',
  authRateLimiter,
  validate(requestResetPasswordSchema),
  resendVerificationController
);
router.post(
  '/request-password-reset',
  authRateLimiter,
  validate(requestResetPasswordSchema),
  requestResetPassword
);
router.post('/reset-password', authRateLimiter, validate(resetPasswordSchema), resetPassword);

// OAuth routes
router.get('/oauth/:provider/authorize', authRateLimiter, asyncHandler(oauthAuthorize));
router.get('/oauth/:provider/callback', authRateLimiter, asyncHandler(oauthCallback));

export default router;
