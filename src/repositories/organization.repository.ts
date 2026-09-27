import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export const organizationRepository = {
  findById: (id: string) => prisma.organization.findFirst({ where: { id, deletedAt: null } }),

  findBySlug: (slug: string) => prisma.organization.findFirst({ where: { slug, deletedAt: null } }),

  /**
   * Slug availability for creation. `slug` carries a global unique index that also
   * covers soft-deleted rows, so this must not filter on `deletedAt` — otherwise a
   * slug belonging to a soft-deleted organization looks free and the insert fails
   * with a unique-constraint error.
   */
  slugExists: async (slug: string): Promise<boolean> =>
    (await prisma.organization.count({ where: { slug } })) > 0,

  create: (data: Prisma.OrganizationCreateInput) => prisma.organization.create({ data }),

  update: (id: string, data: Prisma.OrganizationUpdateInput) =>
    prisma.organization.update({ where: { id }, data }),

  softDelete: (id: string) => prisma.organization.update({ where: { id }, data: { deletedAt: new Date() } }),

  listMembers: (organizationId: string) =>
    prisma.membership.findMany({
      where: { organizationId, deletedAt: null },
      include: { user: { select: { id: true, email: true, name: true, avatar: true, emailVerified: true } } },
      orderBy: { joinedAt: 'asc' },
    }),

  findMembership: (organizationId: string, userId: string) =>
    prisma.membership.findFirst({
      where: { organizationId, userId, deletedAt: null },
    }),

  findMembershipByUser: (userId: string) =>
    prisma.membership.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { joinedAt: 'asc' },
    }),

  addMember: (data: Prisma.MembershipUncheckedCreateInput) => prisma.membership.create({ data }),

  updateMemberRole: (membershipId: string, role: Prisma.MembershipUpdateInput['role']) =>
    prisma.membership.update({
      where: { id: membershipId },
      data: { role },
    }),

  softDeleteMember: (membershipId: string) =>
    prisma.membership.update({ where: { id: membershipId }, data: { deletedAt: new Date() } }),

  countOwners: (organizationId: string) =>
    prisma.membership.count({
      where: { organizationId, role: 'OWNER', deletedAt: null },
    }),

  listMembershipsForUser: (userId: string) =>
    prisma.membership.findMany({
      where: { userId, deletedAt: null },
      include: { organization: true },
      orderBy: { joinedAt: 'asc' },
    }),
};
