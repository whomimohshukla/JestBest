export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

import type { AuthUser } from './auth.types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express Request type augmentation requires a namespace
  namespace Express {
    interface Request {
      requestId: string;
      user?: AuthUser;
      orgId?: string;
      /**
       * Verbatim bytes of the request body, retained only for webhook routes that
       * must verify a signature over the exact payload Stripe/others sent.
       * Re-serializing a parsed body is not signature-safe.
       */
      rawBody?: Buffer;
    }
  }
}

export interface AuthenticatedRequest {
  user: AuthUser;
  orgId: string;
}
