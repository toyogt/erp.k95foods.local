/**
 * PODFieldMappingEditor
 * Lets the user define which shift plan fields map to each POD slot in a Rynan template.
 * Each row = one POD → ERP source binding.
 * Shows a live JSON preview of what gets sent to the printer.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, X, Code2 } from 'lucide-react';

// All possible POD fields in the Rynan middleware
export const POD_FIELDS = [
  'POD1', 'POD2', 'POD3', 'POD4', 'POD5', 'POD6',
  'POD7', 'POD8', 'POD9', 'POD10', 'POD11', 'POD12',
];

// Shift Plan / ERP fields that can be auto-populated
export const ERP_SOURCE_OPTIONS = [
  { value: 'mrp',                label: 'MRP (₹)',                    example: '95.00' },
  { value: 'mrp_with_usp',       label: 'MRP with Unit Sale Price',   example: '₹95.00 (USP: ₹0.29/ml)' },
  { value: 'tax_line',           label: 'Tax Line (fixed)',           example: 'Incl. of all taxes' },
  { value: 'batch_no',           label: 'Batch Number',               example: '01PC46022' },
  { value: 'manufacturing_date', label: 'Manufacturing Date',         example: '01/04/2025' },
  { value: 'expiry_date',        label: 'Expiry / Use By Date',       example: '31/03/2026' },
  { value: 'usp',                label: 'Unit Sale Price (numeric)',   example: '0.29' },
  { value: 'mfg_date_offset',    label: 'Manufacturing Date (−1 day)',example: '31/03/2025' },
  { value: 'expiry_date_offset', label: 'Expiry Date (−1 day)',       example: '30/03/2026' },
  { value: 'net_weight',         label: 'Net Weight / Volume',        example: '330 ml' },
  { value: 'usp_with_unit',      label: 'Unit Sale Price with Unit',  example: '₹0.29/ml' },
  { value: 'mrp_and_usp',        label: 'MRP / Unit Sale Price',      example: '95.00 / 0.29' },
  { value: 'product_name',       label: 'Product Name',               example: 'Toyo Kombucha Exotic Peach...' },
  { value: 'sku_code',           label: 'Product Code',               example: 'TK-EXPE-LS-GLS-330' },
  { value: 'fssai_no',           label: 'FSSAI Number',               example: '10020011008320' },
  { value: 'manufacturer_name',  label: 'Manufacturer Name',          example: 'K95 Beverages Pvt. Ltd.' },
  { value: 'quantity',           label: 'Quantity (bottles)',         example: '1000' },
  { value: 'manual',             label: '— Manual Entry by Operator —', example: '' },
];

const EMPTY_ROW = { pod_field: '', label: '', erp_source: '', is_editable: true };

export default function PODFieldMappingEditor({ value = [], onChange }) {
  const [showJson, setShowJson] = useState(false);

  const addRow = () => onChange([...value, { ...EMPTY_ROW }]);

  const updateRow = (idx, key, val) => {
    const rows = [...value];
    rows[idx] = { ...rows[idx], [key]: val };
    // Auto-fill label from ERP source if label is empty
    if (key === 'erp_source' && !rows[idx].label) {
      const opt = ERP_SOURCE_OPTIONS.find(o => o.value === val);
      if (opt) rows[idx].label = opt.label;
    }
    onChange(rows);
  };

  const removeRow = (idx) => onChange(value.filter((_, i) => i !== idx));

  // Preview JSON that will be sent to the Rynan printer
  const previewJson = value.reduce((acc, row) => {
    if (row.pod_field) {
      const opt = ERP_SOURCE_OPTIONS.find(o => o.value === row.erp_source);
      acc[row.pod_field] = opt?.example || `<${row.erp_source || 'manual'}>`;
    }
    return acc;
  }, {});

  // Already-used POD fields (for preventing duplicates in dropdown)
  const usedPods = new Set(value.map(r => r.pod_field).filter(Boolean));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs font-medium text-slate-700">POD Field Mappings</Label>
          <p className="text-xs text-slate-400 mt-0.5">
            Define which shift plan value goes to each POD slot in the Rynan template
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowJson(v => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showJson ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            {showJson ? 'Hide JSON' : 'Preview JSON'}
          </button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={addRow}>
            <Plus className="w-3.5 h-3.5" /> Add POD
          </Button>
        </div>
      </div>

      {/* Live JSON Preview */}
      {showJson && (
        <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
          <p className="text-xs text-slate-400 mb-2 font-mono">// Payload sent to Rynan printer</p>
          <pre className="text-xs text-green-400 font-mono leading-relaxed">
            {JSON.stringify(previewJson, null, 2)}
          </pre>
        </div>
      )}

      {value.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6 text-center">
          <p className="text-sm text-slate-400">No POD fields configured yet</p>
          <p className="text-xs text-slate-400 mt-1">Click "Add POD" to map POD1, POD2, etc. to shift plan values</p>
          <Button variant="outline" className="mt-3 h-9 gap-2 text-sm" onClick={addRow}>
            <Plus className="w-3.5 h-3.5" /> Add First POD Field
          </Button>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="hidden md:grid grid-cols-12 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
            <div className="col-span-2">POD Field</div>
            <div className="col-span-3">Label / Description</div>
            <div className="col-span-5">Shift Plan Value (ERP Source)</div>
            <div className="col-span-1 text-center">Editable</div>
            <div className="col-span-1" />
          </div>

          <div className="divide-y divide-slate-100 bg-white">
            {value.map((row, idx) => {
              const selectedOpt = ERP_SOURCE_OPTIONS.find(o => o.value === row.erp_source);
              return (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 items-start">
                  {/* POD Field selector */}
                  <div className="md:col-span-2">
                    <Select
                      value={row.pod_field}
                      onValueChange={v => updateRow(idx, 'pod_field', v)}
                    >
                      <SelectTrigger className="h-9 font-mono text-sm">
                        <SelectValue placeholder="POD…" />
                      </SelectTrigger>
                      <SelectContent>
                        {POD_FIELDS.map(p => (
                          <SelectItem
                            key={p}
                            value={p}
                            disabled={usedPods.has(p) && p !== row.pod_field}
                          >
                            {p}
                            {usedPods.has(p) && p !== row.pod_field ? ' (used)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Label */}
                  <div className="md:col-span-3">
                    <input
                      type="text"
                      value={row.label}
                      onChange={e => updateRow(idx, 'label', e.target.value)}
                      placeholder="e.g. Batch Number"
                      className="w-full h-9 px-3 rounded-md border border-input text-sm bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>

                  {/* ERP Source */}
                  <div className="md:col-span-5 space-y-1">
                    <Select
                      value={row.erp_source}
                      onValueChange={v => updateRow(idx, 'erp_source', v)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select shift plan field…" />
                      </SelectTrigger>
                      <SelectContent>
                        {ERP_SOURCE_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>
                            <div className="flex flex-col">
                              <span>{o.label}</span>
                              {o.example && (
                                <span className="text-xs text-slate-400 font-mono">{o.example}</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedOpt?.example && (
                      <p className="text-xs text-slate-400 font-mono pl-1">
                        Example: {selectedOpt.example}
                      </p>
                    )}
                  </div>

                  {/* Editable toggle */}
                  <div className="md:col-span-1 flex items-center justify-center gap-2 pt-2">
                    <span className="text-xs text-slate-500 md:hidden">Operator can edit:</span>
                    <Switch
                      checked={row.is_editable !== false}
                      onCheckedChange={v => updateRow(idx, 'is_editable', v)}
                    />
                  </div>

                  {/* Remove */}
                  <div className="md:col-span-1 flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => removeRow(idx)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary footer */}
          <div className="bg-slate-50 border-t border-slate-200 px-3 py-2 flex items-center gap-4 text-xs text-slate-500">
            <span>{value.length} POD field{value.length !== 1 ? 's' : ''} configured</span>
            <span>·</span>
            <span>{value.filter(r => r.erp_source && r.erp_source !== 'manual').length} auto-populated from shift plan</span>
            <span>·</span>
            <span>{value.filter(r => r.erp_source === 'manual').length} manual entry</span>
          </div>
        </div>
      )}
    </div>
  );
}