import { useState, useEffect, useRef } from 'react';
import { Search, MapPin } from 'lucide-react';

export default function LocationIssueSelect({ locations, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = locations.find(l => l.location_id === value);
  const filtered = query.trim()
    ? locations.filter(l =>
        l.location_code?.toLowerCase().includes(query.toLowerCase())
      )
    : locations;

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (locations.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <div
        className="flex items-center h-11 border border-slate-200 rounded-md px-3 gap-2 cursor-pointer bg-white"
        onClick={() => { setOpen(true); setQuery(''); }}
      >
        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
        <span className={`flex-1 text-sm truncate ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
          {selected ? `${selected.location_code} — ${selected.stock} ${selected.uom}` : 'Select location...'}
        </span>
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg">
          <div className="p-2 border-b">
            <div className="flex items-center gap-2 px-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                autoFocus
                className="flex-1 text-sm outline-none"
                placeholder="Search location..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No locations found</p>
            ) : filtered.map(l => (
              <div
                key={l.location_id}
                className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 ${l.location_id === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                onClick={() => { onChange(l.location_id, l); setOpen(false); setQuery(''); }}
              >
                <p className="font-medium">{l.location_code}</p>
                <p className="text-xs text-slate-400">Available: {l.stock} {l.uom}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}