import { z } from 'zod';
import { MembershipRole } from '@prisma/client';

export const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes')
    .optional(),
  description: z.string().max(500).optional(),
  website: z.string().url('Invalid URL').optional(),
  logo: z.string().url('Invalid URL').optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  website: z.string().url().optional(),
  logo: z.string().url().optional(),
  requireTwoFactor: z.boolean().optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.nativeEnum(MembershipRole).default(MembershipRole.VIEWER),
});

export const updateMemberRoleSchema = z.object({
  role: z.nativeEnum(MembershipRole),
});

export const getOrganizationParamsSchema = z.object({
  organizationId: z.string().min(1),
});

export const memberParamsSchema = z.object({
  organizationId: z.string().min(1),
  userId: z.string().min(1),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
