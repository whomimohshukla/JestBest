import type { Application, Environment, TestUser, Prisma } from '@prisma/client';
import { applicationRepository } from '../../repositories/application.repository';
import { projectRepository } from '../../repositories/project.repository';
import { NotFoundError, ForbiddenError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { encrypt } from '../../utils/encryption';
import { aiExplorationQueue } from '../../queues/aiQueue';

export interface CreateApplicationParams {
  organizationId: string;
  projectId: string;
  name: string;
  baseUrl: string;
  description?: string;
}

export interface UpdateApplicationParams {
  name?: string;
  baseUrl?: string;
  description?: string;
}

export interface AddEnvironmentParams {
  applicationId: string;
  type: Environment['type'];
  url: string;
  name?: string;
}

export interface AddTestUserParams {
  applicationId: string;
  environmentId: string;
  username: string;
  email?: string;
  password: string;
  role?: string;
  description?: string;
}

export interface ScanParams {
  applicationId: string;
  organizationId: string;
  environmentId?: string;
  maxPages?: number;
  testUserId?: string;
  triggeredById: string;
}

export const applicationService = {
  async create(params: CreateApplicationParams): Promise<Application> {
    const project = await projectRepository.findById(params.projectId);
    if (!project || project.organizationId !== params.organizationId) {
      throw new NotFoundError(Messages.PROJECT.NOT_FOUND);
    }
    return applicationRepository.create({
      projectId: params.projectId,
      name: params.name,
      baseUrl: params.baseUrl,
      description: params.description,
    });
  },

  async get(applicationId: string): Promise<Application> {
    const application = await applicationRepository.findById(applicationId);
    if (!application) {
      throw new NotFoundError(Messages.APPLICATION.NOT_FOUND);
    }
    return application;
  },

  async update(applicationId: string, params: UpdateApplicationParams): Promise<Application> {
    const existing = await applicationRepository.findById(applicationId);
    if (!existing) {
      throw new NotFoundError(Messages.APPLICATION.NOT_FOUND);
    }
    return applicationRepository.update(applicationId, {
      name: params.name ?? undefined,
      baseUrl: params.baseUrl ?? undefined,
      description: params.description ?? undefined,
    });
  },

  async hardDelete(applicationId: string): Promise<void> {
    const existing = await applicationRepository.findById(applicationId);
    if (!existing) {
      throw new NotFoundError(Messages.APPLICATION.NOT_FOUND);
    }
    await applicationRepository.hardDelete(applicationId);
  },

  async listByProject(projectId: string): Promise<Application[]> {
    return applicationRepository.listByProject(projectId);
  },

  async listByOrganization(organizationId: string): Promise<Application[]> {
    return applicationRepository.listByOrganization(organizationId);
  },

  async assertProjectAccess(organizationId: string, applicationId: string): Promise<Application> {
    const application = await applicationRepository.findById(applicationId);
    if (!application) {
      throw new NotFoundError(Messages.APPLICATION.NOT_FOUND);
    }
    const project = await projectRepository.findById(application.projectId);
    if (!project || project.organizationId !== organizationId) {
      throw new ForbiddenError(Messages.AUTH.FORBIDDEN);
    }
    return application;
  },

  async addEnvironment(params: AddEnvironmentParams): Promise<Environment> {
    await applicationService.get(params.applicationId);
    return applicationRepository.addEnvironment({
      applicationId: params.applicationId,
      type: params.type,
      url: params.url,
      name: params.name,
    });
  },

  async addTestUser(params: AddTestUserParams): Promise<TestUser> {
    await applicationService.get(params.applicationId);
    return applicationRepository.addTestUser({
      applicationId: params.applicationId,
      environmentId: params.environmentId,
      username: params.username,
      email: params.email,
      passwordEncrypted: encrypt(params.password),
      role: params.role,
      description: params.description,
    });
  },

  async scan(params: ScanParams): Promise<{ scanId: string }> {
    const application = await applicationService.assertProjectAccess(
      params.organizationId,
      params.applicationId
    );

    const scan = await applicationRepository.createScan({
      applicationId: application.id,
      metadata: {
        triggeredBy: params.triggeredById,
        environmentId: params.environmentId,
        testUserId: params.testUserId,
        maxPages: params.maxPages ?? 25,
      },
    });

    await aiExplorationQueue.add('explore-application', {
      scanId: scan.id,
      applicationId: application.id,
      organizationId: params.organizationId,
      projectId: application.projectId,
      environmentId: params.environmentId,
      testUserId: params.testUserId,
      maxPages: params.maxPages ?? 25,
    });

    return { scanId: scan.id };
  },

  async getApplicationMap(applicationId: string) {
    const map = await applicationRepository.getMap(applicationId);
    if (!map) {
      throw new NotFoundError(Messages.APPLICATION.NOT_FOUND);
    }
    return map;
  },

  async getScanStatus(scanId: string, applicationId: string) {
    const scan = await applicationRepository.getScan(scanId);
    if (!scan || scan.applicationId !== applicationId) {
      throw new NotFoundError(Messages.APPLICATION.NOT_FOUND);
    }
    return scan;
  },
};

export type { Prisma };
