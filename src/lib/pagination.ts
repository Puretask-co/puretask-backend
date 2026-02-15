// src/lib/pagination.ts
// Standardized pagination helpers

import { Request } from "express";

// ============================================
// Types
// ============================================

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginationResult<T> {
  items: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

// ============================================
// Parsing
// ============================================

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Parse pagination parameters from request query
 */
export function parsePagination(req: Request): PaginationParams {
  const limit = Math.min(
    parseInt((req.query.limit as string) || String(DEFAULT_LIMIT), 10),
    MAX_LIMIT
  );
  const offset = Math.max(parseInt((req.query.offset as string) || "0", 10), 0);

  return { limit, offset };
}

/**
 * Validate pagination parameters
 */
export function validatePagination(limit: number, offset: number): void {
  if (limit < 1 || limit > MAX_LIMIT) {
    throw new Error(`Limit must be between 1 and ${MAX_LIMIT}`);
  }
  if (offset < 0) {
    throw new Error("Offset must be >= 0");
  }
}

// ============================================
// Response Formatting
// ============================================

/**
 * Format paginated response
 */
export function formatPaginatedResponse<T>(
  items: T[],
  total: number,
  limit: number,
  offset: number
): PaginationResult<T> {
  return {
    items,
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + items.length < total,
    },
  };
}

/**
 * Calculate total pages
 */
export function calculateTotalPages(total: number, limit: number): number {
  return Math.ceil(total / limit);
}
