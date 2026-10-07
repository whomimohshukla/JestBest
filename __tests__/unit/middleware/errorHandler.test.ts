import { errorHandler } from '../../../src/middleware/errorHandler';
import { ConflictError, NotFoundError } from '../../../src/utils/errors';

/**
 * Unit coverage for the translations the handler performs before it falls back
 * to a 500: Prisma's known-request codes and the app's own error types.
 */

type MockResponse = {
  statusCode: number;
  body?: { success: boolean; error: { code: string; message: string } };
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
};

const makeRes = (): MockResponse => {
  const res = {} as MockResponse;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload: unknown) => {
    res.body = payload as MockResponse['body'];
    return res;
  };
  return res;
};

const req = {
  requestId: 'req_unit',
  path: '/api/v1/things',
  method: 'POST',
} as never;

const next = (() => undefined) as never;

/** Single call site so the partial response double only needs one cast. */
const run = (error: unknown): MockResponse => {
  const res = makeRes();
  errorHandler(error, req, res as never, next);
  return res;
};

/** Duck-typed the way the handler sees a real PrismaClientKnownRequestError. */
const prismaError = (code: string, meta?: Record<string, unknown>) => ({
  name: 'PrismaClientKnownRequestError',
  code,
  message: `${code} happened`,
  clientVersion: '6.0.0',
  meta,
});

describe('errorHandler Prisma mapping', () => {
  it('maps P2002 to 409 CONFLICT naming the constrained field', () => {
    const res = run(prismaError('P2002', { target: ['organizationId', 'userId'] }));

    expect(res.statusCode).toBe(409);
    expect(res.body?.error.code).toBe('CONFLICT');
    expect(res.body?.error.message).toContain('organizationId, userId');
  });

  it('maps a string P2002 target to a single-field message', () => {
    const res = run(prismaError('P2002', { target: 'email' }));

    expect(res.statusCode).toBe(409);
    expect(res.body?.error.message).toContain('email');
  });

  it('falls back to a generic 409 message when the target is missing', () => {
    const res = run(prismaError('P2002'));

    expect(res.statusCode).toBe(409);
    expect(res.body?.error.message).toMatch(/already exists/i);
  });

  it('maps P2025 to 404 NOT_FOUND', () => {
    const res = run(prismaError('P2025', { model: 'TestSuiteItem', action: 'delete' }));

    expect(res.statusCode).toBe(404);
    expect(res.body?.error.code).toBe('NOT_FOUND');
    expect(res.body?.error.message).toMatch(/not found/i);
  });

  it('ignores codes that are not Prisma known-request codes', () => {
    const res = run({ code: 'ECONNREFUSED', name: 'Error' });

    expect(res.statusCode).toBe(500);
    expect(res.body?.error.code).toBe('INTERNAL_ERROR');
  });

  it('ignores unknown codes on objects that are not Prisma errors', () => {
    const res = run({ name: 'QueryFailedError', code: 'P2002' });

    expect(res.statusCode).toBe(500);
  });
});

describe('errorHandler app-error passthrough', () => {
  it('keeps an explicit ConflictError as a 409 with its message', () => {
    const res = run(new ConflictError('Already connected.'));

    expect(res.statusCode).toBe(409);
    expect(res.body?.error.code).toBe('CONFLICT');
    expect(res.body?.error.message).toBe('Already connected.');
  });

  it('keeps an explicit NotFoundError as a 404', () => {
    const res = run(new NotFoundError('Project not found.'));

    expect(res.statusCode).toBe(404);
    expect(res.body?.error.code).toBe('NOT_FOUND');
  });

  it('turns an unexpected throw into a 500 without leaking the message', () => {
    const res = run(new Error('database password is hunter2'));

    expect(res.statusCode).toBe(500);
    expect(res.body?.error.message).toBe('Internal server error');
    expect(res.body?.error.message).not.toContain('hunter2');
  });
});
