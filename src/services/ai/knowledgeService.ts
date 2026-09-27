import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { embeddingService } from './embeddingService';
import { logger } from '../../config/logger';

export interface IncidentKnowledgeInput {
  organizationId: string;
  projectId?: string | null;
  testCaseId?: string | null;
  testRunId?: string | null;
  title: string;
  errorMessage?: string | null;
  rootCause?: string | null;
  suggestedFix?: string | null;
  category?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface SimilarIncident {
  id: string;
  title: string;
  errorMessage: string | null;
  rootCause: string | null;
  suggestedFix: string | null;
  category: string | null;
  projectId: string | null;
  testCaseId: string | null;
  similarity: number;
}

interface KnowledgeRow {
  id: string;
  title: string;
  errorMessage: string | null;
  rootCause: string | null;
  suggestedFix: string | null;
  category: string | null;
  projectId: string | null;
  testCaseId: string | null;
  similarity: number;
}

const escapeVectorLiteral = (vector: number[]): string => `'[${vector.join(',')}]'`;

export const knowledgeService = {
  isEnabled(): boolean {
    return embeddingService.isConfigured();
  },

  async index(input: IncidentKnowledgeInput): Promise<void> {
    if (!knowledgeService.isEnabled()) return;

    const text = [input.title, input.errorMessage, input.rootCause].filter(Boolean).join('\n').trim();
    if (!text) return;

    const embedded = await embeddingService.embed(text);
    if (!embedded) return;

    try {
      await prisma.$executeRaw`
        INSERT INTO "IncidentKnowledge"
          ("id", "organizationId", "projectId", "testCaseId", "testRunId", "title",
           "errorMessage", "rootCause", "suggestedFix", "category", "embedding", "metadata", "updatedAt")
        VALUES
          (${crypto.randomUUID()}, ${input.organizationId}, ${input.projectId ?? null}, ${input.testCaseId ?? null}, ${input.testRunId ?? null},
           ${input.title}, ${input.errorMessage ?? null}, ${input.rootCause ?? null},
           ${input.suggestedFix ?? null}, ${input.category ?? null},
           ${Prisma.raw(escapeVectorLiteral(embedded.vector))}::vector,
           ${(input.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull}, NOW())
      `;
    } catch (error) {
      logger.warn({ err: error }, 'failed to index failure knowledge');
    }
  },

  async retrieveSimilar(input: { organizationId: string; query: string; limit?: number }): Promise<SimilarIncident[]> {
    if (!knowledgeService.isEnabled()) return [];

    const query = (input.query ?? '').trim();
    if (!query) return [];

    const embedded = await embeddingService.embed(query);
    if (!embedded) return [];

    const limit = Math.min(Math.max(input.limit ?? 3, 1), 10);
    try {
      const vectorLiteral = Prisma.raw(escapeVectorLiteral(embedded.vector));

      const rows = await prisma.$queryRaw<KnowledgeRow[]>`
        SELECT
          "id", "title", "errorMessage", "rootCause", "suggestedFix", "category",
          "projectId", "testCaseId",
          ROUND((1 - ("embedding" <-> ${vectorLiteral}::vector))::numeric, 4)::float8 AS similarity
        FROM "IncidentKnowledge"
        WHERE "organizationId" = ${input.organizationId}
          AND "embedding" IS NOT NULL
        ORDER BY "embedding" <-> ${vectorLiteral}::vector
        LIMIT ${limit}
      `;

      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        errorMessage: row.errorMessage,
        rootCause: row.rootCause,
        suggestedFix: row.suggestedFix,
        category: row.category,
        projectId: row.projectId,
        testCaseId: row.testCaseId,
        similarity: Math.max(0, Math.min(1, row.similarity)),
      }));
    } catch (error) {
      logger.warn({ err: error }, 'failed to retrieve similar failures');
      return [];
    }
  },
};