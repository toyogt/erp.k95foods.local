import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { MapPin, ChevronDown, X } from 'lucide-react';

/**
 * A simple dropdown to pick a Store Location for opening stock assignment.
 * Optional — shows "Assign Location (optional)" label.
 */
export default function OpeningStockLocationSelect({ locationId, locationCode, onChange }) {
  const [locations, setLocations] = useState([]);
  const [query, setQuery] = useState(locationCode || '');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    base44.entities.StoreLocation.filter({ is_active: true, location_type: 'storage' }, 'location_code', 300)
      .then(setLocations)
      .catch(() => {});
  }, []);

  // Sync query if parent clears
  useEffect(() => { setQuery(locationCode || ''); }, [locationCode]);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = query.trim()
    ? locations.filter(l =>
        l.location_code?.toLowerCase().includes(query.toLowerCase()) ||
        l.display_name?.toLowerCase().includes(query.toLowerCase())
      )
    : locations;

  function selectLocation(loc) {
    setQuery(loc.location_code);
    setOpen(false);
    onChange({ location_id: loc.id, location_code: loc.location_code });
  }

  function clearSelection() {
    setQuery('');
    onChange({ location_id: '', location_code: '' });
  }

  return (
    <div className="relative" ref={ref}>
      <label className="text-xs font-medium text-slate-700">
        Opening Stock Location <span className="text-slate-400 font-normal">(optional)</span>
      </label>
      <div className="relative mt-1">
        <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          className="w-full h-9 pl-8 pr-8 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
          placeholder="Search location..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {locationId ? (
          <button type="button" onClick={clearSelection} className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <X className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
          </button>
        ) : (
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        )}
      </div>
      {open && (
        <div className="absolute z-[9999] top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400 text-center">
              {locations.length === 0 ? 'No store locations set up yet' : 'No matching locations'}
            </div>
          ) : filtered.map(loc => (
            <div
              key={loc.id}
              className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 ${loc.id === locationId ? 'bg-teal-50 text-teal-700 font-medium' : 'text-slate-700'}`}
              onClick={() => selectLocation(loc)}
            >
              <p className="font-mono font-semibold">{loc.location_code}</p>
              {loc.display_name && <p className="text-xs text-slate-400">{loc.display_name}</p>}
            </div>
          ))}
        </div>
      )}
      {locationId && (
        <p className="text-xs text-teal-600 mt-0.5">
          Opening stock will be immediately available for issue from this location.
        </p>
      )}
      {!locationId && (
        <p className="text-xs text-slate-400 mt-0.5">
          Without a location, opening stock cannot be issued until put away.
        </p>
      )}
    </div>
  );
}