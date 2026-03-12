import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { renderBatchId, parseFormatJson } from '@/components/batch/batchRuleEngine';

const SOURCE_OPTIONS = [
  { value: 'sku_batch_id', label: 'Batch ID' },
  { value: 'mfg_date', label: 'MFG Date' },
  { value: 'exp_date', label: 'EXP Date' },
  { value: 'mrp', label: 'MRP' },
  { value: 'sku_code', label: 'SKU Code' },
  { value: 'sku_name', label: 'SKU Name' },
  { value: 'bottle_type', label: 'Bottle Type' },
  { value: 'bottles_per_box', label: 'Bottles per Box' },
  { value: 'custom_text', label: 'Custom Text' },
];

const DATE_FORMATS = ['DDMMYY', 'DD/MM/YY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD-MMM-YYYY'];
const DATE_SOURCES = ['mfg_date', 'exp_date'];

function formatDate(str, fmt) {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const yyyy = d.getFullYear();
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  switch (fmt) {
    case 'DDMMYY': return `${dd}${mm}${yy}`;
    case 'DD/MM/YY': return `${dd}/${mm}/${yy}`;
    case 'DD/MM/YYYY': return `${dd}/${mm}/${yyyy}`;
    case 'YYYY-MM-DD': return `${yyyy}-${mm}-${dd}`;
    case 'DD-MMM-YYYY': return `${dd}-${months[d.getMonth()]}-${yyyy}`;
    default: return `${dd}${mm}${yy}`;
  }
}

function previewValue(row, sku, batchRule, brands, families, flavours) {
  switch (row.source) {
    case 'sku_batch_id': {
      // Use actual batch rule to generate preview
      if (batchRule && batchRule.format_json) {
        const formatObj = parseFormatJson(batchRule.format_json);
        if (formatObj) {
          const brand = brands?.find(b => b.brand_name === sku?.brand_name);
          const family = families?.find(f => f.family_name === sku?.product_family);
          const flavour = flavours?.find(f => f.flavour_name === sku?.flavour);
          const ctx = {
            date: new Date(),
            seq: 1,
            skuPrefix: sku?.item_code?.substring(0, 3) || '',
            brandCode: brand?.short_code || '',
            familyCode: family?.short_code || '',
            flavourCode: flavour?.short_code || '',
            uniqueId: '100000', // Preview value
          };
          return renderBatchId(formatObj, ctx);
        }
      }
      return sku?.batch_prefix ? `${sku.batch_prefix}01` : 'BATCH001';
    }
    case 'mfg_date': return formatDate(null, row.format || 'DDMMYY');
    case 'exp_date': return formatDate(null, row.format || 'DDMMYY') + ' (+shelf)';
    case 'mrp': return sku?.mrp || sku?.mrp_box || '120.00';
    case 'sku_code': return sku?.item_code || 'SKU001';
    case 'sku_name': return sku?.product_name || 'Product Name';
    case 'bottle_type': return sku?.bottle_type || 'PET';
    case 'bottles_per_box': return sku?.bottles_per_box || '24';
    case 'custom_text': return row.custom_text || '(custom)';
    default: return '—';
  }
}

export default function PayloadMapBuilder({ rows, onChange, templatePlaceholders, sku, batchRule, brands, families, flavours }) {
  // Merge template placeholders with existing rows
  const [localRows, setLocalRows] = useState(rows || []);

  useEffect(() => {
    if (templatePlaceholders && templatePlaceholders.length > 0) {
      const existing = (rows || []).reduce((acc, r) => { acc[r.placeholder] = r; return acc; }, {});
      const merged = templatePlaceholders.map(p => existing[p] || { placeholder: p, source: '', format: '', custom_text: '' });
      // Add any rows not from template
      const extras = (rows || []).filter(r => !templatePlaceholders.includes(r.placeholder));
      setLocalRows([...merged, ...extras]);
    } else {
      setLocalRows(rows || []);
    }
  }, [templatePlaceholders?.join(',')]);

  const update = (newRows) => { setLocalRows(newRows); onChange(newRows); };

  const setRow = (idx, patch) => {
    const next = localRows.map((r, i) => i === idx ? { ...r, ...patch } : r);
    update(next);
  };

  return (
    <div className="space-y-3">
      {localRows.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-400">
          Select a Ryan Template to configure payload mapping
        </div>
      ) : (
        <>
          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 px-1">
            <div className="col-span-3">Placeholder</div>
            <div className="col-span-3">Value Source</div>
            <div className="col-span-2">Format</div>
            <div className="col-span-4">Preview</div>
          </div>

          {localRows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-3">
                <Input
                  value={row.placeholder}
                  readOnly
                  className="text-xs h-9 font-mono bg-slate-50"
                />
              </div>
              <div className="col-span-3">
                <select
                  value={row.source}
                  onChange={e => setRow(idx, { source: e.target.value })}
                  className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs bg-white h-9"
                >
                  <option value="">— source —</option>
                  {SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                {DATE_SOURCES.includes(row.source) ? (
                  <select
                    value={row.format || 'DDMMYY'}
                    onChange={e => setRow(idx, { format: e.target.value })}
                    className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs bg-white h-9"
                  >
                    {DATE_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                ) : row.source === 'custom_text' ? (
                  <Input
                    value={row.custom_text || ''}
                    onChange={e => setRow(idx, { custom_text: e.target.value })}
                    placeholder="text"
                    className="text-xs h-9"
                  />
                ) : (
                  <div className="h-9 px-2 flex items-center text-xs text-slate-400">—</div>
                )}
              </div>
              <div className="col-span-4">
                <div className="h-9 px-2 flex items-center text-xs font-mono bg-slate-50 border border-slate-200 rounded-md text-slate-700 overflow-hidden">
                  {previewValue(row, sku, batchRule, brands, families, flavours)}
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}