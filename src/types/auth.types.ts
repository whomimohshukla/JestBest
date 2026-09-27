import type { MembershipRole } from '@prisma/client';

export type RoleName = MembershipRole;

export interface JwtPayload {
  sub: string;
  orgId: string;
  roles: RoleName[];
  type: 'access' | 'refresh';
  jti?: string;
  exp?: number;
  iat?: number;
  purpose?: '2fa' | 'verification' | 'password-reset';
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  orgId: string;
  roles: RoleName[];
  permissions: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  emailVerified: boolean;
  createdAt: Date;
  notificationPreferences?: Record<string, unknown>;
  twoFactorEnabled?: boolean;
  suspendedUntil?: Date | string | null;
}

export interface AuthResult {
  user: PublicUser;
  organization: { id: string; name: string; slug: string; requireTwoFactor: boolean };
  tokens: TokenPair;
}

export interface TwoFactorSetupBundle {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

export interface TwoFactorAuthResult {
  requiresTwoFactor: true;
  twoFactorToken: string;
  user: PublicUser;
  organization: { id: string; name: string; slug: string; requireTwoFactor: boolean };
  setup?: TwoFactorSetupBundle;
}

export interface VerificationRequiredAuthResult {
  verificationRequired: true;
  verificationToken: string;
  user: PublicUser;
  organization: { id: string; name: string; slug: string; requireTwoFactor: boolean };
}

export type LoginResult = AuthResult | TwoFactorAuthResult | VerificationRequiredAuthResult;

export interface AccessTokenResult {
  token: string;
  expiresInSeconds: number;
}
