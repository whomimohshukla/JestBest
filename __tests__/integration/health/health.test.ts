import { request, teardownDatabase } from '../../fixtures/testApp';
import { setShuttingDown } from '../../../src/controllers/health';

const API = '/api/v1';

let api: Awaited<ReturnType<typeof request>>;

beforeAll(async () => {
  api = await request();
});

afterAll(async () => {
  await teardownDatabase();
});

describe('GET /health', () => {
  it('reports liveness', async () => {
    const res = await api.get(`${API}/health`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('up');
  });
});

describe('GET /health/live', () => {
  it('reports liveness without touching dependencies', async () => {
    const res = await api.get(`${API}/health/live`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('up');
  });
});

describe('GET /health/ready', () => {
  it('checks the database, Redis and the queue', async () => {
    const res = await api.get(`${API}/health/ready`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ready');
    for (const check of ['database', 'redis', 'queue'] as const) {
      expect(res.body.data.checks[check].status).toBe('ok');
      expect(typeof res.body.data.checks[check].latencyMs).toBe('number');
    }
  });

  it('is not rate-limited while other routes are', async () => {
    // Health probes must never consume the API budget: the orchestrator polls
    // this endpoint on a fixed schedule and a throttled probe reads as
    // "unhealthy".
    const probes = await Promise.all(Array.from({ length: 12 }, () => api.get(`${API}/health/ready`)));
    expect(probes.every((res) => res.status === 200)).toBe(true);
  });

  it('answers 503 while the server is draining', async () => {
    setShuttingDown(true);
    try {
      const res = await api.get(`${API}/health/ready`);

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
      expect(res.body.error.message).toMatch(/shutting down/i);
      expect(res.body.error.details.checks.database.status).toBe('ok');
    } finally {
      setShuttingDown(false);
    }

    const after = await api.get(`${API}/health/ready`);
    expect(after.status).toBe(200);
  });
});
