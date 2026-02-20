// src/types/api-dtos.ts
// Section 7: Shared API request/response DTOs for consistency across endpoints.
// Use with OpenAPI and validateBody/validateQuery/validateParams.

/**
 * Standard error response (matches src/lib/errors.ts sendError)
 */
export interface ErrorResponseDto {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

/**
 * Paginated list response (use with parsePagination + formatPaginatedResponse)
 */
export interface PaginatedResponseDto<T> {
  items: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

/**
 * Admin list jobs query params (GET /admin/jobs)
 */
export interface AdminListJobsQueryDto {
  status?: string;
  clientId?: string;
  cleanerId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: string;
  offset?: string;
}

/**
 * Common success wrapper
 */
export interface SuccessResponseDto<T = unknown> {
  data?: T;
  ok?: boolean;
  requestId?: string;
}
