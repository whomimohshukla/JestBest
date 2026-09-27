import { userRepository } from '../../repositories/user.repository';
import { NotFoundError, ConflictError } from '../../utils/errors';
import { passwordService } from '../auth/passwordService';
import { tokenService } from '../auth/tokenService';
import type { PublicUser } from '../../types/auth.types';
import type { Prisma } from '@prisma/client';
import { Messages } from '../../constants/messages';

export interface UpdateProfileParams {
  name?: string;
  avatar?: string;
  notificationPreferences?: Record<string, unknown>;
}

export interface ChangePasswordParams {
  currentPassword: string;
  newPassword: string;
}

const toPublicUser = (user: {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  emailVerified: Date | null;
  createdAt: Date;
  notificationPreferences?: unknown | null;
  twoFactorEnabled?: boolean;
  suspendedUntil?: Date | null;
}): PublicUser => {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    emailVerified: user.emailVerified !== null,
    createdAt: user.createdAt,
    twoFactorEnabled: user.twoFactorEnabled ?? false,
    suspendedUntil: user.suspendedUntil ?? null,
    ...(user.notificationPreferences != null
      ? { notificationPreferences: user.notificationPreferences as Record<string, unknown> }
      : {}),
  };
};

export const userService = {
  async getProfile(userId: string): Promise<PublicUser> {
    const user = await userRepository.findActiveById(userId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    return toPublicUser(user);
  },

  async updateProfile(userId: string, params: UpdateProfileParams): Promise<PublicUser> {
    const user = await userRepository.findActiveById(userId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    const updated = await userRepository.update(userId, {
      name: params.name ?? undefined,
      avatar: params.avatar ?? undefined,
      ...(params.notificationPreferences
        ? { notificationPreferences: params.notificationPreferences as unknown as Prisma.InputJsonValue }
        : {}),
    });
    return toPublicUser(updated);
  },

  async changePassword(userId: string, params: ChangePasswordParams): Promise<void> {
    const user = await userRepository.findActiveById(userId);
    if (!user || !user.passwordHash) {
      throw new NotFoundError('User not found.');
    }
    const valid = await passwordService.verify(params.currentPassword, user.passwordHash);
    if (!valid) {
      throw new ConflictError('Current password is incorrect.');
    }
    const newHash = await passwordService.hash(params.newPassword);
    await userRepository.update(userId, { passwordHash: newHash });
    await tokenService.markPasswordChanged(userId);
    await tokenService.revokeAllForUser(userId);
  },

  async deleteAccount(userId: string): Promise<void> {
    await userRepository.softDelete(userId);
    await tokenService.revokeAllForUser(userId);
  },

  async suspendUntil(userId: string, until: Date): Promise<PublicUser> {
    const user = await userRepository.findActiveById(userId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    const updated = await userRepository.update(userId, { suspendedUntil: until });
    await tokenService.revokeAllForUser(userId);
    return toPublicUser(updated);
  },

  async reactivate(userId: string): Promise<PublicUser> {
    const user = await userRepository.findActiveById(userId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    const updated = await userRepository.update(userId, { suspendedUntil: null });
    return toPublicUser(updated);
  },

  async enableTwoFactor(userId: string, secret: string): Promise<PublicUser> {
    const user = await userRepository.findActiveById(userId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    if (user.twoFactorEnabled) {
      throw new ConflictError(Messages.AUTH.TWO_FACTOR_ALREADY_ENABLED);
    }
    const updated = await userRepository.update(userId, {
      twoFactorSecret: secret,
      twoFactorEnabled: true,
    });
    return toPublicUser(updated);
  },

  async disableTwoFactor(userId: string): Promise<PublicUser> {
    const user = await userRepository.findActiveById(userId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    const updated = await userRepository.update(userId, {
      twoFactorSecret: null,
      twoFactorEnabled: false,
    });
    return toPublicUser(updated);
  },
};
