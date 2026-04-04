import { useState, useEffect, useRef } from 'react';
import { Camera, X, Search, QrCode } from 'lucide-react';
import QRScanner from '@/components/store/QRScanner';

export default function LotSearchField({ value, onChange, availableLots = [], manualAllowed }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const wrapperRef = useRef(null);

  // Sync external value
  useEffect(() => { setQuery(value || ''); }, [value]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Filter lots by query
  const q = query.toLowerCase();
  const filtered = q
    ? availableLots.filter(lot => lot.toLowerCase().includes(q))
    : availableLots;

  function handleSelect(lotId) {
    setQuery(lotId);
    setOpen(false);
    onChange(lotId);
  }

  function handleScan(val) {
    setQuery(val);
    setShowScanner(false);
    onChange(val);
  }

  function handleClear() {
    setQuery('');
    setOpen(false);
    onChange('');
  }

  // If a value is selected, show the confirmed state
  if (value) {
    return (
      <div className="flex items-center justify-between bg-teal-50 border border-teal-300 rounded-lg px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <QrCode className="w-4 h-4 text-teal-600 shrink-0" />
          <span className="text-sm font-mono font-semibold text-teal-800 truncate">{value}</span>
        </div>
        <button type="button" onClick={handleClear}
          className="text-xs text-slate-400 hover:text-red-500 ml-2 shrink-0">
          Clear
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative space-y-1.5">
      {/* Input row with camera button */}
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              if (manualAllowed) setOpen(true);
            }}
            onFocus={() => { if (availableLots.length > 0) setOpen(true); }}
            readOnly={!manualAllowed}
            placeholder={manualAllowed ? "Search or type Lot ID…" : "Scan or select a lot"}
            className="w-full h-9 md:h-9 h-11 border border-slate-200 rounded-md pl-8 pr-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400"
          />
        </div>
        {/* Single camera/scan button */}
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          className="h-9 md:h-9 h-11 w-11 flex items-center justify-center bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-md transition-colors shrink-0"
          title="Scan Lot QR"
        >
          <Camera className="w-5 h-5" />
        </button>
      </div>

      {/* Full-screen scanner overlay */}
      {showScanner && (
        <QRScanner onScan={handleScan} label="Scan Lot QR Code" />
      )}

      {/* Dropdown with available lots */}
      {open && filtered.length > 0 && (
        <div className="absolute z-40 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
          {filtered.slice(0, 10).map(lotId => (
            <button key={lotId} type="button"
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 font-mono text-slate-700 border-b border-slate-50 last:border-0"
              onMouseDown={() => handleSelect(lotId)}>
              {lotId}
            </button>
          ))}
        </div>
      )}

      {/* Show lot chips when dropdown is closed */}
      {!open && availableLots.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {availableLots.slice(0, 5).map(lotId => (
            <button key={lotId} type="button" onClick={() => handleSelect(lotId)}
              className="text-xs bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded px-2 py-1 font-mono h-7">
              {lotId}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}