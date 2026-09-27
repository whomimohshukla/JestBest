import {
  auth,
  createTestUser,
  request,
  resetDatabase,
  teardownDatabase,
  TestUser,
} from '../../fixtures/testApp';

/**
 * Agent trigger validation.
 *
 * The Prisma `AgentType` enum is a superset of what the orchestrator can run:
 * EXECUTION and REPORT_AGENT have no graph node. They used to be accepted by
 * the validator and then blew up inside StateGraph as a 500, so they must now be
 * rejected at the edge with a 400 while real types still get through.
 */

const API = '/api/v1';

let api: Awaited<ReturnType<typeof request>>;
let user: TestUser;

beforeAll(async () => {
  api = await request();
});

beforeEach(async () => {
  await resetDatabase();
  user = await createTestUser(api);
});

afterAll(async () => {
  await teardownDatabase();
});

describe('agent trigger validation', () => {
  it.each(['EXECUTION', 'REPORT_AGENT'])(
    'rejects the unimplemented agent type %s with 400 instead of 500',
    async (agentType) => {
      const response = await api
        .post(`${API}/agents/trigger`)
        .set(auth(user))
        .send({ agentType });

      expect(response.status).toBe(400);
      expect(response.status).not.toBe(500);
      expect(response.body.error.message).toBeDefined();
    }
  );

  it.each(['EXPLORER', 'TEST_GENERATOR', 'FAILURE_ANALYZER', 'BUG_AGENT'])(
    'still accepts the implemented agent type %s',
    async (agentType) => {
      const response = await api
        .post(`${API}/agents/trigger`)
        .set(auth(user))
        .send({ agentType });

      expect(response.status).toBe(201);
    }
  );

  it('rejects a completely unknown agent type', async () => {
    const response = await api
      .post(`${API}/agents/trigger`)
      .set(auth(user))
      .send({ agentType: 'NOT_AN_AGENT' });

    expect(response.status).toBe(400);
  });
});
