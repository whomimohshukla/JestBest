import jwt from 'jsonwebtoken';
import { signToken, verifyToken, accessTokenExpirySeconds } from '../../../src/utils/jwt';
import { UnauthorizedError } from '../../../src/utils/errors';
import { env } from '../../../src/config/environment';

const payload = { sub: 'user_1', orgId: 'org_1', roles: ['OWNER'], type: 'access' } as const;

describe('signToken / verifyToken', () => {
  it('round-trips the payload for an access token', () => {
    const token = signToken(payload as never, 'access');
    const decoded = verifyToken(token, 'access');
    expect(decoded.sub).toBe('user_1');
    expect(decoded.orgId).toBe('org_1');
    expect(decoded.roles).toEqual(['OWNER']);
  });

  it('round-trips the payload for a refresh token', () => {
    const token = signToken(payload as never, 'refresh');
    expect(verifyToken(token, 'refresh').sub).toBe('user_1');
  });

  it('stamps the configured issuer', () => {
    const decoded = jwt.decode(signToken(payload as never, 'access')) as jwt.JwtPayload;
    expect(decoded.iss).toBe(env.JWT_ISSUER);
  });

  it('rejects an access token presented as a refresh token', () => {
    const token = signToken(payload as never, 'access');
    expect(() => verifyToken(token, 'refresh')).toThrow(UnauthorizedError);
  });

  it('rejects a refresh token presented as an access token', () => {
    const token = signToken(payload as never, 'refresh');
    expect(() => verifyToken(token, 'access')).toThrow(UnauthorizedError);
  });

  it('rejects a token signed with a different secret', () => {
    const forged = jwt.sign(payload, 'a-completely-different-secret-value-000', {
      issuer: env.JWT_ISSUER,
    });
    expect(() => verifyToken(forged, 'access')).toThrow(UnauthorizedError);
  });

  it('rejects a token with the wrong issuer', () => {
    const wrongIssuer = jwt.sign(payload, env.JWT_ACCESS_SECRET, { issuer: 'someone-else' });
    expect(() => verifyToken(wrongIssuer, 'access')).toThrow(UnauthorizedError);
  });

  it('rejects an expired token with the session-expired message', () => {
    const expired = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      issuer: env.JWT_ISSUER,
      expiresIn: '-10s',
    });
    expect(() => verifyToken(expired, 'access')).toThrow(/session has expired/i);
  });

  it('rejects garbage input', () => {
    expect(() => verifyToken('not-a-token', 'access')).toThrow(UnauthorizedError);
  });
});

describe('accessTokenExpirySeconds', () => {
  it('returns a future timestamp consistent with the configured lifetime', () => {
    const seconds = accessTokenExpirySeconds();
    expect(seconds).toBeGreaterThan(Math.floor(Date.now() / 1000));
    // Default dev/test config is 15m; allow a small execution-time tolerance.
    expect(seconds).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 15 * 60 + 5);
  });
});
