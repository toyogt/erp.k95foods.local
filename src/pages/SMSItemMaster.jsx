import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, Search, PackageOpen, ImageIcon, Download, AlertTriangle } from 'lucide-react';
import MaterialPhotoUpload from '@/components/store/MaterialPhotoUpload';
import ImportSystemItemsModal from '@/components/store/ImportSystemItemsModal';
import { showErrorAlert, showConfirmAlert, showSuccessToast } from '@/lib/toastHelpers';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
  mfg_date_required: false, qc_required: false,
  min_shelf_life_days: '', opening_stock: '', reorder_level: '',
  storage_notes: '', is_active: true,
};

function ItemFormModal({ item, onClose, onSaved }) {
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
      const data = {
        ...form,
        item_name: form.item_name.trim(),
        min_shelf_life_days: form.min_shelf_life_days !== '' ? Number(form.min_shelf_life_days) : undefined,
        opening_stock: form.opening_stock !== '' ? Number(form.opening_stock) : 0,
        reorder_level: form.reorder_level !== '' ? Number(form.reorder_level) : 0,
      };
      if (item?.id) {
        await base44.entities.StoreItemMaster.update(item.id, data);
        showSuccessToast('Item updated successfully');
      } else {
        await base44.entities.StoreItemMaster.create(data);
        showSuccessToast('Item created successfully');
      }
      setSaving(false);
      onSaved();
    } catch (err) {
      showErrorAlert('Save Failed', 'Failed to save item');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3 md:p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 md:p-5 border-b border-slate-200">
          <h2 className="font-bold text-slate-900 text-lg">{item ? 'Edit Item' : 'New Item'}</h2>
        </div>
        <div className="p-4 md:p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-700">Item Name *</label>
            <Input className="h-9 text-sm mt-1" value={form.item_name} onChange={e => setField('item_name', e.target.value)} placeholder="Enter item name" />
          </div>
          <MaterialPhotoUpload
            value={form.material_photo}
            onChange={v => setField('material_photo', v)}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700">Category</label>
              <select className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1" value={form.item_category} onChange={e => setField('item_category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Unit of Measure</label>
              <select
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1 h-9 bg-white"
                value={form.uom}
                onChange={e => setField('uom', e.target.value)}
              >
                <option value="">Select Unit of Measure</option>
                {uomLoading ? (
                  <option disabled>Loading...</option>
                ) : uomOptions.length === 0 ? (
                  <option disabled>No units found — add in System → Unit of Measure</option>
                ) : (
                  uomOptions.map(u => (
                    <option key={u.id} value={u.uom_code}>{u.uom_name} ({u.uom_code})</option>
                  ))
                )}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">Minimum Shelf Life (days)</label>
            <Input className="h-9 text-sm mt-1" type="number" min="0" value={form.min_shelf_life_days} onChange={e => setField('min_shelf_life_days', e.target.value)} placeholder="0" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700">Opening Stock</label>
              <Input className="h-9 text-sm mt-1" type="number" min="0" value={form.opening_stock} onChange={e => setField('opening_stock', e.target.value)} placeholder="0" />
              <p className="text-xs text-slate-400 mt-0.5">Initial stock quantity for this item</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Reorder Level</label>
              <Input className="h-9 text-sm mt-1" type="number" min="0" value={form.reorder_level} onChange={e => setField('reorder_level', e.target.value)} placeholder="0" />
              <p className="text-xs text-slate-400 mt-0.5">Alert when stock falls below</p>
            </div>
          </div>
          <div className="border border-slate-100 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-600 mb-2">Validation Rules</p>
            {[
              { key: 'batch_required', label: 'Batch Number Required' },
              { key: 'expiry_required', label: 'Expiry Date Required' },
              { key: 'mfg_date_required', label: 'Manufacture Date Required' },
              { key: 'qc_required', label: 'Quality Control Required' },
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
          <Button variant="outline" onClick={onClose} className="flex-1 h-11 text-sm">{saving ? 'Saving…' : 'Cancel'}</Button>
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
  const [issuedByItem, setIssuedByItem] = useState({});
  const [notStoredByItem, setNotStoredByItem] = useState({});

  async function load() {
    setLoading(true);
    try {
      const [data, balances, issueLines, lots] = await Promise.all([
        base44.entities.StoreItemMaster.list('-created_date', 200),
        base44.entities.StoreStockBalance.list('-created_date', 1000),
        base44.entities.StoreIssueLine.list('-created_date', 2000),
        base44.entities.StoreLot.list('-created_date', 500),
      ]);
      setItems(data);

      // Build current stock from balances (stored stock)
      const sbi = {};
      balances.forEach(b => {
        const code = b.item_code;
        if (code) sbi[code] = (sbi[code] || 0) + (b.quantity || 0);
      });
      setStockByItem(sbi);

      // Build issued from issue lines
      const ibi = {};
      issueLines.forEach(l => {
        const code = l.item_code;
        if (code) ibi[code] = (ibi[code] || 0) + (l.issued_quantity || 0);
      });
      setIssuedByItem(ibi);

      // Build blocked / not-stored: lots that have quantity but no stored balance
      const storedLotIds = new Set(balances.filter(b => (b.quantity || 0) > 0).map(b => b.lot_id));
      const nsbi = {};
      lots.filter(l => !['consumed', 'rejected'].includes(l.status) && !storedLotIds.has(l.lot_id)).forEach(l => {
        const code = l.item_code;
        if (code) nsbi[code] = (nsbi[code] || 0) + (l.remaining_quantity || l.quantity || 0);
      });
      setNotStoredByItem(nsbi);
    } catch {
      showErrorAlert('Load Failed', 'Failed to load items');
    }
    setLoading(false);
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
        } catch (err) {
          showErrorAlert('Delete Failed', 'Could not delete this item. It may be referenced elsewhere.');
        }
      }
    );
  }

  const filtered = items.filter(i => {
    const matchSearch = i.item_name?.toLowerCase().includes(search.toLowerCase()) ||
      i.item_category?.toLowerCase().includes(search.toLowerCase()) ||
      i.item_code?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'all' || i.item_category === categoryFilter;
    return matchSearch && matchCategory;
  });

  return (
    <div className="pb-12">
      <ToastContainer />
      <div className="space-y-4">
      {showImport && (
        <ImportSystemItemsModal
          existingItems={items}
          onClose={() => setShowImport(false)}
          onImported={load}
        />
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)} className="h-11 gap-2 text-sm whitespace-nowrap">
            <Download className="w-4 h-4" /> Import from System
          </Button>
          <Button onClick={() => setModal('new')} className="h-11 gap-2 bg-slate-900 text-sm whitespace-nowrap">
            <Plus className="w-4 h-4" /> Add Item
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input className="pl-9 h-9" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select
          className="h-9 border border-slate-200 rounded-md px-3 text-sm bg-white"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <PackageOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-slate-400">No items found.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
             <tr>
               <th className="text-left px-4 py-3 font-medium">Item Name</th>
               <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Category</th>
               <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Unit</th>
               <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Opening Stock</th>
               <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Current Stock</th>
               <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">Blocked Units</th>
               <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Rules</th>
               <th className="text-left px-4 py-3 font-medium">Status</th>
               <th className="px-4 py-3" />
             </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {item.material_photo ? (
                        <img src={item.material_photo} alt="" className="w-8 h-8 rounded object-cover border border-slate-200" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center">
                          <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      )}
                      <span className="font-medium text-slate-900">{item.item_name}</span>
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
              ))}
            </tbody>
          </table>
        </div>
        )}
        </div>
        </div>
        );
        }