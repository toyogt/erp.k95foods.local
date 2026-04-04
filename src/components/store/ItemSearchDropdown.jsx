import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, X } from 'lucide-react';

export default function ItemSearchDropdown({ value, onSelect, onClear }) {
  const [query, setQuery] = useState(value || '');
  const [allItems, setAllItems] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Sync external value changes
  useEffect(() => { setQuery(value || ''); }, [value]);

  // Load all active items once
  useEffect(() => {
    base44.entities.ItemMaster.filter({ is_active: true }, 'item_name', 200).then(setAllItems);
  }, []);

  // Filter based on query — show all on empty query when focused
  useEffect(() => {
    if (!query.trim()) {
      setFiltered(allItems.slice(0, 20));
    } else {
      const q = query.toLowerCase();
      setFiltered(
        allItems
          .filter(i => i.item_name?.toLowerCase().includes(q) || i.item_code?.toLowerCase().includes(q))
          .slice(0, 12)
      );
    }
  }, [query, allItems]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSelect(item) {
    setQuery(item.item_name);
    setOpen(false);
    onSelect(item);
  }

  function handleClear() {
    setQuery('');
    setOpen(false);
    onClear?.();
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search item name or code…"
          className="w-full h-9 md:h-9 h-11 border border-slate-200 rounded-md pl-8 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400"
        />
        {query && (
          <button type="button" onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-40 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-56 overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map(item => (
              <button key={item.id} type="button"
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 flex items-center justify-between border-b border-slate-50 last:border-0"
                onMouseDown={() => handleSelect(item)}>
                <span className="font-medium text-slate-900 truncate">{item.item_name}</span>
                <span className="text-xs text-slate-400 ml-2 font-mono shrink-0">{item.item_code}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-sm text-slate-400 text-center">No items found</div>
          )}
        </div>
      )}
    </div>
  );
}