import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Search, Pencil, Check, X, Package } from 'lucide-react';

const EDITABLE_COLUMNS = [
  { key: 'item_code', label: 'Item Code', type: 'text', readOnly: true },
  { key: 'product_name', label: 'Product Name', type: 'text' },
  { key: 'brand_name', label: 'Brand', type: 'text' },
  { key: 'product_family', label: 'Product Family', type: 'text' },
  { key: 'flavour', label: 'Flavour', type: 'text' },
  { key: 'bottle_type', label: 'Container Type', type: 'text' },
  { key: 'ml_per_bottle', label: 'Volume (ml)', type: 'number' },
  { key: 'bottles_per_box', label: 'Units per Box', type: 'number' },
  { key: 'mrp', label: 'MRP (₹)', type: 'number' },
  { key: 'mrp_box', label: 'Box MRP (₹)', type: 'number' },
  { key: 'gross_weight_kg', label: 'Gross Weight (kg)', type: 'number' },
  { key: 'hsn_code', label: 'HSN Code', type: 'text' },
  { key: 'product_barcode', label: 'Product Barcode', type: 'text' },
  { key: 'box_barcode', label: 'Box Barcode', type: 'text' },
  { key: 'shelf_life_days', label: 'Shelf Life (days)', type: 'number' },
  { key: 'fssai_no', label: 'FSSAI No.', type: 'text' },
  { key: 'manufacturer_name', label: 'Manufacturer', type: 'text' },
  { key: 'swiggy_item_id', label: 'Swiggy Item ID', type: 'text' },
  { key: 'bigbasket_item_id', label: 'BigBasket Item ID', type: 'text' },
  { key: 'zepto_item_id', label: 'Zepto Item ID', type: 'text' },
  { key: 'amazon_item_id', label: 'Amazon Item ID', type: 'text' },
  { key: 'is_active', label: 'Status', type: 'boolean' },
  { key: 'is_trial_pack', label: 'Trial Pack', type: 'boolean' },
  { key: '_current_stock', label: 'Current Stock', type: 'stock', readOnly: true },
];

function StockBadge({ qty }) {
  if (!qty) return <span className="text-slate-400 text-xs">0</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{Number(qty).toLocaleString('en-IN')}</span>;
}

function EditableCell({ value, type, readOnly, onChange }) {
  if (readOnly) {
    return <span className="font-mono text-xs text-slate-700">{value ?? '—'}</span>;
  }
  if (type === 'boolean') {
    return (
      <button
        onClick={() => onChange(!value)}
        className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
          value ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {value ? 'Active' : 'Inactive'}
      </button>
    );
  }
  return (
    <Input
      type={type === 'number' ? 'number' : 'text'}
      value={value ?? ''}
      onChange={e => onChange(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
      className="h-7 text-xs border-slate-200 min-w-[80px]"
    />
  );
}

export default function SKUManagementTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);

  const { data: stockBalances = [] } = useQuery({
    queryKey: ['store_stock_balance_all'],
    queryFn: () => base44.entities.StoreStockBalance.list('-updated_date', 2000),
    staleTime: 60000,
  });

  const stockByItemCode = useMemo(() => {
    const map = {};
    stockBalances.forEach(b => {
      if (b.item_code) map[b.item_code] = (map[b.item_code] || 0) + (b.quantity || 0);
    });
    return map;
  }, [stockBalances]);

  const { data: skus = [], isLoading } = useQuery({
    queryKey: ['product_master_all'],
    queryFn: () => base44.entities.ProductMaster.list('product_name', 500),
    staleTime: 30000,
  });

  const filtered = skus.filter(s => {
    const matchesSearch = !search ||
      s.item_code?.toLowerCase().includes(search.toLowerCase()) ||
      s.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.brand_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.flavour?.toLowerCase().includes(search.toLowerCase());
    const matchesActive = filterActive === 'all' ||
      (filterActive === 'active' && s.is_active) ||
      (filterActive === 'inactive' && !s.is_active);
    return matchesSearch && matchesActive;
  });

  function startEdit(sku) {
    setEditingId(sku.id);
    setEditData({ ...sku });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditData({});
  }

  async function saveEdit() {
    setSaving(true);
    await base44.entities.ProductMaster.update(editingId, editData);
    qc.invalidateQueries(['product_master_all']);
    toast({ title: 'Product updated', description: `${editData.product_name} saved successfully.` });
    setEditingId(null);
    setEditData({});
    setSaving(false);
  }

  function updateField(key, val) {
    setEditData(d => ({ ...d, [key]: val }));
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by Item Code, name, brand..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <select
          value={filterActive}
          onChange={e => setFilterActive(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All Products</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
        <span className="text-xs text-slate-500">{filtered.length} products</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Loading products...</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No products found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs font-medium">
                {EDITABLE_COLUMNS.map(col => (
                  <th key={col.key} className="px-3 py-2.5 text-left whitespace-nowrap">{col.label}</th>
                ))}
                <th className="px-3 py-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(sku => {
                const isEditing = editingId === sku.id;
                const row = isEditing ? editData : sku;
                return (
                  <tr key={sku.id} className={`hover:bg-slate-50 transition-colors ${isEditing ? 'bg-blue-50' : ''}`}>
                    {EDITABLE_COLUMNS.map(col => (
                      <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                        {col.key === '_current_stock' ? (
                          <StockBadge qty={stockByItemCode[sku.item_code] || 0} />
                        ) : isEditing ? (
                          <EditableCell
                            value={row[col.key]}
                            type={col.type}
                            readOnly={col.readOnly}
                            onChange={val => updateField(col.key, val)}
                          />
                        ) : col.type === 'boolean' ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            row[col.key] ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {col.key === 'is_active' ? (row[col.key] ? 'Active' : 'Inactive') : (row[col.key] ? 'Yes' : 'No')}
                          </span>
                        ) : (
                          <span className={col.key === 'item_code' ? 'font-mono text-xs text-slate-700' : 'text-slate-700'}>
                            {row[col.key] != null && row[col.key] !== '' ? String(row[col.key]) : '—'}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <Button size="sm" className="h-7 px-2 bg-green-700 hover:bg-green-800 text-white text-xs" onClick={saveEdit} disabled={saving}>
                            <Check className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={cancelEdit} disabled={saving}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-slate-500 hover:text-slate-900" onClick={() => startEdit(sku)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}