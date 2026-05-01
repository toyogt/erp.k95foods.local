/**
 * LblLabelPreviewCard
 * Displays all computed label POD field values that will be sent to the Rynan middleware.
 * Used in both Plan Create (job row) and Stock Transfer step.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tag } from 'lucide-react';
import { computeLabelFields } from '@/lib/labelFieldComputer';

// Static catalog of all known PODs — used as the default when no template filter applies.
const ALL_POD_ROWS = [
  { pod: 'POD1',  label: 'MRP',                                fieldKey: 'mrp',               highlight: true },
  { pod: 'POD2',  label: 'MRP with USP',                       fieldKey: 'mrpWithUsp' },
  { pod: 'POD3',  label: 'Incl. of all taxes',                 fieldKey: 'taxLine',           muted: true },
  { pod: 'POD4',  label: 'Batch No.',                          fieldKey: 'batchNo',           mono: true },
  { pod: 'POD5',  label: 'Manufacturing Date',                 fieldKey: 'mfgDate' },
  { pod: 'POD6',  label: 'Expiry Date/Use By Date',            fieldKey: 'expiryDate',        warn: true },
  { pod: 'POD7',  label: 'USP (Swiggy Noice)',                 fieldKey: 'usp' },
  { pod: 'POD8',  label: 'Manufacturing Date (Swiggy Noice)',  fieldKey: 'mfgDateOffset',     muted: true },
  { pod: 'POD9',  label: 'Expiry Date/Use By Date (Swiggy Noice)', fieldKey: 'expiryDateOffset', muted: true },
  { pod: 'POD10', label: 'Net Weight',                         fieldKey: 'netWeight' },
  { pod: 'POD11', label: 'USP',                                fieldKey: 'uspWithUnit' },
  { pod: 'POD12', label: 'MRP and USP',                        fieldKey: 'mrpAndUsp' },
];

/**
 * @param {string} props.productName
 * @param {string} props.batchNo
 * @param {number|string} props.mrp            – MRP in INR
 * @param {number} props.mlPerBottle           – bottle size in ml
 * @param {string} props.mfgDate              – DD/MM/YYYY or YYYY-MM-DD
 * @param {string} props.labellingDate        – DD/MM/YYYY or YYYY-MM-DD (optional)
 * @param {number} props.shelfLifeDays        – from product master
 * @param {string} props.fssaiNo
 * @param {string} props.templateName         – chosen template name (optional)
 * @param {string} props.bottleType
 */
export default function LblLabelPreviewCard({
  productName,
  batchNo,
  mrp,
  mlPerBottle,
  mfgDate,
  labellingDate,
  shelfLifeDays,
  shelfLifeUnit,
  fssaiNo,
  templateName,
  templateId,
  bottleType,
}) {
  const fields = useMemo(() => computeLabelFields({
    mrp,
    mlPerBottle,
    mfgDate,
    labellingDate,
    shelfLifeDays,
    shelfLifeUnit: shelfLifeUnit || 'months',
    batchNo,
    productName,
  }), [mrp, mlPerBottle, mfgDate, labellingDate, shelfLifeDays, shelfLifeUnit, batchNo, productName]);

  // Load the selected print template so we can show ONLY the PODs it actually maps.
  const { data: templateList = [] } = useQuery({
    queryKey: ['lbl-print-template-for-preview', templateId],
    queryFn: () => base44.entities.LblPrintTemplate.filter({ template_id: templateId }),
    enabled: !!templateId,
  });
  const template = templateList[0];

  // Build the filtered row list from the template's field_mappings.
  // Falls back to the full POD catalog when no template is selected.
  const visibleRows = useMemo(() => {
    if (!template?.field_mappings?.length) return ALL_POD_ROWS;
    return template.field_mappings.map(m => {
      const base = ALL_POD_ROWS.find(r => r.pod === m.pod_field) || {};
      return {
        pod: m.pod_field,
        label: m.label || base.label || m.pod_field,
        fieldKey: m.erp_source || base.fieldKey || '',
        highlight: base.highlight,
        warn: base.warn,
        muted: base.muted,
        mono: base.mono,
      };
    });
  }, [template]);

  const hasSomeData = productName || batchNo || mrp;
  if (!hasSomeData) return null;

  return (
    <div className="border border-dashed border-slate-300 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
        <Tag className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Label Preview — POD Field Values</span>
        {(template?.name || templateName) && (
          <span className="ml-auto text-xs text-slate-400 font-mono">{template?.name || templateName}</span>
        )}
      </div>

      <div className="bg-white p-3 space-y-3">
        {/* Product header */}
        {productName && (
          <div>
            <p className="text-sm font-bold text-slate-900">{productName}</p>
            {bottleType && <p className="text-xs text-slate-500">{bottleType}</p>}
          </div>
        )}

        {/* POD fields table */}
        <div className="rounded border border-slate-200 overflow-hidden text-xs">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left px-2 py-1.5 text-slate-600 font-semibold" style={{width:'15%'}}>POD</th>
                <th className="text-left px-2 py-1.5 text-slate-600 font-semibold" style={{width:'28%'}}>Field Name</th>
                <th className="text-left px-2 py-1.5 text-slate-600 font-semibold" style={{width:'22%'}}>Template Key</th>
                <th className="text-left px-2 py-1.5 text-slate-600 font-semibold">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map(row => {
                const raw = fields[row.fieldKey];
                const value = raw === undefined || raw === null || raw === '' ? '—' : String(raw);
                return (
                  <PodRow
                    key={row.pod}
                    pod={row.pod}
                    label={row.label}
                    fieldKey={row.fieldKey}
                    value={value}
                    highlight={row.highlight}
                    warn={row.warn && raw}
                    muted={row.muted}
                    mono={row.mono}
                  />
                );
              })}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-2 py-3 text-center text-slate-500">
                    No POD fields mapped in this template.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {fssaiNo && (
          <p className="text-xs text-slate-500">FSSAI: {fssaiNo}</p>
        )}
      </div>
    </div>
  );
}

function PodRow({ pod, label, fieldKey, value, highlight, warn, muted, mono }) {
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-2 py-1.5 font-mono text-slate-400 font-semibold">{pod}</td>
      <td className="px-2 py-1.5 text-slate-700">{label}</td>
      <td className="px-2 py-1.5 font-mono text-blue-600 text-xs">{fieldKey}</td>
      <td className={`px-2 py-1.5 font-semibold ${
        highlight ? 'text-green-700' :
        warn ? 'text-amber-700' :
        muted ? 'text-slate-400' :
        'text-slate-900'
      } ${mono ? 'font-mono' : ''}`}>
        {value}
      </td>
    </tr>
  );
}