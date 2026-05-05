import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Search, PackageOpen, ImageIcon, Download, AlertTriangle, MapPin, X, ChevronDown, CheckSquare, Square } from 'lucide-react';
import TablePagination from '@/components/store/TablePagination';
import MaterialPhotoUpload from '@/components/store/MaterialPhotoUpload';
import ImportSystemItemsModal from '@/components/store/ImportSystemItemsModal';
import { showErrorAlert, showConfirmAlert, showSuccessToast } from '@/lib/toastHelpers';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Swal from 'sweetalert2';

const CATEGORIES = [
  { value: 'ingredient', label: 'Ingredient' },
  { value: 'box_type', label: 'Box Type' },
  { value: 'cap_type', label: 'Cap Type' },
  { value: 'container', label: 'Container / Bottle' },
  { value: 'flavour', label: 'Flavour' },
  { value: 'label_artwork', label: 'Label Artwork' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'other', label: 'Other' },
];

const EMPTY_FORM = {
  item_name: '', item_category: 'other', uom: '',
  material_photo: '',
  batch_required: false, expiry_required: false,
  mfg_date_required: false,
  opening_stock: '',
  storage_notes: '', is_active: true,
};

// Inline location picker for table rows
function InlineLocationPicker({ item, locations, pendingLocations, onLocationChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  const current = pendingLocations[item.id];
  const displayCode = current?.location_code || item.opening_stock_location_code || '';
  const hasLocation = current?.location_id || item.opening_stock_location_id;

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = query.trim()
    ? locations.filter(l =>
        l.location_code?.toLowerCase().includes(query.toLowerCase()) ||
        l.display_name?.toLowerCase().includes(query.toLowerCase())
      )
    : locations;

  function select(loc) {
    onLocationChange(item.id, { location_id: loc.id, location_code: loc.location_code, location_display: loc.display_name });
    setQuery('');
    setOpen(false);
  }

  function clear() {
    onLocationChange(item.id, { location_id: '', location_code: '', location_display: '' });
  }

  return (
    <div className="relative min-w-[160px]" ref={ref}>
      <div className="relative">
        <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
        <input
          className={`w-full h-8 pl-6 pr-6 text-xs border rounded-md focus:outline-none focus:ring-1 ${
            hasLocation
              ? 'border-teal-300 bg-teal-50 text-teal-800 focus:ring-teal-400'
              : 'border-slate-200 bg-white text-slate-600 focus:ring-slate-300'
          }`}
          placeholder="Assign location…"
          value={open ? query : displayCode}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setQuery(''); setOpen(true); }}
        />
        {hasLocation ? (
          <button type="button" onClick={clear} className="absolute right-1.5 top-1/2 -translate-y-1/2">
            <X className="w-3 h-3 text-slate-400 hover:text-red-500" />
          </button>
        ) : (
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
        )}
      </div>
      {open && (
        <div className="absolute z-[9999] top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto min-w-[200px]">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400 text-center">
              {locations.length === 0 ? 'No store locations set up' : 'No matching locations'}
            </div>
          ) : filtered.map(loc => (
            <div
              key={loc.id}
              className={`px-3 py-2 text-xs cursor-pointer hover:bg-slate-50 ${loc.id === (current?.location_id || item.opening_stock_location_id) ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-slate-700'}`}
              onMouseDown={e => e.preventDefault()}
              onClick={() => select(loc)}
            >
              <p className="font-mono font-semibold">{loc.location_code}</p>
              {loc.display_name && <p className="text-slate-400">{loc.display_name}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Edit item modal (no location picker — location is set in table)
function ItemFormModal({ item, onClose, onSaved }) {
  const isEdit = !!item;
  const isSystemItem = !!item?.source_entity;
  const [form, setForm] = useState(item ? { ...item } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [uomOptions, setUomOptions] = useState([]);
  const [uomLoading, setUomLoading] = useState(true);

  useEffect(() => {
    base44.entities.UOMMaster.filter({ is_active: true }, 'uom_name', 200)
      .then(d => { setUomOptions(d); setUomLoading(false); })
      .catch(() => setUomLoading(false));
  }, []);

  function setField(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  async function handleSave() {
    if (!form.item_name?.trim()) {
      showErrorAlert('Validation Error', 'Item name is required');
      return;
    }
    setSaving(true);
    try {
      const openingQty = form.opening_stock !== '' ? Number(form.opening_stock) : 0;
      const data = { ...form, item_name: form.item_name.trim(), opening_stock: openingQty };

      if (item?.id) {
        await base44.entities.StoreItemMaster.update(item.id, data);
        showSuccessToast('Item updated successfully');
      } else {
        const itemCode = form.item_code || `ITEM-${Date.now()}`;
        data.opening_lot_id = '';
        await base44.entities.StoreItemMaster.create(data);
        showSuccessToast('Item created. Assign a location in the table to make stock issuable.');
      }
      setSaving(false);
      onSaved();
    } catch {
      showErrorAlert('Save Failed', 'Failed to save item');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3 md:p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 md:p-5 border-b border-slate-200">
          <h2 className="font-bold text-slate-900 text-lg">{isEdit ? 'Edit Item' : 'New Item'}</h2>
          {isSystemItem && <p className="text-xs text-teal-600 mt-0.5">Imported from system — details are read-only</p>}
        </div>
        <div className="p-4 md:p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-700">Item Name *</label>
            <Input className="h-9 text-sm mt-1" value={form.item_name} onChange={e => setField('item_name', e.target.value)} placeholder="Enter item name" disabled={isSystemItem} />
          </div>
          <MaterialPhotoUpload value={form.material_photo} onChange={v => setField('material_photo', v)} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700">Category</label>
              <select className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1" value={form.item_category} onChange={e => setField('item_category', e.target.value)} disabled={isSystemItem}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Unit of Measure</label>
              <select className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1 h-9 bg-white" value={form.uom} onChange={e => setField('uom', e.target.value)} disabled={isSystemItem}>
                <option value="">Select Unit of Measure</option>
                {uomLoading ? (
                  <option disabled>Loading...</option>
                ) : uomOptions.length === 0 ? (
                  <option disabled>No units found</option>
                ) : (
                  uomOptions.map(u => <option key={u.id} value={u.uom_code}>{u.uom_name} ({u.uom_code})</option>)
                )}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">Opening Stock</label>
            <Input className="h-9 text-sm mt-1" type="number" min="0" value={form.opening_stock} onChange={e => setField('opening_stock', e.target.value)} placeholder="0" />
            <p className="text-xs text-slate-400 mt-0.5">Initial stock quantity. Assign location in table to make it issuable.</p>
          </div>
          <div className="border border-slate-100 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-600 mb-2">Validation Rules</p>
            {[
              { key: 'batch_required', label: 'Batch Number Required' },
              { key: 'expiry_required', label: 'Expiry Date Required' },
              { key: 'mfg_date_required', label: 'Manufacture Date Required' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded" checked={!!form[key]} onChange={e => setField(key, e.target.checked)} />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">Storage Notes</label>
            <textarea rows={2} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1 resize-none" value={form.storage_notes || ''} onChange={e => setField('storage_notes', e.target.value)} placeholder="Optional storage instructions" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded" checked={!!form.is_active} onChange={e => setField('is_active', e.target.checked)} />
            <span className="text-sm text-slate-700">Active</span>
          </label>
        </div>
        <div className="p-4 md:p-5 border-t border-slate-200 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 h-11 text-sm">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 h-11 bg-slate-900 text-sm">{saving ? 'Saving…' : 'Save Item'}</Button>
        </div>
      </div>
    </div>
  );
}

export default function SMSItemMaster() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockByItem, setStockByItem] = useState({});
  const [notStoredByItem, setNotStoredByItem] = useState({});
  const [locations, setLocations] = useState([]);

  // Pending location changes: { [itemId]: { location_id, location_code, location_display } }
  const [pendingLocations, setPendingLocations] = useState({});
  // Bulk selection: set of item IDs
  const [selected, setSelected] = useState(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  async function load() {
    setLoading(true);
    try {
      const [data, balances, lots, locs] = await Promise.all([
        base44.entities.StoreItemMaster.list('-created_date', 200),
        base44.entities.StoreStockBalance.list('-created_date', 1000),
        base44.entities.StoreLot.list('-created_date', 500),
        base44.entities.StoreLocation.filter({ is_active: true }, 'location_code', 300),
      ]);
      setItems(data);
      setLocations(locs);

      const sbi = {};
      balances.forEach(b => {
        if (b.item_code) sbi[b.item_code] = (sbi[b.item_code] || 0) + (b.quantity || 0);
      });
      setStockByItem(sbi);

      const storedByLot = {};
      balances.forEach(b => {
        if ((b.quantity || 0) > 0) storedByLot[b.lot_id] = (storedByLot[b.lot_id] || 0) + (b.quantity || 0);
      });
      const nsbi = {};
      lots.filter(l => l.status === 'approved').forEach(l => {
        const pending = (l.quantity || 0) - (storedByLot[l.lot_id] || 0);
        if (l.item_code && pending > 0) nsbi[l.item_code] = (nsbi[l.item_code] || 0) + pending;
      });
      setNotStoredByItem(nsbi);
    } catch {
      showErrorAlert('Load Failed', 'Failed to load items');
    }
    setLoading(false);
    setPendingLocations({});
    setSelected(new Set());
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(item) {
    showConfirmAlert(
      'Delete Item?',
      `Are you sure you want to delete "${item.item_name}"? This cannot be undone.`,
      async () => {
        try {
          await base44.entities.StoreItemMaster.delete(item.id);
          showSuccessToast('Item deleted successfully');
          load();
        } catch {
          showErrorAlert('Delete Failed', 'Could not delete this item. It may be referenced elsewhere.');
        }
      }
    );
  }

  function handleLocationChange(itemId, locData) {
    setPendingLocations(prev => ({ ...prev, [itemId]: locData }));
  }

  function toggleSelect(itemId) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(i => i.id)));
    }
  }

  // Assign a location to all selected items at once
  function handleBulkAssignLocation(locData) {
    const updates = {};
    selected.forEach(id => { updates[id] = locData; });
    setPendingLocations(prev => ({ ...prev, ...updates }));
  }

  // Collect items that have pending location changes
  const changedItems = items.filter(item => {
    const pending = pendingLocations[item.id];
    if (!pending) return false;
    const oldId = item.opening_stock_location_id || '';
    return pending.location_id !== oldId;
  });

  async function handleSaveLocations() {
    if (changedItems.length === 0) return;

    // Build summary HTML for SweetAlert
    const rows = changedItems.map(item => {
      const pending = pendingLocations[item.id];
      const oldCode = item.opening_stock_location_code || '(none)';
      const newCode = pending.location_code || '(cleared)';
      return `
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:8px 6px;text-align:left;font-weight:600;color:#0f172a;font-size:13px">${item.item_name}</td>
          <td style="padding:8px 6px;text-align:center;color:#64748b;font-size:12px">${oldCode}</td>
          <td style="padding:8px 6px;text-align:center;color:#0f172a;font-weight:600;font-size:13px">${newCode}</td>
        </tr>`;
    }).join('');

    const result = await Swal.fire({
      title: 'Confirm Location Changes',
      html: `
        <p style="color:#64748b;font-size:13px;margin-bottom:12px">
          You are about to update the opening stock location for <strong>${changedItems.length}</strong> item(s):
        </p>
        <div style="max-height:280px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#f8fafc">
                <th style="padding:8px 6px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600">ITEM</th>
                <th style="padding:8px 6px;text-align:center;font-size:11px;color:#94a3b8;font-weight:600">CURRENT</th>
                <th style="padding:8px 6px;text-align:center;font-size:11px;color:#94a3b8;font-weight:600">NEW LOCATION</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <p style="color:#0d9488;font-size:12px;margin-top:10px">
          Stock with new locations will be immediately available for issue.
        </p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Save Changes',
      cancelButtonText: 'Go Back',
      confirmButtonColor: '#0f172a',
      cancelButtonColor: '#64748b',
      width: 560,
    });

    if (!result.isConfirmed) return;

    setBulkSaving(true);
    try {
      await Promise.all(
        changedItems.map(async item => {
          const pending = pendingLocations[item.id];
          const openingQty = item.opening_stock || 0;
          const hasNewLocation = !!pending.location_id;
          const hadLocation = !!item.opening_stock_location_id;

          // Update item master with new location
          await base44.entities.StoreItemMaster.update(item.id, {
            opening_stock_location_id: pending.location_id,
            opening_stock_location_code: pending.location_code,
          });

          // If item has opening stock and is getting a location for first time → create lot + balance
          if (openingQty > 0 && hasNewLocation && !hadLocation && !item.opening_lot_id) {
            const itemCode = item.item_code || item.item_name;
            const openingLotId = `LOT-OPEN-${itemCode}-${Date.now().toString(36).toUpperCase()}`;
            await base44.entities.StoreLot.create({
              lot_id: openingLotId,
              qr_code: openingLotId,
              item_code: itemCode,
              item_name: item.item_name,
              uom: item.uom || 'Nos',
              original_quantity: openingQty,
              quantity: openingQty,
              remaining_quantity: openingQty,
              mismatch_type: 'none',
              supplier_name: 'Opening Stock',
              status: 'putaway',
              notes: 'Auto-created from opening stock location assignment',
            });
            await base44.entities.StoreStockBalance.create({
              location_id: pending.location_id,
              location_code: pending.location_code,
              lot_id: openingLotId,
              item_code: itemCode,
              item_name: item.item_name,
              uom: item.uom || 'Nos',
              quantity: openingQty,
              putaway_date: new Date().toISOString(),
              putaway_by: 'system/opening-stock',
            });
            await base44.entities.StoreItemMaster.update(item.id, { opening_lot_id: openingLotId });
          }
        })
      );
      showSuccessToast(`${changedItems.length} item(s) updated successfully`);
      load();
    } catch {
      showErrorAlert('Save Failed', 'Some updates could not be saved. Please try again.');
      setBulkSaving(false);
    }
  }

  const filtered = items.filter(i => {
    const matchSearch = i.item_name?.toLowerCase().includes(search.toLowerCase()) ||
      i.item_category?.toLowerCase().includes(search.toLowerCase()) ||
      i.item_code?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'all' || i.item_category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const allSelected = filtered.length > 0 && selected.size === filtered.length;
  const someSelected = selected.size > 0;

  return (
    <motion.div className="pb-12" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <ToastContainer />
      <div className="space-y-4">
        {showImport && (
          <ImportSystemItemsModal existingItems={items} onClose={() => setShowImport(false)} onImported={load} />
        )}
        {modal && (
          <ItemFormModal
            item={modal === 'new' ? null : modal}
            onClose={() => setModal(null)}
            onSaved={() => { setModal(null); load(); }}
          />
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Store Item Master</h1>
            <p className="text-xs text-slate-500">Central repository of items with validation rules</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {changedItems.length > 0 && (
              <Button
                onClick={handleSaveLocations}
                disabled={bulkSaving}
                className="h-11 gap-2 text-sm bg-teal-700 hover:bg-teal-800 text-white"
              >
                <MapPin className="w-4 h-4" />
                {bulkSaving ? 'Saving…' : `Save ${changedItems.length} Location Change${changedItems.length > 1 ? 's' : ''}`}
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowImport(true)} className="h-11 gap-2 text-sm whitespace-nowrap">
              <Download className="w-4 h-4" /> Import from System
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input className="pl-9 h-9" placeholder="Search items…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select
            className="h-9 border border-slate-200 rounded-md px-3 text-sm bg-white"
            value={categoryFilter}
            onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {/* Bulk action bar */}
        {someSelected && (
          <div className="flex items-center gap-3 bg-slate-900 text-white rounded-xl px-4 py-2.5">
            <span className="text-sm font-medium">{selected.size} item(s) selected</span>
            <span className="text-slate-500 text-sm">— Assign location to all:</span>
            <div className="flex-1 max-w-xs">
              <BulkLocationPicker
                locations={locations}
                onAssign={handleBulkAssignLocation}
              />
            </div>
            <button onClick={() => setSelected(new Set())} className="text-slate-400 hover:text-white ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <PackageOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-slate-400">No items found.</p>
          </div>
        ) : (
          <div className="bg-white/50 backdrop-blur-xl border border-white/30 rounded-[28px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-700 text-xs">
                  <tr>
                    <th className="px-3 py-3">
                      <button onClick={toggleSelectAll} className="flex items-center justify-center">
                        {allSelected
                          ? <CheckSquare className="w-4 h-4 text-slate-700" />
                          : <Square className="w-4 h-4 text-slate-400" />
                        }
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 font-medium">Item Name</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Category</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Unit</th>
                    <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Opening Stock</th>
                    <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Current Stock</th>
                    <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">Pending Putaway</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Rules</th>
                    <th className="text-left px-4 py-3 font-medium">Opening Location</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.map(item => {
                    const isSelected = selected.has(item.id);
                    const hasPending = !!pendingLocations[item.id] && pendingLocations[item.id].location_id !== (item.opening_stock_location_id || '');
                    return (
                      <tr key={item.id} className={`hover:bg-slate-50 ${isSelected ? 'bg-blue-50/60' : ''} ${hasPending ? 'border-l-2 border-teal-400' : ''}`}>
                        <td className="px-3 py-3">
                          <button onClick={() => toggleSelect(item.id)} className="flex items-center justify-center">
                            {isSelected
                              ? <CheckSquare className="w-4 h-4 text-slate-700" />
                              : <Square className="w-4 h-4 text-slate-300" />
                            }
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {item.material_photo ? (
                              <img src={item.material_photo} alt="" className="w-8 h-8 rounded object-cover border border-slate-200" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center">
                                <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                              </div>
                            )}
                            <div>
                              <span className="font-medium text-slate-900">{item.item_name}</span>
                              {hasPending && (
                                <span className="ml-1.5 text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">Unsaved</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="capitalize text-slate-600">{item.item_category?.replace(/_/g, ' ')}</span>
                          {item.source_entity && (
                            <span className="ml-1.5 text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">System</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{item.uom || 'Nos'}</td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">
                          <span className="text-slate-600">{item.opening_stock || 0}</span>
                        </td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">
                          {(() => {
                            const code = item.item_code || item.item_name;
                            const stored = stockByItem[code] || 0;
                            return (
                              <span className={`font-bold ${stored > 0 ? 'text-green-700' : 'text-slate-400'}`}>
                                {stored.toFixed(1)}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell">
                          {(() => {
                            const code = item.item_code || item.item_name;
                            const blocked = notStoredByItem[code] || 0;
                            return blocked > 0 ? (
                              <span className="text-amber-600 font-medium flex items-center gap-1 justify-end">
                                <AlertTriangle className="w-3 h-3" />{blocked.toFixed(1)}
                              </span>
                            ) : <span className="text-slate-400">0</span>;
                          })()}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {item.batch_required && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Batch</span>}
                            {item.expiry_required && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">Expiry</span>}
                            {item.mfg_date_required && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Mfg Date</span>}
                            {item.qc_required && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">Quality Control</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <InlineLocationPicker
                            item={item}
                            locations={locations}
                            pendingLocations={pendingLocations}
                            onLocationChange={handleLocationChange}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {item.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => setModal(item)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(item)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Bulk location picker for the action bar
function BulkLocationPicker({ locations, onAssign }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = query.trim()
    ? locations.filter(l =>
        l.location_code?.toLowerCase().includes(query.toLowerCase()) ||
        l.display_name?.toLowerCase().includes(query.toLowerCase())
      )
    : locations;

  function select(loc) {
    onAssign({ location_id: loc.id, location_code: loc.location_code, location_display: loc.display_name });
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
        <input
          className="w-full h-8 pl-6 pr-2 text-xs border border-slate-600 rounded-md bg-slate-800 text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
          placeholder="Select location for all selected…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-[9999] top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto min-w-[220px]">
          {filtered.map(loc => (
            <div
              key={loc.id}
              className="px-3 py-2 text-xs cursor-pointer hover:bg-slate-50 text-slate-700"
              onMouseDown={e => e.preventDefault()}
              onClick={() => select(loc)}
            >
              <p className="font-mono font-semibold">{loc.location_code}</p>
              {loc.display_name && <p className="text-slate-400">{loc.display_name}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}