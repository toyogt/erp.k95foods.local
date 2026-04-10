import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Plus, Loader2, Search } from 'lucide-react';

/**
 * Smart batch selector — searches BatchRegistry, allows free-text entry.
 * Props: value, onChange(batchNo), skuCode (optional filter)
 */
export default function LblBatchSelect({ value, onChange, skuCode }) {
  const [search, setSearch] = useState(value || '');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['batch-registry-search', skuCode],
    queryFn: () => {
      if (skuCode) return base44.entities.BatchRegistry.filter({ product_code: skuCode }, '-created_date', 50);
      return base44.entities.BatchRegistry.list('-created_date', 50);
    },
  });

  useEffect(() => { setSearch(value || ''); }, [value]);

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = batches.filter(b =>
    b.batch_id?.toLowerCase().includes(search.toLowerCase())
  );

  const exactMatch = batches.some(b => b.batch_id?.toLowerCase() === search.trim().toLowerCase());

  const handleSelect = (batchId) => {
    onChange(batchId);
    setSearch(batchId);
    setOpen(false);
  };

  const handleAddNew = () => {
    const trimmed = search.trim();
    if (trimmed) {
      onChange(trimmed);
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Type to search or add new batch"
          className="h-11 md:h-9 pl-8"
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading batches...
            </div>
          )}
          {!isLoading && filtered.length === 0 && !search.trim() && (
            <div className="px-3 py-2 text-sm text-slate-400">No batches found</div>
          )}
          {filtered.map(b => (
            <button
              key={b.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"
              onClick={() => handleSelect(b.batch_id)}
            >
              <span className="font-medium text-slate-900">{b.batch_id}</span>
              {b.product_name && <span className="text-xs text-slate-400 truncate ml-2">{b.product_name}</span>}
            </button>
          ))}
          {search.trim() && !exactMatch && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 flex items-center gap-2 font-medium"
              onClick={handleAddNew}
            >
              <Plus className="w-3.5 h-3.5" /> Use "{search.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}