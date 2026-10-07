export const Permissions = {
  PROJECT_READ: 'project:read',
  PROJECT_CREATE: 'project:create',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  APPLICATION_READ: 'application:read',
  APPLICATION_CREATE: 'application:create',
  APPLICATION_UPDATE: 'application:update',
  APPLICATION_DELETE: 'application:delete',
  APPLICATION_SCAN: 'application:scan',
  TEST_READ: 'test:read',
  TEST_CREATE: 'test:create',
  TEST_UPDATE: 'test:update',
  TEST_DELETE: 'test:delete',
  TEST_EXECUTE: 'test:execute',
  BUG_READ: 'bug:read',
  BUG_CREATE: 'bug:create',
  BUG_UPDATE: 'bug:update',
  BUG_DELETE: 'bug:delete',
  AGENT_TRIGGER: 'agent:trigger',
  AGENT_READ: 'agent:read',
  INTEGRATION_MANAGE: 'integration:manage',
  INTEGRATION_READ: 'integration:read',
  WEBHOOK_MANAGE: 'webhook:manage',
  WEBHOOK_READ: 'webhook:read',
  API_KEY_MANAGE: 'api_key:manage',
  ANALYTICS_READ: 'analytics:read',
  BILLING_MANAGE: 'billing:manage',
  ORG_MANAGE: 'organization:manage',
  ORG_MEMBER_MANAGE: 'organization:member:manage',
  /**
   * Viewing the member list is a read, not an administration task. Gating it
   * behind ORG_MEMBER_MANAGE meant developers, testers and viewers got a 403 on
   * a page they are expected to be able to open.
   */
  ORG_MEMBER_READ: 'organization:member:read',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];
