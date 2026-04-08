import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, ChevronDown } from 'lucide-react';

export default function GRNSupplierSelect({ value, onChange, itemNames = [] }) {
  const [suppliers, setSuppliers] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    Promise.all([
      base44.entities.Supplier.filter({ approval_status: 'APPROVED' }, 'supplier_name', 500),
      base44.entities.SupplierItemMapping.filter({ is_active: true }, '-created_date', 1000),
    ]).then(([sup, maps]) => {
      setSuppliers(sup);
      setMappings(maps);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Filter suppliers based on item mappings if items are selected
  const relevantSupplierIds = new Set();
  if (itemNames.length > 0) {
    const normalizedNames = itemNames.map(n => n?.trim().toLowerCase()).filter(Boolean);
    mappings.forEach(m => {
      if (normalizedNames.some(n => m.item_name?.toLowerCase().includes(n))) {
        relevantSupplierIds.add(m.supplier_id);
      }
    });
  }

  const filteredSuppliers = suppliers.filter(s => {
    const matchesQuery = !query.trim() || s.supplier_name?.toLowerCase().includes(query.toLowerCase());
    // If items selected and mappings exist, filter by relevant suppliers
    if (itemNames.length > 0 && relevantSupplierIds.size > 0) {
      return matchesQuery && relevantSupplierIds.has(s.supplier_id);
    }
    return matchesQuery;
  });

  const allMatchingSuppliers = suppliers.filter(s =>
    !query.trim() || s.supplier_name?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <label className="text-xs font-medium text-slate-700">Supplier Name</label>
      <div className="relative mt-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          className="w-full h-11 pl-8 pr-8 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
          placeholder="Search or select supplier..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
      </div>
      {open && (
        <div className="absolute z-[9999] top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {/* Relevant suppliers section */}
          {filteredSuppliers.length > 0 && itemNames.length > 0 && relevantSupplierIds.size > 0 && (
            <>
              <div className="px-3 py-1.5 bg-teal-50 text-xs font-semibold text-teal-700 sticky top-0">
                Mapped to Selected Items
              </div>
              {filteredSuppliers.map(s => (
                <div
                  key={s.id}
                  className="px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50"
                  onClick={() => {
                    setQuery(s.supplier_name);
                    setOpen(false);
                    onChange({ supplier_id: s.supplier_id, supplier_name: s.supplier_name });
                  }}
                >
                  <p className="font-medium text-slate-800">{s.supplier_name}</p>
                  <p className="text-xs text-slate-400">{s.supplier_id} · {s.gstin || 'No GSTIN'}</p>
                </div>
              ))}
            </>
          )}

          {/* All suppliers section (if mapping filter leaves some out) */}
          {itemNames.length > 0 && relevantSupplierIds.size > 0 && allMatchingSuppliers.length > filteredSuppliers.length && (
            <>
              <div className="px-3 py-1.5 bg-slate-100 text-xs font-semibold text-slate-500 sticky top-0">
                Other Suppliers
              </div>
              {allMatchingSuppliers
                .filter(s => !relevantSupplierIds.has(s.supplier_id))
                .map(s => (
                  <div
                    key={s.id}
                    className="px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 opacity-70"
                    onClick={() => {
                      setQuery(s.supplier_name);
                      setOpen(false);
                      onChange({ supplier_id: s.supplier_id, supplier_name: s.supplier_name });
                    }}
                  >
                    <p className="font-medium text-slate-800">{s.supplier_name}</p>
                    <p className="text-xs text-slate-400">{s.supplier_id}</p>
                  </div>
                ))}
            </>
          )}

          {/* No mappings — show all */}
          {(itemNames.length === 0 || relevantSupplierIds.size === 0) && allMatchingSuppliers.map(s => (
            <div
              key={s.id}
              className="px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50"
              onClick={() => {
                setQuery(s.supplier_name);
                setOpen(false);
                onChange({ supplier_id: s.supplier_id, supplier_name: s.supplier_name });
              }}
            >
              <p className="font-medium text-slate-800">{s.supplier_name}</p>
              <p className="text-xs text-slate-400">{s.supplier_id} · {s.gstin || 'No GSTIN'}</p>
            </div>
          ))}

          {allMatchingSuppliers.length === 0 && (
            <div className="px-4 py-3 text-sm text-slate-400 text-center">No suppliers found</div>
          )}
        </div>
      )}
    </div>
  );
}