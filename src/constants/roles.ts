import type { MembershipRole } from '@prisma/client';
import { Permissions, type Permission } from './permissions';

export const Roles = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  QA_MANAGER: 'QA_MANAGER',
  DEVELOPER: 'DEVELOPER',
  TESTER: 'TESTER',
  VIEWER: 'VIEWER',
} as const;

export type RoleName = (typeof Roles)[keyof typeof Roles];

export const ROLE_HIERARCHY: Record<MembershipRole, number> = {
  OWNER: 100,
  ADMIN: 80,
  QA_MANAGER: 60,
  DEVELOPER: 40,
  TESTER: 30,
  VIEWER: 10,
};

export const ROLE_PERMISSIONS: Record<MembershipRole, Permission[]> = {
  OWNER: Object.values(Permissions),
  ADMIN: [
    Permissions.PROJECT_READ,
    Permissions.PROJECT_CREATE,
    Permissions.PROJECT_UPDATE,
    Permissions.PROJECT_DELETE,
    Permissions.APPLICATION_READ,
    Permissions.APPLICATION_CREATE,
    Permissions.APPLICATION_UPDATE,
    Permissions.APPLICATION_DELETE,
    Permissions.APPLICATION_SCAN,
    Permissions.TEST_READ,
    Permissions.TEST_CREATE,
    Permissions.TEST_UPDATE,
    Permissions.TEST_DELETE,
    Permissions.TEST_EXECUTE,
    Permissions.BUG_READ,
    Permissions.BUG_CREATE,
    Permissions.BUG_UPDATE,
    Permissions.BUG_DELETE,
    Permissions.AGENT_TRIGGER,
    Permissions.AGENT_READ,
    Permissions.INTEGRATION_MANAGE,
    Permissions.INTEGRATION_READ,
    Permissions.WEBHOOK_MANAGE,
    Permissions.WEBHOOK_READ,
    Permissions.API_KEY_MANAGE,
    Permissions.ANALYTICS_READ,
    Permissions.BILLING_MANAGE,
    Permissions.ORG_MANAGE,
    Permissions.ORG_MEMBER_MANAGE,
    Permissions.ORG_MEMBER_READ,
  ],
  QA_MANAGER: [
    Permissions.PROJECT_READ,
    Permissions.PROJECT_CREATE,
    Permissions.PROJECT_UPDATE,
    Permissions.APPLICATION_READ,
    Permissions.APPLICATION_CREATE,
    Permissions.APPLICATION_UPDATE,
    Permissions.APPLICATION_SCAN,
    Permissions.TEST_READ,
    Permissions.TEST_CREATE,
    Permissions.TEST_UPDATE,
    Permissions.TEST_DELETE,
    Permissions.TEST_EXECUTE,
    Permissions.BUG_READ,
    Permissions.BUG_CREATE,
    Permissions.BUG_UPDATE,
    Permissions.AGENT_TRIGGER,
    Permissions.AGENT_READ,
    Permissions.INTEGRATION_READ,
    Permissions.WEBHOOK_READ,
    Permissions.ANALYTICS_READ,
    Permissions.ORG_MEMBER_READ,
  ],
  DEVELOPER: [
    Permissions.PROJECT_READ,
    Permissions.APPLICATION_READ,
    Permissions.TEST_READ,
    Permissions.TEST_EXECUTE,
    Permissions.BUG_READ,
    Permissions.BUG_CREATE,
    Permissions.BUG_UPDATE,
    Permissions.AGENT_READ,
    Permissions.ANALYTICS_READ,
    Permissions.ORG_MEMBER_READ,
  ],
  TESTER: [
    Permissions.PROJECT_READ,
    Permissions.APPLICATION_READ,
    Permissions.APPLICATION_SCAN,
    Permissions.TEST_READ,
    Permissions.TEST_CREATE,
    Permissions.TEST_EXECUTE,
    Permissions.BUG_READ,
    Permissions.BUG_CREATE,
    Permissions.BUG_UPDATE,
    Permissions.AGENT_TRIGGER,
    Permissions.AGENT_READ,
    Permissions.ANALYTICS_READ,
    Permissions.ORG_MEMBER_READ,
  ],
  VIEWER: [
    Permissions.PROJECT_READ,
    Permissions.APPLICATION_READ,
    Permissions.TEST_READ,
    Permissions.BUG_READ,
    Permissions.AGENT_READ,
    Permissions.ANALYTICS_READ,
    Permissions.ORG_MEMBER_READ,
  ],
};

export const roleHasPermission = (role: MembershipRole, permission: string): boolean => {
  return ROLE_PERMISSIONS[role]?.includes(permission as Permission) ?? false;
};

export const roleRank = (role: MembershipRole): number => ROLE_HIERARCHY[role];

export const canManageRole = (actor: MembershipRole, target: MembershipRole): boolean => {
  return roleRank(actor) > roleRank(target);
};
