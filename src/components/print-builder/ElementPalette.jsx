/**
 * ElementPalette
 * Shows all available ERP fields grouped by category.
 * Click a field to add it onto the canvas.
 */
import { useState } from 'react';
import { Plus, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';

const FIELD_GROUPS = [
  {
    group: 'Batch & Dates',
    fields: [
      { key: 'batch_no',           label: 'Batch Number',              type: 'text' },
      { key: 'mfg_date',           label: 'Manufacturing Date',        type: 'text' },
      { key: 'expiry_date',        label: 'Expiry / Use By Date',      type: 'text' },
      { key: 'shelf_life',         label: 'Shelf Life',                type: 'text' },
      { key: 'labelling_date',     label: 'Labelling Date',            type: 'text' },
    ],
  },
  {
    group: 'Pricing',
    fields: [
      { key: 'mrp',                label: 'MRP (Price)',               type: 'text' },
      { key: 'mrp_with_usp',       label: 'MRP with USP',             type: 'text' },
      { key: 'usp',                label: 'USP (Cost per ml)',         type: 'text' },
      { key: 'usp_with_unit',      label: 'USP with Unit',            type: 'text' },
      { key: 'tax_line',           label: 'Incl. of all taxes',       type: 'text' },
    ],
  },
  {
    group: 'Product',
    fields: [
      { key: 'product_name',       label: 'Product Name',              type: 'text' },
      { key: 'brand_name',         label: 'Brand Name',                type: 'text' },
      { key: 'flavour',            label: 'Flavour',                   type: 'text' },
      { key: 'bottle_type',        label: 'Bottle Type',               type: 'text' },
      { key: 'sku_code',           label: 'Product Code',              type: 'text' },
      { key: 'net_weight',         label: 'Net Weight',                type: 'text' },
      { key: 'ml_per_bottle',      label: 'Volume per Bottle (ml)',    type: 'text' },
      { key: 'bottles_per_box',    label: 'Bottles per Box',           type: 'text' },
    ],
  },
  {
    group: 'Regulatory',
    fields: [
      { key: 'fssai_no',           label: 'FSSAI Number',              type: 'text' },
      { key: 'hsn_code',           label: 'HSN Code',                  type: 'text' },
      { key: 'manufacturer_name',  label: 'Manufacturer Name',         type: 'text' },
      { key: 'manufacturer_address', label: 'Manufacturer Address',    type: 'text' },
      { key: 'customer_care_phone',label: 'Customer Care Phone',       type: 'text' },
      { key: 'customer_care_email',label: 'Customer Care Email',       type: 'text' },
    ],
  },
  {
    group: 'Barcodes & QR',
    fields: [
      { key: 'product_barcode',    label: 'Product Barcode',           type: 'barcode' },
      { key: 'box_barcode',        label: 'Box Barcode',               type: 'barcode' },
      { key: 'batch_no_qr',        label: 'Batch Number (QR Code)',    type: 'qr' },
    ],
  },
  {
    group: 'Free Text',
    fields: [
      { key: '__static__',         label: 'Static Text Block',         type: 'static' },
      { key: '__divider__',        label: 'Horizontal Divider',        type: 'divider' },
      { key: '__box__',            label: 'Box / Border',              type: 'box' },
    ],
  },
];

export default function ElementPalette({ onAdd }) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState({});

  const toggle = (g) => setCollapsed(prev => ({ ...prev, [g]: !prev[g] }));

  const filtered = search
    ? FIELD_GROUPS.map(g => ({
        ...g,
        fields: g.fields.filter(f =>
          f.label.toLowerCase().includes(search.toLowerCase()) ||
          f.key.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(g => g.fields.length > 0)
    : FIELD_GROUPS;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-2">
          <Plus className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Add Element</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search fields..."
            className="h-8 text-sm pl-8"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
        {filtered.map(g => (
          <div key={g.group}>
            <button
              onClick={() => toggle(g.group)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded"
            >
              <span>{g.group}</span>
              {collapsed[g.group]
                ? <ChevronRight className="w-3 h-3" />
                : <ChevronDown className="w-3 h-3" />
              }
            </button>
            {!collapsed[g.group] && (
              <div className="space-y-0.5 ml-1">
                {g.fields.map(f => (
                  <button
                    key={f.key}
                    onClick={() => onAdd(f)}
                    className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-purple-50 hover:text-purple-700 text-slate-700 flex items-center gap-2 group transition-colors"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-purple-400 shrink-0" />
                    <span className="truncate">{f.label}</span>
                    <Plus className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}