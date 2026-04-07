import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function TablePagination({ page, totalPages, totalItems, pageSize, hasNext, hasPrev, next, prev }) {
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, totalItems);

  if (totalItems <= pageSize) {
    return (
      <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-500">
        {totalItems} record(s)
      </div>
    );
  }

  return (
    <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between">
      <p className="text-xs text-slate-500">
        {from}–{to} of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={prev}
          disabled={!hasPrev}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-slate-600 px-2 font-medium">
          {page + 1} / {totalPages}
        </span>
        <button
          onClick={next}
          disabled={!hasNext}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}