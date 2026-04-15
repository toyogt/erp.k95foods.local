/**
 * LblLabelPreviewCard
 * Displays all computed label POD field values that will be sent to the Rynan middleware.
 * Used in both Plan Create (job row) and Stock Transfer step.
 */
import { useMemo } from 'react';
import { Tag } from 'lucide-react';
import { computeLabelFields } from '@/lib/labelFieldComputer';

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
  fssaiNo,
  templateName,
  bottleType,
}) {
  const fields = useMemo(() => computeLabelFields({
    mrp,
    mlPerBottle,
    mfgDate,
    labellingDate,
    shelfLifeDays,
    batchNo,
    productName,
  }), [mrp, mlPerBottle, mfgDate, labellingDate, shelfLifeDays, batchNo, productName]);

  const hasSomeData = productName || batchNo || mrp;
  if (!hasSomeData) return null;

  return (
    <div className="border border-dashed border-slate-300 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
        <Tag className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Label Preview — POD Field Values</span>
        {templateName && (
          <span className="ml-auto text-xs text-slate-400 font-mono">{templateName}</span>
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
              <PodRow pod="POD1"  label="MRP"                              fieldKey="mrp"               value={fields.mrp ? `${fields.mrp}` : '—'} highlight />
              <PodRow pod="POD2"  label="MRP with USP"                     fieldKey="mrpWithUsp"         value={fields.mrpWithUsp || '—'} />
              <PodRow pod="POD3"  label="Incl. of all taxes"               fieldKey="taxLine"            value={fields.taxLine} muted />
              <PodRow pod="POD4"  label="Batch No."                        fieldKey="batchNo"            value={fields.batchNo || '—'} mono />
              <PodRow pod="POD5"  label="Manufacturing Date"               fieldKey="mfgDate"            value={fields.mfgDate || '—'} />
              <PodRow pod="POD6"  label="Expiry Date/Use By Date"          fieldKey="expiryDate"         value={fields.expiryDate || '—'} warn={!!fields.expiryDate} />
              <PodRow pod="POD7"  label="USP (Swiggy Noice)"                    fieldKey="usp"               value={fields.usp || '—'} />
              <PodRow pod="POD8"  label="Manufacturing Date (Swiggy Noice)"    fieldKey="mfgDateOffset"     value={fields.mfgDateOffset || '—'} muted />
              <PodRow pod="POD9"  label="Expiry Date/Use By Date (Swiggy Noice)" fieldKey="expiryDateOffset" value={fields.expiryDateOffset || '—'} muted />
              <PodRow pod="POD10" label="Net Weight"                       fieldKey="netWeight"          value={fields.netWeight || '—'} />
              <PodRow pod="POD11" label="USP"                              fieldKey="uspWithUnit"        value={fields.uspWithUnit || '—'} />
              <PodRow pod="POD12" label="MRP and USP"                      fieldKey="mrpAndUsp"          value={fields.mrpAndUsp || '—'} />
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