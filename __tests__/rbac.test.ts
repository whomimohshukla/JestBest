import type { Request, Response } from 'express';
import { requirePermission, requireRole } from '../src/middleware/rbac';
import { ErrorCodes } from '../src/constants/errorCodes';
import type { AuthUser } from '../src/types/auth.types';

type Next = (err?: unknown) => void;

const authUser = (roles: string[], permissions: string[]): AuthUser => ({
  id: 'user_1',
  email: 'test@jestbest.dev',
  name: 'Test User',
  avatar: null,
  orgId: 'org_1',
  roles: roles as AuthUser['roles'],
  permissions,
});

const makeReq = (claims: { user?: AuthUser }): Partial<Request> => ({
  ...(claims.user ? { user: claims.user } : {}),
});

const makeRes = () => ({}) as Response;

const makeNext = () => {
  const next = jest.fn() as jest.Mock & Next;
  return next;
};

describe('requirePermission', () => {
  it('calls next() when the user has the required permission', () => {
    const req = makeReq({ user: authUser(['OWNER'], ['project:create']) });
    const next = makeNext();
    requirePermission('project:create')(req as Request, makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('rejects with 401 when unauthenticated', () => {
    const req = makeReq({ user: undefined });
    const next = makeNext();
    requirePermission('project:create')(req as Request, makeRes(), next);
    const err = next.mock.calls[0][0] as { statusCode: number; code: string };
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  it('rejects with 403 when the permission is missing', () => {
    const req = makeReq({ user: authUser(['DEVELOPER'], ['bug:read']) });
    const next = makeNext();
    requirePermission('project:delete')(req as Request, makeRes(), next);
    const err = next.mock.calls[0][0] as { statusCode: number; code: string };
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe(ErrorCodes.FORBIDDEN);
  });
});

describe('requireRole', () => {
  it('calls next() when the user holds one of the required roles', () => {
    const req = makeReq({ user: authUser(['QA_MANAGER'], []) });
    const next = makeNext();
    requireRole('OWNER', 'QA_MANAGER')(req as Request, makeRes(), next);
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('rejects with 403 when the role is not held', () => {
    const req = makeReq({ user: authUser(['DEVELOPER'], []) });
    const next = makeNext();
    requireRole('OWNER')(req as Request, makeRes(), next);
    const err = next.mock.calls[0][0] as { statusCode: number };
    expect(err.statusCode).toBe(403);
  });
});
