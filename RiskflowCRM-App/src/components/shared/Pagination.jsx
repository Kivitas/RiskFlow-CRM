import React from 'react';
import { Button } from '@/components/ui/button';

export const PAGE_SIZE = 25;

/** Returns the slice of `items` for the 1-based `page`, clamped to the last valid page. */
export function paginate(items, page, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export default function Pagination({ page, total, pageSize = PAGE_SIZE, onPageChange, label = 'items' }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border"
    >
      <p className="text-xs text-muted-foreground" aria-live="polite">
        Showing {start}–{end} of {total} {label}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onPageChange(safePage - 1)} disabled={safePage <= 1}>
          Previous
        </Button>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          Page {safePage} of {totalPages}
        </span>
        <Button variant="outline" size="sm" onClick={() => onPageChange(safePage + 1)} disabled={safePage >= totalPages}>
          Next
        </Button>
      </div>
    </nav>
  );
}
