import { z } from 'zod';
import { BugSeverity, BugPriority, BugStatus } from '@prisma/client';

export const createBugSchema = z.object({
  projectId: z.string().min(1),
  applicationId: z.string().optional(),
  testCaseId: z.string().optional(),
  title: z.string().min(1, 'Title is required').max(300),
  description: z.string().max(5000).optional(),
  severity: z.nativeEnum(BugSeverity).default(BugSeverity.MEDIUM),
  priority: z.nativeEnum(BugPriority).default(BugPriority.P2),
  status: z.nativeEnum(BugStatus).default(BugStatus.OPEN),
  rootCause: z.string().max(5000).optional(),
  reproductionSteps: z.array(z.string()).optional(),
  expectedBehavior: z.string().max(3000).optional(),
  actualBehavior: z.string().max(3000).optional(),
});

export const updateBugSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  severity: z.nativeEnum(BugSeverity).optional(),
  priority: z.nativeEnum(BugPriority).optional(),
  rootCause: z.string().max(5000).optional(),
  reproductionSteps: z.array(z.string()).optional(),
  expectedBehavior: z.string().max(3000).optional(),
  actualBehavior: z.string().max(3000).optional(),
});

export const changeBugStatusSchema = z.object({
  status: z.nativeEnum(BugStatus),
});

export const assignBugSchema = z.object({
  // `null` clears the assignee. The UI exposes an explicit "Unassigned"
  // option, which previously 400'd because only a non-empty string was allowed.
  assigneeId: z.string().min(1).nullable(),
});

export const addBugCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(5000),
});

export const bugParamsSchema = z.object({
  bugId: z.string().min(1),
});

export const listBugsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  projectId: z.string().optional(),
  status: z.nativeEnum(BugStatus).optional(),
  severity: z.nativeEnum(BugSeverity).optional(),
});

export type CreateBugInput = z.infer<typeof createBugSchema>;
