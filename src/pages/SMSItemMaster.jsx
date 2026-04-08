import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Search, PackageOpen, ImageIcon, Download, AlertTriangle, Eye, X } from 'lucide-react';
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

function ItemViewModal({ item, onClose, onSaved }) {
  const [openingStock, setOpeningStock] = useState(item?.opening_stock ?? 0);
  const [saving, setSaving] = useState(false);
  const isSystem = !!item?.source_entity;

  async function handleSaveOpeningStock() {
    setSaving(true);
    await base44.entities.StoreItemMaster.update(item.id, { opening_stock: Number(openingStock) || 0 });
    showSuccessToast('Opening stock updated');
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3 md:p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 md:p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-lg">Item Details</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 md:p-5 space-y-3">
          {item.material_photo && (
            <div className="flex justify-center">
              <img src={item.material_photo} alt="" className="w-20 h-20 rounded-xl object-cover border border-slate-200" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <DetailField label="Item Name" value={item.item_name} />
            <DetailField label="Item Code" value={item.item_code || '—'} />
            <DetailField label="Category" value={item.item_category?.replace(/_/g, ' ')} />
            <DetailField label="Unit of Measure" value={item.uom || 'Nos'} />
            {isSystem && <DetailField label="Source" value={item.source_entity} />}
            <DetailField label="Status" value={item.is_active ? 'Active' : 'Inactive'} />
          </div>
          <div className="border border-slate-100 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-600 mb-2">Validation Rules</p>
            <div className="flex flex-wrap gap-2">
              {item.batch_required && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Batch Required</span>}
              {item.expiry_required && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">Expiry Required</span>}
              {item.mfg_date_required && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Manufacture Date Required</span>}
              {!item.batch_required && !item.expiry_required && !item.mfg_date_required && (
                <span className="text-xs text-slate-400">No special validation rules</span>
              )}
            </div>
          </div>
          {item.storage_notes && <DetailField label="Storage Notes" value={item.storage_notes} />}

          {/* Editable Opening Stock */}
          <div className="border border-slate-100 rounded-xl p-4 space-y-2">
            <label className="text-xs font-medium text-slate-700">Opening Stock</label>
            <div className="flex items-center gap-2">
              <Input className="h-9 text-sm flex-1" type="number" min="0" value={openingStock} onChange={e => setOpeningStock(e.target.value)} />
              <span className="text-sm text-slate-500">{item.uom || 'Nos'}</span>
              <Button size="sm" onClick={handleSaveOpeningStock} disabled={saving} className="h-9">
                {saving ? 'Saving…' : 'Update'}
              </Button>
            </div>
            <p className="text-xs text-slate-400">Initial stock quantity for this item</p>
          </div>
        </div>
        <div className="p-4 md:p-5 border-t border-slate-200">
          <Button variant="outline" onClick={onClose} className="w-full h-11 text-sm">Close</Button>
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-900 capitalize mt-0.5">{value || '—'}</p>
    </div>
  );
}

export default function SMSItemMaster() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewItem, setViewItem] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockByItem, setStockByItem] = useState({});
  const [pendingPutawayByItem, setPendingPutawayByItem] = useState({});

  async function load() {
    setLoading(true);
    const [data, balances, lots] = await Promise.all([
      base44.entities.StoreItemMaster.list('-created_date', 200),
      base44.entities.StoreStockBalance.list('-created_date', 1000),
      base44.entities.StoreLot.filter({ status: 'approved' }, '-created_date', 500),
    ]);
    setItems(data);

    // Build current stock from balances (stored stock)
    const sbi = {};
    balances.forEach(b => {
      const code = b.item_code;
      if (code) sbi[code] = (sbi[code] || 0) + (b.quantity || 0);
    });
    setStockByItem(sbi);

    // Build stored quantity by lot
    const storedByLot = {};
    balances.forEach(b => {
      if (b.lot_id) storedByLot[b.lot_id] = (storedByLot[b.lot_id] || 0) + (b.quantity || 0);
    });

    // Blocked / Pending Putaway = approved lots where (lot qty - stored qty) > 0
    const ppbi = {};
    lots.forEach(l => {
      if (l.status !== 'approved') return;
      const stored = storedByLot[l.lot_id] || 0;
      const pending = (l.quantity || 0) - stored;
      if (pending > 0) {
        const code = l.item_code;
        if (code) ppbi[code] = (ppbi[code] || 0) + pending;
      }
    });
    setPendingPutawayByItem(ppbi);

    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = items.filter(i => {
    const matchSearch = i.item_name?.toLowerCase().includes(search.toLowerCase()) ||
      i.item_category?.toLowerCase().includes(search.toLowerCase()) ||
      i.item_code?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'all' || i.item_category === categoryFilter;
    return matchSearch && matchCategory;
  });

  return (
    <motion.div className="pb-12" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <ToastContainer />
      <div className="space-y-4">
      {showImport && (
        <ImportSystemItemsModal
          existingItems={items}
          onClose={() => setShowImport(false)}
          onImported={load}
        />
      )}
      {viewItem && (
        <ItemViewModal
          item={viewItem}
          onClose={() => setViewItem(null)}
          onSaved={() => { setViewItem(null); load(); }}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Store Item Master</h1>
          <p className="text-xs text-slate-500">Central repository of items — import from system masters</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)} className="h-11 gap-2 text-sm whitespace-nowrap">
            <Download className="w-4 h-4" /> Import from System
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
        <div className="bg-white/50 backdrop-blur-xl border border-white/30 rounded-[28px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700 text-xs">
             <tr>
               <th className="text-left px-4 py-3 font-medium">Item Name</th>
               <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Category</th>
               <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Unit</th>
               <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Opening Stock</th>
               <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Current Stock</th>
               <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">Pending Putaway</th>
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
                      const pending = pendingPutawayByItem[code] || 0;
                      return pending > 0 ? (
                        <span className="text-amber-600 font-medium flex items-center gap-1 justify-end">
                          <AlertTriangle className="w-3 h-3" />{pending.toFixed(1)}
                        </span>
                      ) : <span className="text-slate-400">0</span>;
                    })()}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {item.batch_required && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Batch</span>}
                      {item.expiry_required && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">Expiry</span>}
                      {item.mfg_date_required && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Mfg Date</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setViewItem(item)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500" title="View Details">
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 text-xs text-slate-500 font-medium">{filtered.length} item(s)</div>
        </div>
        )}
        </div>
        </motion.div>
        );
        }