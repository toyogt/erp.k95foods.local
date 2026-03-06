import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, ChevronDown } from 'lucide-react';

export default function ItemSelector({ value, onChange, placeholder = 'Select or search items...' }) {
  const [items, setItems] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    base44.entities.IngredientMaster.filter({ is_active: true }, 'ingredient_name', 500)
      .then(setItems)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(items.slice(0, 15));
    } else {
      const q = search.toLowerCase();
      setFiltered(items.filter(it =>
        it.ingredient_name?.toLowerCase().includes(q) ||
        it.short_code?.toLowerCase().includes(q)
      ).slice(0, 15));
    }
  }, [search, items]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item) => {
    setSelected(item);
    onChange(item);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={search || (selected?.ingredient_name ? `${selected.ingredient_name} (${selected.short_code})` : '')}
          onChange={e => {
            setSearch(e.target.value);
            setOpen(true);
            if (value?.id === selected?.id) {
              setSelected(null);
              onChange(null);
            }
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 pl-10 pr-10 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <ChevronDown className={`w-4 h-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {open && (
        <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              {search ? `No items found for "${search}"` : 'No items available'}
            </div>
          ) : (
            filtered.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-slate-100 last:border-0 transition"
              >
                <div className="font-medium text-sm text-slate-900">{item.ingredient_name}</div>
                <div className="text-xs text-slate-500">{item.short_code || 'N/A'}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}