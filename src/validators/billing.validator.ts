import { z } from 'zod';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

export const updateSubscriptionPlanSchema = z.object({
  plan: z.nativeEnum(SubscriptionPlan),
});

export const updateSubscriptionStatusSchema = z.object({
  status: z.nativeEnum(SubscriptionStatus).optional(),
  cancelAt: z.string().datetime().nullable().optional(),
});

export type UpdateSubscriptionPlanInput = z.infer<typeof updateSubscriptionPlanSchema>;