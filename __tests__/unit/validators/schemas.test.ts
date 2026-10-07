import { createTestCaseSchema } from '../../../src/validators/testCase.validator';
import {
  runTestsSchema,
  scheduleTestRunSchema,
  addSuiteItemSchema,
} from '../../../src/validators/testRun.validator';
import { createBugSchema, changeBugStatusSchema } from '../../../src/validators/bug.validator';
import { createWebhookSchema } from '../../../src/validators/webhook.validator';
import { triggerAgentSchema } from '../../../src/validators/agent.validator';
import { loginSchema, registerSchema } from '../../../src/validators/auth.validator';

const issueKeys = (result: { success: boolean; error?: { issues?: Array<{ path: PropertyKey[] }> } }) =>
  result.success ? [] : (result.error?.issues ?? []).map((i) => i.path.join('.'));

describe('createTestCaseSchema', () => {
  const valid = {
    projectId: 'p1',
    title: 'Login works',
    steps: [{ action: 'goto' as const, value: 'https://example.com' }],
  };

  it('accepts a minimal valid case and applies defaults', () => {
    const parsed = createTestCaseSchema.parse(valid);
    expect(parsed.type).toBe('FUNCTIONAL');
    expect(parsed.priority).toBe('medium');
    expect(parsed.tags).toEqual([]);
  });

  it('requires a title', () => {
    expect(issueKeys(createTestCaseSchema.safeParse({ ...valid, title: '' }))).toContain('title');
  });

  it('rejects an unknown test type', () => {
    expect(issueKeys(createTestCaseSchema.safeParse({ ...valid, type: 'E2E' }))).toContain('type');
  });

  it('rejects an uppercase priority', () => {
    expect(issueKeys(createTestCaseSchema.safeParse({ ...valid, priority: 'HIGH' }))).toContain('priority');
  });

  it('requires a known step action', () => {
    const parsed = createTestCaseSchema.safeParse({
      ...valid,
      steps: [{ action: 'teleport' }],
    });
    expect(issueKeys(parsed)).toContain('steps.0.action');
  });

  it('caps the number of steps', () => {
    const steps = Array.from({ length: 101 }, () => ({ action: 'goto' as const }));
    expect(issueKeys(createTestCaseSchema.safeParse({ ...valid, steps }))).toContain('steps');
  });
});

describe('addSuiteItemSchema', () => {
  it('requires a testCaseId', () => {
    expect(issueKeys(addSuiteItemSchema.safeParse({}))).toContain('testCaseId');
  });

  it('coerces a numeric order', () => {
    expect(addSuiteItemSchema.parse({ testCaseId: 'tc1', order: '3' }).order).toBe(3);
  });

  it('rejects a negative order', () => {
    expect(issueKeys(addSuiteItemSchema.safeParse({ testCaseId: 'tc1', order: -1 }))).toContain('order');
  });
});

describe('runTestsSchema', () => {
  it('requires a projectId', () => {
    expect(issueKeys(runTestsSchema.safeParse({}))).toContain('projectId');
  });

  it('rejects an unknown trigger type', () => {
    expect(issueKeys(runTestsSchema.safeParse({ projectId: 'p1', triggerType: 'HOURLY' }))).toContain(
      'triggerType'
    );
  });

  it('rejects empty-string test case ids', () => {
    expect(issueKeys(runTestsSchema.safeParse({ projectId: 'p1', testCaseIds: [''] }))).toContain(
      'testCaseIds.0'
    );
  });
});

describe('scheduleTestRunSchema', () => {
  it('requires a cron expression', () => {
    expect(issueKeys(scheduleTestRunSchema.safeParse({ projectId: 'p1' }))).toContain('cron');
  });

  it('accepts a cron expression', () => {
    const parsed = scheduleTestRunSchema.parse({ projectId: 'p1', cron: '0 3 * * *' });
    expect(parsed.cron).toBe('0 3 * * *');
  });
});

describe('createBugSchema', () => {
  const valid = { projectId: 'p1', title: 'Broken' };

  it('applies enum defaults', () => {
    const parsed = createBugSchema.parse(valid);
    expect(parsed.severity).toBe('MEDIUM');
    expect(parsed.priority).toBe('P2');
    expect(parsed.status).toBe('OPEN');
  });

  it('rejects a non-P0..P3 priority', () => {
    expect(issueKeys(createBugSchema.safeParse({ ...valid, priority: 'HIGH' }))).toContain('priority');
  });

  it('requires a title', () => {
    expect(issueKeys(createBugSchema.safeParse({ projectId: 'p1', title: '' }))).toContain('title');
  });
});

describe('changeBugStatusSchema', () => {
  it('accepts a known status', () => {
    expect(changeBugStatusSchema.parse({ status: 'IN_PROGRESS' }).status).toBe('IN_PROGRESS');
  });

  it('rejects an unknown status', () => {
    expect(issueKeys(changeBugStatusSchema.safeParse({ status: 'NOT_A_STATUS' }))).toContain('status');
  });
});

describe('createWebhookSchema', () => {
  it('requires at least one event type', () => {
    expect(issueKeys(createWebhookSchema.safeParse({ url: 'https://a.dev/h', eventTypes: [] }))).toContain(
      'eventTypes'
    );
  });

  it('rejects a non-url', () => {
    expect(
      issueKeys(createWebhookSchema.safeParse({ url: 'not-a-url', eventTypes: ['TEST_COMPLETED'] }))
    ).toContain('url');
  });

  it('rejects an unknown event type', () => {
    expect(
      issueKeys(createWebhookSchema.safeParse({ url: 'https://a.dev/h', eventTypes: ['NOPE'] }))
    ).toContain('eventTypes.0');
  });

  it('requires a caller-supplied secret to be long enough', () => {
    expect(
      issueKeys(
        createWebhookSchema.safeParse({
          url: 'https://a.dev/h',
          eventTypes: ['TEST_COMPLETED'],
          secret: 'short',
        })
      )
    ).toContain('secret');
  });
});

describe('triggerAgentSchema', () => {
  it('requires a known agent type', () => {
    expect(issueKeys(triggerAgentSchema.safeParse({ agentType: 'NOPE' }))).toContain('agentType');
  });

  it('accepts a known agent type with input', () => {
    const parsed = triggerAgentSchema.parse({ agentType: 'EXPLORER', input: { a: '1' } });
    expect(parsed.agentType).toBe('EXPLORER');
  });
});

describe('auth schemas', () => {
  it('login requires a syntactically valid email', () => {
    expect(issueKeys(loginSchema.safeParse({ email: 'nope', password: 'x' }))).toContain('email');
  });

  it('register enforces a minimum password length', () => {
    expect(issueKeys(registerSchema.safeParse({ email: 'a@b.dev', password: 'short' }))).toContain(
      'password'
    );
  });

  it('register accepts a normal payload', () => {
    const parsed = registerSchema.parse({ email: 'a@b.dev', password: 'SuperSecret123!' });
    expect(parsed.email).toBe('a@b.dev');
  });
});
