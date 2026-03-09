import { useState } from 'react';
import { X } from 'lucide-react';

// recentBatches: [{batch_code, mfg_date, exp_date}]
export default function BatchSearchInput({ recentBatches = [], value, onTextChange, onSelect, locked, onClear, id }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = recentBatches.filter(b =>
    !query || b.batch_code.toUpperCase().includes(query.toUpperCase())
  );

  const handleInput = (e) => {
    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9\-\/]/g, '');
    setQuery(v);
    onTextChange(v);
    setOpen(true);
  };

  const handleSelect = (b) => {
    setQuery('');
    setOpen(false);
    onSelect(b);
  };

  const handleClear = () => {
    setQuery('');
    setOpen(false);
    onClear();
  };

  if (locked && value) {
    return (
      <div className="flex items-center border border-slate-300 rounded-xl px-3 py-3 bg-slate-50 min-h-[52px]">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900">{value}</p>
          <p className="text-xs text-slate-400">Selected from recent batches — dates auto-filled</p>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="ml-2 p-2 rounded-lg hover:bg-slate-200 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
        >
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        value={value || query}
        onChange={handleInput}
        onFocus={() => recentBatches.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="e.g. B2603001"
        className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring uppercase"
      />

      {open && recentBatches.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          <p className="text-xs text-slate-400 px-3 pt-2 pb-1 font-semibold">Recent batches (last 2 days)</p>
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 px-4 py-3">No matching batches</p>
          ) : (
            filtered.map((b, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(b)}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 active:bg-slate-100 border-b border-slate-100 last:border-0"
              >
                <p className="text-sm font-bold text-slate-900">{b.batch_code}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mfg: {b.mfg_date || '—'} · Exp: {b.exp_date || '—'}
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}