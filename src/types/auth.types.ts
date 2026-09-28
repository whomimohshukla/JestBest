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
  /**
   * Password version at mint time. A password change increments the stored
   * version, so any token carrying a lower value is revoked. A monotonic
   * counter is used rather than a timestamp because JWT `iat` has one-second
   * granularity: a token minted in the same second as the password change
   * cannot be ordered against it. Missing `pv` means 0, so tokens issued
   * before this claim existed keep working until the next password change.
   */
  pv?: number;
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
