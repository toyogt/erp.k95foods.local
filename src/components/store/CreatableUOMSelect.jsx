import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, ChevronDown, Loader2 } from 'lucide-react';

export default function CreatableUOMSelect({ value, onChange }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const wrapperRef = useRef();

  useEffect(() => {
    loadUOMs();
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function loadUOMs() {
    setLoading(true);
    const data = await base44.entities.UOMMaster.filter({ is_active: true }, 'uom_name', 500);
    setOptions(data);
    setLoading(false);
  }

  const filtered = options.filter(u =>
    u.uom_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.uom_code?.toLowerCase().includes(search.toLowerCase())
  );

  const exactMatch = options.some(u => u.uom_name?.toLowerCase().trim() === search.toLowerCase().trim());

  async function handleCreate() {
    const name = search.trim();
    if (!name) return;
    setCreating(true);
    const code = name.toUpperCase().replace(/\s+/g, '_').substring(0, 20);
    const newUom = await base44.entities.UOMMaster.create({
      uom_id: `UOM-${code}`,
      uom_code: code,
      uom_name: name,
      must_be_whole_number: false,
      is_active: true
    });
    setOptions(prev => [...prev, newUom]);
    onChange(newUom.uom_code);
    setSearch('');
    setOpen(false);
    setCreating(false);
  }

  function handleSelect(uom) {
    onChange(uom.uom_code);
    setSearch('');
    setOpen(false);
  }

  const selectedLabel = options.find(u => u.uom_code === value)?.uom_name || value || '';

  return (
    <div ref={wrapperRef} className="relative">
      <label className="text-xs font-medium text-slate-700">Unit of Measure <span className="text-red-500">*</span></label>
      <div
        className="mt-1 flex items-center h-9 w-full border border-slate-200 rounded-md bg-white cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <input
            autoFocus
            className="flex-1 h-full px-3 text-sm outline-none rounded-md bg-transparent"
            placeholder="Type to search or add new…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className={`flex-1 px-3 text-sm ${selectedLabel ? 'text-slate-900' : 'text-slate-400'}`}>
            {selectedLabel || 'Select Unit of Measure'}
          </span>
        )}
        {loading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 mr-2 text-slate-400" />
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {filtered.length === 0 && !search && (
            <div className="px-3 py-3 text-sm text-slate-400">No units found</div>
          )}
          {filtered.map(u => (
            <button
              key={u.id}
              type="button"
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 flex items-center justify-between"
              onClick={() => handleSelect(u)}
            >
              <span className="text-slate-900">{u.uom_name}</span>
              <span className="text-xs text-slate-400">{u.uom_code}</span>
            </button>
          ))}
          {search.trim() && !exactMatch && (
            <button
              type="button"
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 text-blue-700 font-medium flex items-center gap-2 border-t border-slate-100"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add "{search.trim()}"
            </button>
          )}
        </div>
      )}
      <p className="text-xs text-slate-400 mt-0.5">Type to search or add new</p>
    </div>
  );
}