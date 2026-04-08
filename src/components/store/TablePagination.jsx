import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function TablePagination({ total, page, pageSize, onPageChange, onPageSizeChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-2.5 bg-slate-50/80 border-t border-slate-100">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>Rows per page:</span>
        <select
          className="h-7 border border-slate-200 rounded px-1.5 text-xs bg-white"
          value={pageSize}
          onChange={e => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
        >
          {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="ml-2">{start}–{end} of {total}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-slate-600 font-medium px-2">Page {page} of {totalPages}</span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}