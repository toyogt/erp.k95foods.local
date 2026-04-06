import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Pencil, Trash2, Search, PackageOpen, ImageIcon } from 'lucide-react';
import MaterialPhotoUpload from '@/components/store/MaterialPhotoUpload';
import { SweetAlertModal } from '@/components/store/SweetAlert';

const CATEGORIES = [
  { value: 'ingredient', label: 'Ingredient' },
  { value: 'box_type', label: 'Box Type' },
  { value: 'cap_type', label: 'Cap Type' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'other', label: 'Other' },
];

const EMPTY_FORM = {
  item_name: '', item_category: 'other', uom: 'Nos',
  material_photo: '',
  batch_required: false, expiry_required: false,
  mfg_date_required: false, qc_required: false,
  min_shelf_life_days: '', storage_notes: '', is_active: true,
};

function ItemFormModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState(item ? { ...item } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  function setField(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  async function handleSave() {
    if (!form.item_name?.trim()) {
      toast({ title: 'Item name is required', variant: 'destructive' });
      return;
    }
    if (!form.material_photo) {
      toast({ title: 'Material photo is mandatory. Please upload a photo.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const data = {
        ...form,
        item_name: form.item_name.trim(),
        min_shelf_life_days: form.min_shelf_life_days !== '' ? Number(form.min_shelf_life_days) : undefined,
      };
      if (item?.id) {
        await base44.entities.StoreItemMaster.update(item.id, data);
        toast({ title: 'Item updated successfully' });
      } else {
        await base44.entities.StoreItemMaster.create(data);
        toast({ title: 'Item created successfully' });
      }
      setSaving(false);
      onSaved();
    } catch (err) {
      toast({ title: 'Failed to save item', variant: 'destructive' });
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
            required
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
              <Input className="h-9 text-sm mt-1" value={form.uom} onChange={e => setField('uom', e.target.value)} placeholder="Nos, Kg, Ltr..." />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">Minimum Shelf Life (days)</label>
            <Input className="h-9 text-sm mt-1" type="number" min="0" value={form.min_shelf_life_days} onChange={e => setField('min_shelf_life_days', e.target.value)} placeholder="0" />
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
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    await base44.entities.StoreItemMaster.list('-created_date', 200).then(data => {
      setItems(data);
      setLoading(false);
    }).catch(err => {
      toast({ title: 'Failed to load items', variant: 'destructive' });
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, []);

  const [alertConfig, setAlertConfig] = useState(null);
  const [pendingDeleteItem, setPendingDeleteItem] = useState(null);

  async function handleDelete(item) {
    setPendingDeleteItem(item);
    setAlertConfig({
      open: true,
      type: 'warning',
      title: 'Delete Item?',
      message: `Are you sure you want to delete "${item.item_name}"? This cannot be undone.`,
      showCancel: true,
      confirmText: 'Delete',
      onConfirm: async () => {
        setAlertConfig(null);
        try {
          await base44.entities.StoreItemMaster.delete(item.id);
          toast({ title: 'Item deleted successfully' });
          load();
        } catch (err) {
          setAlertConfig({ open: true, type: 'error', title: 'Delete Failed', message: 'Could not delete this item. It may be referenced elsewhere.' });
        }
        setPendingDeleteItem(null);
      },
      onClose: () => { setAlertConfig(null); setPendingDeleteItem(null); },
    });
  }

  const filtered = items.filter(i =>
    i.item_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.item_category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <div className="max-w-5xl mx-auto space-y-4 px-3 md:px-4 lg:px-6 py-6">
      {alertConfig && (
        <SweetAlertModal
          open={alertConfig.open}
          type={alertConfig.type}
          title={alertConfig.title}
          message={alertConfig.message}
          showCancel={alertConfig.showCancel}
          confirmText={alertConfig.confirmText}
          onConfirm={alertConfig.onConfirm}
          onClose={alertConfig.onClose || (() => setAlertConfig(null))}
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
        <Button onClick={() => setModal('new')} className="h-11 gap-2 bg-slate-900 text-sm whitespace-nowrap">
          <Plus className="w-4 h-4" /> Add Item
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input className="pl-9 h-9" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} />
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
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell capitalize">{item.item_category?.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{item.uom || 'Nos'}</td>
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