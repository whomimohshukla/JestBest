import type { Project, Prisma } from '@prisma/client';
import { projectRepository } from '../../repositories/project.repository';
import { testRunRepository } from '../../repositories/testRun.repository';
import { bugRepository } from '../../repositories/bug.repository';
import { testCaseRepository } from '../../repositories/testCase.repository';
import { NotFoundError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { pagination } from '../../utils/formatters';
import type { ListResponse } from '../../types/api.types';

export interface CreateProjectParams {
  organizationId: string;
  name: string;
  description?: string;
}

export interface UpdateProjectParams {
  name?: string;
  description?: string;
}

export const projectService = {
  async create(params: CreateProjectParams): Promise<Project> {
    return projectRepository.create({
      organizationId: params.organizationId,
      name: params.name,
      description: params.description,
    });
  },

  async get(projectId: string): Promise<Project> {
    const project = await projectRepository.findActiveById(projectId);
    if (!project) {
      throw new NotFoundError(Messages.PROJECT.NOT_FOUND);
    }
    return project;
  },

  async getIncludingArchived(projectId: string): Promise<Project> {
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundError(Messages.PROJECT.NOT_FOUND);
    }
    return project;
  },

  async update(projectId: string, params: UpdateProjectParams): Promise<Project> {
    const existing = await projectRepository.findActiveById(projectId);
    if (!existing) {
      throw new NotFoundError(Messages.PROJECT.NOT_FOUND);
    }
    return projectRepository.update(projectId, {
      name: params.name ?? undefined,
      description: params.description ?? undefined,
    });
  },

  async hardDelete(projectId: string): Promise<void> {
    const existing = await projectRepository.findById(projectId);
    if (!existing) {
      throw new NotFoundError(Messages.PROJECT.NOT_FOUND);
    }
    await projectRepository.hardDelete(projectId);
  },

  async archive(projectId: string): Promise<Project> {
    const existing = await projectRepository.findActiveById(projectId);
    if (!existing) {
      throw new NotFoundError(Messages.PROJECT.NOT_FOUND);
    }
    return projectRepository.archive(projectId);
  },

  async list(
    organizationId: string,
    page = 1,
    pageSize = 20,
    includeArchived = false
  ): Promise<ListResponse<Project>> {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      projectRepository.list(organizationId, skip, pageSize, includeArchived),
      projectRepository.count({
        organizationId,
        ...(includeArchived ? {} : { archivedAt: null }),
      }),
    ]);
    return pagination(items, total, { page, pageSize });
  },

  async getDashboard(projectId: string) {
    const project = await projectService.getIncludingArchived(projectId);

    const [totalTests, totalRuns, passedTests, failedTests, openBugs, recentRuns] = await Promise.all([
      testCaseRepository.count({ projectId }),
      testRunRepository.count({ projectId }),
      testRunRepository.count({ projectId, status: 'PASSED' }),
      testRunRepository.count({ projectId, status: 'FAILED' }),
      bugRepository.count({ projectId, status: { not: 'CLOSED' } } as Prisma.BugWhereInput),
      testRunRepository.list({ projectId }, 0, 10),
    ]);

    return {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        archivedAt: project.archivedAt,
      },
      counts: {
        totalTests,
        totalRuns,
        passedRuns: passedTests,
        failedRuns: failedTests,
        openBugs,
      },
      recentRuns,
    };
  },
};
