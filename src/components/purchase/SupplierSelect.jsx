import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, Loader2 } from 'lucide-react';
import { genId, logPurchaseAudit } from './purchaseHelpers';

/**
 * Smart supplier selector — searchable dropdown + free-text "Add as new" option.
 * Props: value (string), onChange(name, id), user (for audit)
 */
export default function SupplierSelect({ value, onChange, user }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const ref = useRef(null);

  const { data: suppliers = [], refetch } = useQuery({
    queryKey: ['supplier-select-list'],
    queryFn: () => base44.entities.Supplier.list('supplier_name', 500),
    staleTime: 60000,
  });

  useEffect(() => { setQuery(value || ''); }, [value]);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? suppliers.filter(s =>
        s.supplier_name?.toLowerCase().includes(q) ||
        s.supplier_id?.toLowerCase().includes(q) ||
        s.gstin?.toLowerCase().includes(q)
      ).slice(0, 15)
    : suppliers.slice(0, 15);

  const exactMatch = q && suppliers.some(s => s.supplier_name?.toLowerCase() === q);

  function handleSelect(s) {
    onChange(s.supplier_name, s.supplier_id);
    setQuery(s.supplier_name);
    setOpen(false);
  }

  function handleInputChange(val) {
    setQuery(val);
    onChange(val, '');
    setOpen(true);
  }

  async function handleAddNew() {
    if (!query.trim()) return;
    setAdding(true);
    const supplierId = genId('SUP');
    await base44.entities.Supplier.create({
      supplier_id: supplierId,
      supplier_name: query.trim(),
      approval_status: 'HOLD',
      is_approved: false,
      default_currency: 'INR',
    });
    await logPurchaseAudit({
      action: `Supplier ${supplierId} created from Purchase Order form`,
      entity_type: 'Supplier',
      entity_id: supplierId,
      user,
    });
    onChange(query.trim(), supplierId);
    setOpen(false);
    setAdding(false);
    refetch();
  }

  return (
    <div className="relative" ref={ref}>
      <label className="text-xs font-medium text-slate-700">Supplier Name *</label>
      <div className="relative mt-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="w-full h-11 md:h-9 pl-9 pr-3 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Enter supplier name"
          value={query}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={() => setOpen(true)}
        />
      </div>

      {open && (
        <div className="absolute z-[9999] top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {filtered.map(s => (
            <div
              key={s.id}
              className="px-3 py-2.5 text-sm cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => handleSelect(s)}
            >
              <p className="font-medium text-slate-900">{s.supplier_name}</p>
              <p className="text-xs text-slate-400">
                {s.supplier_id}
                {s.gstin ? ` · ${s.gstin}` : ''}
                {s.approval_status ? ` · ${s.approval_status}` : ''}
              </p>
            </div>
          ))}

          {q && !exactMatch && (
            <div
              className="px-3 py-2.5 text-sm cursor-pointer hover:bg-green-50 border-t border-slate-100 flex items-center gap-2 text-green-700 font-medium"
              onClick={handleAddNew}
            >
              {adding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>{adding ? 'Adding...' : `Add "${query.trim()}" as new supplier`}</span>
            </div>
          )}

          {filtered.length === 0 && !q && (
            <div className="px-3 py-3 text-sm text-slate-400 text-center">Type to search suppliers</div>
          )}
        </div>
      )}
    </div>
  );
}