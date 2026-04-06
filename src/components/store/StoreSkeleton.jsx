// Reusable skeleton loader components for Store Management Module

export function SkeletonRow({ cols = 6 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-slate-200 rounded animate-pulse" style={{ width: `${60 + (i % 3) * 20}%` }} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 5, cols = 6, headers = [] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {headers.length > 0 && (
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs">
                {headers.map(h => <th key={h} className="text-left px-4 py-3 font-semibold">{h}</th>)}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} cols={cols} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-slate-200" />
        <div className="space-y-2 flex-1">
          <div className="h-3 bg-slate-200 rounded w-24" />
          <div className="h-5 bg-slate-200 rounded w-16" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonCards({ count = 3 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

export function SkeletonList({ rows = 4 }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center justify-between animate-pulse">
            <div className="space-y-2">
              <div className="h-4 bg-slate-200 rounded w-32" />
              <div className="h-3 bg-slate-200 rounded w-24" />
            </div>
            <div className="h-6 bg-slate-200 rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}