export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'BAD_REQUEST'
  | 'INTERNAL_ERROR'
  | 'UPSTREAM_ERROR'
  | 'TWO_FACTOR_REQUIRED'
  | 'TWO_FACTOR_INVALID'
  | 'ACCOUNT_SUSPENDED'
  | 'EMAIL_NOT_VERIFIED'
  | 'SERVICE_UNAVAILABLE';

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
  details?: unknown;
}
