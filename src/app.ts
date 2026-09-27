import 'reflect-metadata';
import express from 'express';

import routes from './routes';
import { apiRateLimiter } from './middleware/rateLimiter';
import { corsMiddleware, errorHandler, helmetMiddleware, requestId, requestLogger } from './middleware';

/**
 * Routes whose signature is computed over the exact request bytes. Their raw
 * body must be captured inside the global express.json() `verify` hook, because
 * express.json() runs before any route-level parser and a route-level
 * express.raw() would only ever see an already-parsed object.
 */
const SIGNATURE_VERIFIED_PATHS = ['/billing/webhooks/stripe'];

export const createApp = (): express.Express => {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        const request = req as express.Request;
        if (SIGNATURE_VERIFIED_PATHS.some((p) => request.originalUrl.includes(p))) {
          request.rawBody = Buffer.from(buf);
        }
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(requestLogger);

  app.use(apiRateLimiter);
  app.use(routes);

  app.use(errorHandler);

  return app;
};
