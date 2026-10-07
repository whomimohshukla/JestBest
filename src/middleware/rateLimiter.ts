import { rateLimit, RateLimitRequestHandler } from 'express-rate-limit';
import { env } from '../config/environment';
import { Messages } from '../constants/messages';
import type { ErrorCode } from '../types/errors.types';

export const createRateLimiter = (
  options: {
    windowMs?: number;
    max?: number;
    code?: ErrorCode;
    message?: string;
  } = {}
): RateLimitRequestHandler => {
  return rateLimit({
    windowMs: options.windowMs ?? env.RATE_LIMIT_WINDOW_MS,
    max: options.max ?? env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    // Health probes come from the orchestrator and the load balancer on a fixed
    // schedule. Counting them against the API budget means a busy deploy can
    // throttle the very probe that decides whether the container is healthy.
    skip: (req) => /(^|\/)health(\/|$)/.test(req.path),
    message: {
      success: false,
      error: {
        code: options.code ?? 'RATE_LIMITED',
        message: options.message ?? Messages.AUTH.RATE_LIMITED,
      },
    },
  });
};

export const apiRateLimiter = createRateLimiter();

export const authRateLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
  max: env.RATE_LIMIT_AUTH_MAX,
  code: 'RATE_LIMITED',
  message: Messages.AUTH.RATE_LIMITED_AUTH,
});
