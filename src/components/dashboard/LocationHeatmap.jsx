import { cn } from '@/lib/utils';

export default function LocationHeatmap({ cratesByLocation }) {
  if (!cratesByLocation || cratesByLocation.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Crates by Location</h3>
        <p className="text-sm text-slate-400">No crate data yet</p>
      </div>
    );
  }

  const max = Math.max(...cratesByLocation.map(l => l.count), 1);

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5">
      <h3 className="font-semibold text-slate-900 mb-4">Crates by Location</h3>
      <div className="space-y-2">
        {cratesByLocation.map((loc) => (
          <div key={loc.code} className="flex items-center gap-3">
            <div className="w-32 text-xs text-slate-600 font-medium truncate flex-shrink-0">{loc.code}</div>
            <div className="flex-1 h-7 bg-slate-100 rounded-lg overflow-hidden relative">
              <div
                className={cn('h-full rounded-lg transition-all duration-500', 
                  loc.count > 0 ? 'bg-blue-500' : 'bg-transparent'
                )}
                style={{ width: `${(loc.count / max) * 100}%` }}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-700">
                {loc.count}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}