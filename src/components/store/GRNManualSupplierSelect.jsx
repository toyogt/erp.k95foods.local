import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { base44 } from '@/api/base44Client';
import { Search, ChevronDown, Plus } from 'lucide-react';

const SETTING_KEY = 'store_manual_suppliers';

export default function GRNManualSupplierSelect({ value, onChange }) {
  const [approvedSuppliers, setApprovedSuppliers] = useState([]);
  const [manualSuppliers, setManualSuppliers] = useState([]);
  const [manualSettingId, setManualSettingId] = useState(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    Promise.all([
      base44.entities.Supplier.filter({ approval_status: 'APPROVED' }, 'supplier_name', 500).catch(() => []),
      base44.entities.AppSetting.filter({ key: SETTING_KEY }).catch(() => []),
    ]).then(([suppliers, settings]) => {
      setApprovedSuppliers(suppliers);
      const setting = settings[0];
      if (setting) {
        setManualSettingId(setting.id);
        try {
          const parsed = JSON.parse(setting.value || '[]');
          setManualSuppliers(Array.isArray(parsed) ? parsed : []);
        } catch { setManualSuppliers([]); }
      }
    });
  }, []);

  // Sync display text from parent value
  useEffect(() => { setQuery(value || ''); }, [value]);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const trimmedQuery = query.trim().toLowerCase();
  const filteredApproved = approvedSuppliers.filter(s =>
    !trimmedQuery || s.supplier_name?.toLowerCase().includes(trimmedQuery)
  );
  const approvedNames = new Set(approvedSuppliers.map(s => s.supplier_name?.toLowerCase()));
  const filteredManual = manualSuppliers.filter(name =>
    !approvedNames.has(name.toLowerCase()) &&
    (!trimmedQuery || name.toLowerCase().includes(trimmedQuery))
  );
  const allKnown = [
    ...approvedSuppliers.map(s => s.supplier_name?.toLowerCase()),
    ...manualSuppliers.map(n => n.toLowerCase()),
  ];
  const showAddNew = trimmedQuery && !allKnown.includes(trimmedQuery);

  async function saveManualSupplier(name) {
    const normalized = name.trim();
    if (!normalized) return;
    const lower = normalized.toLowerCase();
    if (manualSuppliers.some(n => n.toLowerCase() === lower)) return;
    if (approvedSuppliers.some(s => s.supplier_name?.toLowerCase() === lower)) return;
    setSaving(true);
    const updated = [...manualSuppliers, normalized];
    const jsonValue = JSON.stringify(updated);
    if (manualSettingId) {
      await base44.entities.AppSetting.update(manualSettingId, { value: jsonValue }).catch(() => {});
    } else {
      const rec = await base44.entities.AppSetting.create({ key: SETTING_KEY, value: jsonValue, description: 'Manual supplier names used in GRN (store module)' }).catch(() => null);
      if (rec) setManualSettingId(rec.id);
    }
    setManualSuppliers(updated);
    setSaving(false);
  }

  function handleSelect(name) {
    setQuery(name);
    setOpen(false);
    onChange(name);
  }

  async function handleAddNew() {
    const name = query.trim();
    if (!name) return;
    await saveManualSupplier(name);
    setOpen(false);
    onChange(name);
  }

  const hasResults = filteredApproved.length > 0 || filteredManual.length > 0 || showAddNew;

  return (
    <div className="relative" ref={ref}>
      <label className="text-xs font-medium text-slate-700">
        Supplier Name <span className="text-red-500">*</span>
      </label>
      <div className="relative mt-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          className="w-full h-11 pl-8 pr-8 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
          placeholder="Type supplier name or select..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
      </div>
      <p className="text-xs text-slate-400 mt-0.5">Type to search approved suppliers or enter a new name</p>

      {open && createPortal(
        <div style={{ position: 'fixed', zIndex: 99999, top: (ref.current?.getBoundingClientRect().bottom || 0) + 4, left: ref.current?.getBoundingClientRect().left || 0, width: ref.current?.getBoundingClientRect().width || 300 }} className="bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {filteredApproved.length > 0 && (
            <>
              <div className="px-3 py-1.5 bg-teal-50 text-xs font-semibold text-teal-700 sticky top-0">Approved Suppliers</div>
              {filteredApproved.map(s => (
                <div key={s.id} className="px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50" onClick={() => handleSelect(s.supplier_name)}>
                  <p className="font-medium text-slate-800">{s.supplier_name}</p>
                  <p className="text-xs text-slate-400">{s.supplier_id} · {s.gstin || 'No GSTIN'}</p>
                </div>
              ))}
            </>
          )}
          {filteredManual.length > 0 && (
            <>
              <div className="px-3 py-1.5 bg-slate-100 text-xs font-semibold text-slate-500 sticky top-0">Recently Used</div>
              {filteredManual.map(name => (
                <div key={name} className="px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 text-slate-700" onClick={() => handleSelect(name)}>{name}</div>
              ))}
            </>
          )}
          {showAddNew && (
            <div className="px-4 py-2.5 text-sm cursor-pointer hover:bg-blue-50 flex items-center gap-2 text-blue-600 font-medium border-t border-slate-100" onClick={handleAddNew}>
              <Plus className="w-4 h-4 shrink-0" />
              {saving ? 'Saving...' : `Add "${query.trim()}" as new supplier`}
            </div>
          )}
          {!hasResults && (
            <div className="px-4 py-3 text-sm text-slate-400 text-center">
              {trimmedQuery ? 'No matches — type to add as new supplier' : 'Type to search or enter supplier name'}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}