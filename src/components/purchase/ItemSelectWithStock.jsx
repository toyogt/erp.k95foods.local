import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, Plus, X, Package, AlertTriangle } from 'lucide-react';

const MODES = { search: 'search', selected: 'selected', manual: 'manual' };

export default function ItemSelectWithStock({ ingredients, value, onSelect, onManualEntry }) {
  const [query, setQuery] = useState(value?.item_name || '');
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(value?.item_code ? MODES.selected : MODES.search);
  const [stockInfo, setStockInfo] = useState(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (value?.item_name && !query) setQuery(value.item_name);
  }, [value?.item_name]);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function loadStock(itemCode) {
    if (!itemCode) return;
    setLoadingStock(true);
    try {
      const [balances, lots] = await Promise.all([
        base44.entities.StoreStockBalance.filter({ item_code: itemCode }, '-quantity', 20).catch(() => []),
        base44.entities.StoreLot.filter({ item_code: itemCode, status: 'active' }, 'expiry_date', 20).catch(() => []),
      ]);
      setStockInfo({ balances, lots });
    } catch { setStockInfo(null); }
    setLoadingStock(false);
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? ingredients.filter(i => i.item_name?.toLowerCase().includes(q) || i.item_code?.toLowerCase().includes(q)).slice(0, 15)
    : ingredients.slice(0, 15);
  const exactMatch = q && ingredients.some(i => i.item_name?.toLowerCase() === q);

  function handleSelect(ing) {
    onSelect({ item_code: ing.item_code || ing.item_name, item_name: ing.item_name, unit: ing.base_uom || ing.uom || '' });
    setQuery(ing.item_name);
    setMode(MODES.selected);
    setOpen(false);
    loadStock(ing.item_code);
  }

  function handleManual() {
    const name = query.trim();
    if (!name) return;
    onManualEntry({ item_name: name, item_code: '', unit: '' });
    setMode(MODES.manual);
    setOpen(false);
  }

  function handleClear() {
    setQuery('');
    setMode(MODES.search);
    setStockInfo(null);
    onSelect({ item_code: '', item_name: '', unit: '' });
  }

  function getExpiryColor(expiryDate) {
    if (!expiryDate) return 'text-slate-500';
    const days = Math.ceil((new Date(expiryDate) - new Date()) / 86400000);
    if (days < 0) return 'text-red-600';
    if (days < 30) return 'text-orange-600';
    if (days < 90) return 'text-amber-600';
    return 'text-green-600';
  }

  if (mode === MODES.selected || mode === MODES.manual) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 border border-green-200 bg-green-50 rounded-xl px-3 h-11 md:h-9">
          <Package className="w-4 h-4 text-green-600 shrink-0" />
          <span className="text-sm font-medium text-green-800 flex-1 truncate">{query}</span>
          {mode === MODES.manual && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Manual</span>}
          <button onClick={handleClear} className="text-green-500 hover:text-red-500"><X className="w-4 h-4" /></button>
        </div>
        {stockInfo && stockInfo.balances.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 space-y-1">
            <p className="text-xs font-semibold text-blue-700">Current Stock</p>
            {stockInfo.balances.slice(0, 3).map((b, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-blue-600">{b.location_code || 'Main'}</span>
                <span className="font-bold text-blue-800">{b.quantity} {b.uom || ''}</span>
              </div>
            ))}
            {stockInfo.lots.length > 0 && (
              <div className="border-t border-blue-200 pt-1 mt-1">
                <p className="text-xs font-semibold text-blue-600">Active Lots</p>
                {stockInfo.lots.slice(0, 3).map((lot, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-slate-600">{lot.batch_number || 'N/A'}</span>
                    {lot.expiry_date && (
                      <span className={`font-medium ${getExpiryColor(lot.expiry_date)}`}>
                        Exp: {new Date(lot.expiry_date).toLocaleDateString('en-GB')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          className="w-full h-11 md:h-9 pl-8 pr-3 border border-slate-200 rounded-xl text-sm"
          placeholder="Type to search or add new item..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && (
        <div className="absolute z-[9999] top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {filtered.map(ing => (
            <div key={ing.id || ing.item_code} className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-50" onClick={() => handleSelect(ing)}>
              <p className="font-medium text-slate-800">{ing.item_name}</p>
              {ing.item_code && <p className="text-xs text-slate-400">{ing.item_code} · {ing.base_uom || ing.uom || ''}</p>}
            </div>
          ))}
          {q && !exactMatch && (
            <div className="px-3 py-2.5 text-sm cursor-pointer hover:bg-green-50 border-t border-slate-100 flex items-center gap-2 text-green-700 font-medium" onClick={handleManual}>
              <Plus className="w-4 h-4" />
              <span>Add &quot;{query.trim()}&quot; as new item</span>
            </div>
          )}
          {filtered.length === 0 && !q && (
            <div className="px-3 py-3 text-sm text-slate-400 text-center">Start typing to search items</div>
          )}
        </div>
      )}
    </div>
  );
}