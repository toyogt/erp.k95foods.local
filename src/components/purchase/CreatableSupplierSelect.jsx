import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, Loader2, X, AlertTriangle } from 'lucide-react';
import { genId, logPurchaseAudit } from './purchaseHelpers';

export default function CreatableSupplierSelect({ value, onChange, user, showClear }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [manualName, setManualName] = useState('');
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const ref = useRef(null);

  const { data: suppliers = [], refetch } = useQuery({
    queryKey: ['supplier-creatable-list'],
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
    ? suppliers.filter(s => s.supplier_name?.toLowerCase().includes(q) || s.supplier_id?.toLowerCase().includes(q) || s.gstin?.toLowerCase().includes(q)).slice(0, 15)
    : suppliers.slice(0, 15);
  const exactMatch = q && suppliers.some(s => s.supplier_name?.toLowerCase() === q);

  function handleSelect(s) {
    onChange({ supplier_id: s.supplier_id, supplier_name: s.supplier_name, gstin: s.gstin, address: s.address, city: s.city, state: s.state, phone: s.phone, email: s.email, contact_name: s.contact_name });
    setQuery(s.supplier_name);
    setOpen(false);
    setShowSavePrompt(false);
  }

  function handleManualEntry() {
    const name = query.trim();
    if (!name) return;
    setManualName(name);
    onChange({ supplier_id: '', supplier_name: name });
    setOpen(false);
    setShowSavePrompt(true);
  }

  async function handleSaveToMaster() {
    if (!manualName.trim()) return;
    setAdding(true);
    const supplierId = genId('SUP');
    await base44.entities.Supplier.create({
      supplier_id: supplierId,
      supplier_name: manualName.trim(),
      approval_status: 'HOLD',
      is_approved: false,
      default_currency: 'INR',
    });
    await logPurchaseAudit({ action: `Supplier ${supplierId} (${manualName.trim()}) created from Purchase Order form`, action_type: 'create', entity_type: 'Supplier', entity_id: supplierId, user });
    onChange({ supplier_id: supplierId, supplier_name: manualName.trim() });
    setShowSavePrompt(false);
    setAdding(false);
    refetch();
  }

  function handleClear() {
    setQuery('');
    setManualName('');
    setShowSavePrompt(false);
    onChange({ supplier_id: '', supplier_name: '' });
  }

  const statusBadge = (status) => {
    if (status === 'APPROVED') return null;
    const cls = status === 'HOLD' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
    return <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${cls}`}>{status}</span>;
  };

  return (
    <div className="relative" ref={ref}>
      <label className="text-xs font-medium text-slate-700">Supplier *</label>
      <div className="relative mt-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="w-full h-11 md:h-9 pl-9 pr-10 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Type to search or add new supplier..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setShowSavePrompt(false); }}
          onFocus={() => setOpen(true)}
        />
        {(showClear && query) && (
          <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showSavePrompt && (
        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700 flex-1">Save &quot;{manualName}&quot; to supplier master?</p>
          <button onClick={handleSaveToMaster} disabled={adding} className="text-sm font-bold text-green-700 hover:text-green-800">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </button>
          <button onClick={() => setShowSavePrompt(false)} className="text-sm text-slate-500 hover:text-slate-700">Skip</button>
        </div>
      )}

      {open && (
        <div className="absolute z-[9999] top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {filtered.map(s => (
            <div key={s.id} className="px-3 py-2.5 text-sm cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleSelect(s)}>
              <div className="flex items-center gap-2">
                <p className="font-medium text-slate-900 flex-1">{s.supplier_name}</p>
                {statusBadge(s.approval_status)}
              </div>
              <p className="text-xs text-slate-400">{s.supplier_id}{s.gstin ? ` · ${s.gstin}` : ''}{s.city ? ` · ${s.city}` : ''}</p>
            </div>
          ))}
          {q && !exactMatch && (
            <div className="px-3 py-2.5 text-sm cursor-pointer hover:bg-green-50 border-t border-slate-100 flex items-center gap-2 text-green-700 font-medium" onClick={handleManualEntry}>
              <Plus className="w-4 h-4" />
              <span>Add &quot;{query.trim()}&quot;</span>
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