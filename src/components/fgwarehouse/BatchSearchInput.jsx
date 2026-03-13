import { useState } from 'react';
import { X } from 'lucide-react';

function fmtDate(iso) {
  if (!iso) return '—';
  try { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; } catch { return iso; }
}

export default function BatchSearchInput({ batches, value, onSelect, placeholder = 'Type or select batch code…' }) {
  // batches: [{batch_code, mfg_date, exp_date}]
  // onSelect(batch_code, mfg_date, exp_date)
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selected = batches.find(b => b.batch_code === value);
  const filtered = batches.filter(b =>
    !query || b.batch_code.toLowerCase().includes(query.toLowerCase())
  );

  const clear = () => { onSelect('', '', ''); setQuery(''); };

  return (
    <div className="relative">
      {selected ? (
        <div className="flex items-center border border-slate-300 rounded-xl px-3 py-3 bg-white min-h-[56px]">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 uppercase tracking-wider">{selected.batch_code}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Mfg: {fmtDate(selected.mfg_date)} · Exp: {fmtDate(selected.exp_date)}
            </p>
          </div>
          <button
            type="button"
            onClick={clear}
            className="ml-2 p-2 rounded-lg hover:bg-slate-100 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      ) : (
        <input
          type="text"
          value={query}
          onChange={e => {
            const v = e.target.value.toUpperCase();
            setQuery(v);
            setOpen(true);
            onSelect(v, '', '');
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={placeholder}
          className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base uppercase tracking-wider shadow-sm placeholder:text-slate-400 placeholder:normal-case focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      )}

      {open && !selected && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {batches.length === 0 ? (
            <p className="text-sm text-slate-400 px-4 py-3 text-center">No recent batches — enter new code above</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-400 px-4 py-3 text-center">No match — will create new batch</p>
          ) : (
            <>
              <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 rounded-t-xl">
                <p className="text-xs text-slate-400 font-semibold">Recent batches (last 2 days) — tap to select</p>
              </div>
              {filtered.map((b, i) => (
                <button
                  key={i}
                  type="button"
                  onMouseDown={() => { onSelect(b.batch_code, b.mfg_date, b.exp_date); setQuery(''); setOpen(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 active:bg-slate-100 border-b border-slate-100 last:border-0"
                >
                  <p className="text-sm font-bold text-slate-900 uppercase tracking-wider">{b.batch_code}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Mfg: {fmtDate(b.mfg_date)} · Exp: {fmtDate(b.exp_date)}</p>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}