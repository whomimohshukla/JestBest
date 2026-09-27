import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';
import { validateSchema } from '../utils/validation';

export type ValidationSource = 'body' | 'query' | 'params';

export const validate = (schema: ZodType<unknown>, source: ValidationSource = 'body') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = getSourceData(req, source);
      const result = validateSchema(schema, data);
      setSourceData(req, source, result);
      next();
    } catch (error) {
      next(error);
    }
  };
};

const getSourceData = (req: Request, source: ValidationSource): unknown => {
  switch (source) {
    case 'query':
      return req.query;
    case 'params':
      return req.params;
    default:
      return req.body ?? {};
  }
};

const setSourceData = (req: Request, source: ValidationSource, data: unknown): void => {
  switch (source) {
    case 'query':
      Object.defineProperty(req, 'query', {
        value: data as Record<string, string | string[] | undefined>,
        enumerable: true,
        configurable: true,
        writable: true,
      });
      break;
    case 'params':
      // Merge rather than replace. Path parameters are declared by the router,
      // not the client, and a Zod object schema strips keys it does not know
      // about. Replacing outright would delete e.g. :userId when an earlier
      // middleware validated a schema containing only :organizationId, breaking
      // any route that validates params more than once.
      Object.defineProperty(req, 'params', {
        value: {
          ...(req.params as Record<string, string>),
          ...(data as Record<string, string>),
        },
        enumerable: true,
        configurable: true,
        writable: true,
      });
      break;
    default:
      req.body = data;
      break;
  }
};
