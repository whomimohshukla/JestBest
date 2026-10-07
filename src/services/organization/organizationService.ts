import type { MembershipRole, Organization, Membership } from '@prisma/client';
import { organizationRepository } from '../../repositories/organization.repository';
import { userRepository } from '../../repositories/user.repository';
import { NotFoundError, ConflictError, ForbiddenError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { canManageRole } from '../../constants/roles';
import { toSlug, resolveUniqueSlug } from '../../utils/helpers';
import { logger } from '../../config/logger';
import { notificationService } from '../notification/notificationService';
import { tokenService } from '../auth/tokenService';

export interface CreateOrganizationParams {
  name: string;
  slug?: string;
  description?: string;
  website?: string;
  logo?: string;
  ownerUserId: string;
}

export interface UpdateOrganizationParams {
  name?: string;
  description?: string;
  website?: string;
  logo?: string;
  requireTwoFactor?: boolean;
}

export interface InviteMemberParams {
  organizationId: string;
  email: string;
  role: MembershipRole;
  invitedByUserId: string;
}

export const organizationService = {
  /**
   * Every organization-scoped read/write must prove the caller actually belongs to
   * the organization named in the path. Authorization alone is not enough: the JWT
   * carries the caller's *own* org, so a member of org A would otherwise pass an
   * ORG_MANAGE check while mutating org B named in :organizationId.
   */
  async assertMembership(organizationId: string, userId: string): Promise<Membership> {
    const membership = await organizationRepository.findMembership(organizationId, userId);
    if (!membership) {
      throw new ForbiddenError(Messages.ORG.MEMBER_NOT_FOUND);
    }
    return membership;
  },

  async create(params: CreateOrganizationParams): Promise<Organization> {
    const slugBase = params.slug ?? (toSlug(params.name) || `org-${params.ownerUserId.slice(0, 8)}`);
    const uniqueSlug = await resolveUniqueSlug(slugBase, (s) => organizationRepository.slugExists(s));

    const organization = await organizationRepository.create({
      name: params.name,
      slug: uniqueSlug,
      description: params.description,
      website: params.website,
      logo: params.logo,
    });

    await organizationRepository.addMember({
      organizationId: organization.id,
      userId: params.ownerUserId,
      role: 'OWNER',
    });

    logger.info({ organizationId: organization.id }, 'organization created');
    return organization;
  },

  async get(organizationId: string, actorUserId: string): Promise<Organization> {
    await this.assertMembership(organizationId, actorUserId);
    const organization = await organizationRepository.findById(organizationId);
    if (!organization) {
      throw new NotFoundError(Messages.ORG.NOT_FOUND);
    }
    return organization;
  },

  async update(
    organizationId: string,
    params: UpdateOrganizationParams,
    actorUserId: string
  ): Promise<Organization> {
    await this.assertMembership(organizationId, actorUserId);
    const existing = await organizationRepository.findById(organizationId);
    if (!existing) {
      throw new NotFoundError(Messages.ORG.NOT_FOUND);
    }
    return organizationRepository.update(organizationId, {
      name: params.name ?? undefined,
      description: params.description ?? undefined,
      website: params.website ?? undefined,
      logo: params.logo ?? undefined,
      requireTwoFactor: params.requireTwoFactor ?? undefined,
    });
  },

  async softDelete(organizationId: string, actorUserId: string): Promise<void> {
    await this.assertMembership(organizationId, actorUserId);
    const existing = await organizationRepository.findById(organizationId);
    if (!existing) {
      throw new NotFoundError(Messages.ORG.NOT_FOUND);
    }
    await organizationRepository.softDelete(organizationId);
  },

  async listMembers(organizationId: string, actorUserId: string) {
    await this.assertMembership(organizationId, actorUserId);
    return organizationRepository.listMembers(organizationId);
  },

  async inviteMember(params: InviteMemberParams): Promise<Membership> {
    const organization = await organizationRepository.findById(params.organizationId);
    if (!organization) {
      throw new NotFoundError(Messages.ORG.NOT_FOUND);
    }

    const actor = await organizationRepository.findMembership(params.organizationId, params.invitedByUserId);
    if (!actor) {
      throw new ForbiddenError(Messages.ORG.MEMBER_NOT_FOUND);
    }
    if (!canManageRole(actor.role, params.role)) {
      throw new ForbiddenError(Messages.AUTH.FORBIDDEN);
    }

    let user;
    const existingUser = await userRepository.findActiveByEmail(params.email);
    if (existingUser) {
      user = existingUser;
    } else {
      user = await userRepository.create({ email: params.email });
    }

    const membership = await organizationRepository.findMembership(params.organizationId, user.id);
    if (membership) {
      throw new ConflictError(Messages.ORG.MEMBER_NOT_FOUND);
    }

    const added = await organizationRepository.addMember({
      organizationId: params.organizationId,
      userId: user.id,
      role: params.role,
    });

    const inviter = await userRepository.findActiveById(params.invitedByUserId);
    await notificationService.notifyTeamInvitation({
      email: user.email,
      inviterName: inviter?.name || 'A teammate',
      organizationName: organization.name,
      role: params.role,
    });

    return added;
  },

  async removeMember(organizationId: string, targetUserId: string, actorUserId: string): Promise<void> {
    const targetMembership = await organizationRepository.findMembership(organizationId, targetUserId);
    if (!targetMembership) {
      throw new NotFoundError(Messages.ORG.MEMBER_NOT_FOUND);
    }

    const actorMembership = await organizationRepository.findMembership(organizationId, actorUserId);
    if (!actorMembership) {
      throw new ForbiddenError(Messages.ORG.MEMBER_NOT_FOUND);
    }
    if (!canManageRole(actorMembership.role, targetMembership.role)) {
      throw new ForbiddenError(Messages.AUTH.FORBIDDEN);
    }
    if (targetMembership.role === 'OWNER' && targetUserId !== actorUserId) {
      throw new ForbiddenError(Messages.ORG.LAST_OWNER);
    }

    if (targetMembership.role === 'OWNER') {
      const ownerCount = await organizationRepository.countOwners(organizationId);
      if (ownerCount <= 1) {
        throw new ConflictError(Messages.ORG.LAST_OWNER);
      }
    }

    await organizationRepository.softDeleteMember(targetMembership.id);

    // Offboarding must actually end access. The auth middleware already refuses
    // a soft-deleted membership, but the removed member's refresh tokens would
    // otherwise stay valid and could be exchanged for a session.
    await tokenService.revokeAllForUser(targetUserId).catch((err: unknown) => {
      logger.warn({ err, targetUserId }, 'failed to revoke sessions after member removal');
    });
  },

  async changeMemberRole(
    organizationId: string,
    targetUserId: string,
    newRole: MembershipRole,
    actorUserId: string
  ): Promise<void> {
    const targetMembership = await organizationRepository.findMembership(organizationId, targetUserId);
    if (!targetMembership) {
      throw new NotFoundError(Messages.ORG.MEMBER_NOT_FOUND);
    }

    const actorMembership = await organizationRepository.findMembership(organizationId, actorUserId);
    if (!actorMembership) {
      throw new ForbiddenError(Messages.ORG.MEMBER_NOT_FOUND);
    }
    if (
      !canManageRole(actorMembership.role, targetMembership.role) ||
      !canManageRole(actorMembership.role, newRole)
    ) {
      throw new ForbiddenError(Messages.AUTH.FORBIDDEN);
    }

    if (targetMembership.role === 'OWNER' && newRole !== 'OWNER') {
      const ownerCount = await organizationRepository.countOwners(organizationId);
      if (ownerCount <= 1) {
        throw new ConflictError(Messages.ORG.LAST_OWNER);
      }
    }

    await organizationRepository.updateMemberRole(targetMembership.id, newRole);

    // Access tokens are stateless and carry no role claim the middleware trusts
    // (it re-reads the membership each request), so a role change is reflected
    // immediately. Refresh tokens, however, mint a new pair from the live
    // membership now but remain individually valid; retiring them means a
    // demoted user cannot keep the old grant alive by refreshing.
    await tokenService.revokeAllForUser(targetUserId).catch((err: unknown) => {
      logger.warn({ err, targetUserId }, 'failed to revoke sessions after role change');
    });
  },

  async listForUser(userId: string): Promise<Array<{ organization: Organization; role: MembershipRole }>> {
    const memberships = await organizationRepository.listMembershipsForUser(userId);
    return memberships.map((membership) => ({
      organization: membership.organization,
      role: membership.role,
    }));
  },
};
