import { z } from 'zod';
import { TestType } from '@prisma/client';

const testStepSchema = z.object({
  action: z.enum([
    'goto',
    'click',
    'fill',
    'press',
    'waitForSelector',
    'waitForTimeout',
    'expectVisible',
    'expectText',
    'expectAttribute',
    'expectStatus',
    'screenshot',
  ]),
  selector: z.string().optional(),
  value: z.string().optional(),
  text: z.string().optional(),
  attribute: z.string().optional(),
  timeout: z.coerce.number().optional(),
});

export const createTestCaseSchema = z.object({
  projectId: z.string().min(1),
  applicationId: z.string().optional(),
  workflowId: z.string().optional(),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  type: z.nativeEnum(TestType).default(TestType.FUNCTIONAL),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  steps: z.array(testStepSchema).max(100).default([]),
  expectedResult: z.string().max(2000).optional(),
  tags: z.array(z.string().max(40)).max(20).default([]),
});

export const updateTestCaseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  type: z.nativeEnum(TestType).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  steps: z.array(testStepSchema).min(1).optional(),
  expectedResult: z.string().max(2000).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
});

export const testCaseParamsSchema = z.object({
  testCaseId: z.string().min(1),
});

export const listTestCasesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  projectId: z.string().optional(),
  type: z.nativeEnum(TestType).optional(),
  applicationId: z.string().optional(),
});

export const generateTestsSchema = z.object({
  applicationId: z.string().min(1),
  projectId: z.string().min(1),
  requirements: z.string().max(10000).optional(),
  types: z.array(z.nativeEnum(TestType)).min(1).default([TestType.FUNCTIONAL, TestType.HAPPY_PATH]),
  count: z.coerce.number().int().min(1).max(50).default(5),
});

export type CreateTestCaseInput = z.infer<typeof createTestCaseSchema>;
