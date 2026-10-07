import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(120).optional(),
  organizationName: z.string().min(1, 'Organization name is required').max(120).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export const requestResetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const verifyTwoFactorSchema = z.object({
  token: z.string().min(1, 'Two-factor token is required'),
  code: z.string().regex(/^\d{6}$/, 'Verification code must be 6 digits'),
});

export const setupTwoFactorSchema = z.object({
  password: z.string().min(1, 'Current password is required'),
});

export const enableTwoFactorSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Verification code must be 6 digits'),
});

export const disableTwoFactorSchema = z.object({
  password: z.string().min(1, 'Current password is required'),
  code: z
    .string()
    .regex(/^\d{6}$/, 'Verification code must be 6 digits')
    .optional(),
});

export const suspendAccountSchema = z.object({
  days: z.number().int().min(1).max(365).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const oauthExchangeSchema = z.object({
  exchangeToken: z.string().min(1),
});

/**
 * Switching organizations re-issues the token pair, so the target must be
 * named explicitly: nothing about the current token implies which workspace
 * the caller wants next.
 */
export const switchOrganizationSchema = z.object({
  organizationId: z.string().min(1, 'Organization is required'),
  // The presented refresh token is revoked as part of the switch (session
  // rotation), but is optional so a client that already dropped it can still
  // move between workspaces.
  refreshToken: z.string().min(1).optional(),
});
