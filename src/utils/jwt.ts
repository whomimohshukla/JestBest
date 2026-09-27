import jwt from 'jsonwebtoken';
import { env } from '../config/environment';
import { UnauthorizedError } from './errors';
import type { JwtPayload } from '../types/auth.types';
import { getSecondsFromNow } from './helpers';

export type TokenType = 'access' | 'refresh';

export interface SignOptions {
  expiresIn: string | number;
  issuer: string;
}

const getSecretForType = (type: TokenType): string => {
  return type === 'access' ? env.JWT_ACCESS_SECRET : env.JWT_REFRESH_SECRET;
};

export const signToken = (payload: JwtPayload, type: TokenType): string => {
  const options: jwt.SignOptions = {
    expiresIn: (type === 'access'
      ? env.JWT_ACCESS_EXPIRES_IN
      : env.JWT_REFRESH_EXPIRES_IN) as jwt.SignOptions['expiresIn'],
    issuer: env.JWT_ISSUER,
  };
  return jwt.sign(payload, getSecretForType(type), options);
};

export const accessTokenExpirySeconds = (): number => {
  return getSecondsFromNow(parseExpiry(env.JWT_ACCESS_EXPIRES_IN));
};

export const refreshTokenExpirySeconds = (): number => {
  return getSecondsFromNow(parseExpiry(env.JWT_REFRESH_EXPIRES_IN));
};

export const verifyToken = (token: string, type: TokenType): JwtPayload => {
  try {
    return jwt.verify(token, getSecretForType(type), {
      issuer: env.JWT_ISSUER,
    }) as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Your session has expired. Please sign in again.');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Invalid or expired token.');
    }
    throw error;
  }
};

const parseExpiry = (value: string): number => {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) return 60 * 15;
  const n = Number(match[1]);
  switch (match[2]) {
    case 's':
      return n;
    case 'm':
      return n * 60;
    case 'h':
      return n * 60 * 60;
    case 'd':
      return n * 60 * 60 * 24;
    default:
      return 60 * 15;
  }
};
