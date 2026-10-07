import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import type { OAuthUserProfile } from '../services/auth/oauthService';

export const userRepository = {
  findById: (id: string) => prisma.user.findUnique({ where: { id } }),

  findByEmail: (email: string) => prisma.user.findUnique({ where: { email } }),

  findActiveById: (id: string) => prisma.user.findFirst({ where: { id, deletedAt: null } }),

  findActiveByEmail: (email: string) => prisma.user.findFirst({ where: { email, deletedAt: null } }),

  create: (data: Prisma.UserCreateInput) => prisma.user.create({ data }),

  update: (id: string, data: Prisma.UserUpdateInput) => prisma.user.update({ where: { id }, data }),

  softDelete: (id: string) => prisma.user.update({ where: { id }, data: { deletedAt: new Date() } }),

  count: (where: Prisma.UserWhereInput = {}) => prisma.user.count({ where: { deletedAt: null, ...where } }),

  list: (where: Prisma.UserWhereInput = {}, skip = 0, take = 20) =>
    prisma.user.findMany({
      where: { deletedAt: null, ...where },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),

  async findOrCreateFromOAuth(profile: OAuthUserProfile) {
    // Try to find existing user by email
    let user = await prisma.user.findFirst({
      where: {
        email: profile.email,
        deletedAt: null,
      },
    });

    if (user) {
      // Update avatar if not set
      if (!user.avatar && profile.avatar) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { avatar: profile.avatar },
        });
      }

      // Mark email as verified if OAuth login
      if (!user.emailVerified) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: new Date() },
        });
      }

      return user;
    }

    // Create new user
    return prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        avatar: profile.avatar,
        emailVerified: new Date(), // OAuth emails are pre-verified
        passwordHash: null, // No password for OAuth users
      },
    });
  },
};
