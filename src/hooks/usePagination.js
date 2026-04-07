import { useState, useMemo } from 'react';

/**
 * Reusable pagination hook.
 * @param {Array} items - filtered/sorted items
 * @param {number} pageSize - items per page (default 25)
 */
export default function usePagination(items, pageSize = 25) {
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);

  const paged = useMemo(() => {
    const start = safePage * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  return {
    paged,
    page: safePage,
    setPage,
    totalPages,
    totalItems: items.length,
    pageSize,
    hasNext: safePage < totalPages - 1,
    hasPrev: safePage > 0,
    next: () => setPage(p => Math.min(p + 1, totalPages - 1)),
    prev: () => setPage(p => Math.max(p - 1, 0)),
    reset: () => setPage(0),
  };
}