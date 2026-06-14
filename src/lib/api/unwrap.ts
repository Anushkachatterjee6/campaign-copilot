import type { PaginatedList } from "./types";

/** DRF may return a bare array or { count, results } — normalize to an array. */
export function unwrapList<T>(data: T[] | PaginatedList<T> | null | undefined): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "object" && Array.isArray(data.results)) return data.results;
  return [];
}

/** Total count from paginated response, or array length. */
export function unwrapCount<T>(data: T[] | PaginatedList<T> | null | undefined): number {
  if (!data) return 0;
  if (Array.isArray(data)) return data.length;
  if (typeof data === "object" && typeof data.count === "number") return data.count;
  return unwrapList(data).length;
}
