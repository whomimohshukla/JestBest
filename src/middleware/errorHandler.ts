import { Request, Response, NextFunction } from 'express';
import { isAppError } from '../utils/errors';
import { errorResponse } from '../utils/formatters';
import { ErrorCodes } from '../constants';
import { logger } from '../config/logger';

/**
 * Prisma's known-request errors are the only ones that carry a stable
 * `code`/`meta`. Duck-typed rather than `instanceof` because the class comes
 * from @prisma/client and a duplicate install (nested node_modules, a worker
 * bundle) would make instanceof fail while the shape still holds.
 */
const asPrismaKnownError = (error: unknown): { code: string; meta?: Record<string, unknown> } | null => {
  if (typeof error !== 'object' || error === null) return null;
  const candidate = error as { code?: unknown; meta?: unknown; name?: unknown };
  if (typeof candidate.code !== 'string' || !/^P\d{4}$/.test(candidate.code)) return null;
  if (candidate.name && candidate.name !== 'PrismaClientKnownRequestError') return null;
  return {
    code: candidate.code,
    meta:
      typeof candidate.meta === 'object' && candidate.meta !== null
        ? (candidate.meta as Record<string, unknown>)
        : undefined,
  };
};

const prismaErrorMessage = (meta?: Record<string, unknown>): string => {
  const target = meta?.target;
  const field = Array.isArray(target) ? target.join(', ') : typeof target === 'string' ? target : null;
  return field ? `A record with this ${field} already exists.` : 'A record with this value already exists.';
};

export const errorHandler = (error: unknown, req: Request, res: Response, _next: NextFunction): void => {
  const requestId = req.requestId;

  if (isAppError(error)) {
    res
      .status(error.statusCode)
      .json(errorResponse({ code: error.code, message: error.message, details: error.details }, requestId));
    return;
  }

  // Unique-constraint and missing-record failures are ordinary API outcomes —
  // a duplicate slug or a delete of an already-deleted row used to escape as an
  // unhandled 500 because nothing translated Prisma's error codes.
  const prismaError = asPrismaKnownError(error);
  if (prismaError?.code === 'P2002') {
    res
      .status(409)
      .json(
        errorResponse({ code: ErrorCodes.CONFLICT, message: prismaErrorMessage(prismaError.meta) }, requestId)
      );
    return;
  }
  if (prismaError?.code === 'P2025') {
    res
      .status(404)
      .json(errorResponse({ code: ErrorCodes.NOT_FOUND, message: 'Resource not found.' }, requestId));
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    res
      .status(400)
      .json(errorResponse({ code: ErrorCodes.VALIDATION_ERROR, message: 'Malformed JSON body' }, requestId));
    return;
  }

  logger.error({ err: error, requestId, path: req.path, method: req.method }, 'unhandled error');
  res
    .status(500)
    .json(errorResponse({ code: ErrorCodes.INTERNAL_ERROR, message: 'Internal server error' }, requestId));
};
