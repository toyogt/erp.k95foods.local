/**
 * LblLabelPreviewCard
 * Shows a sample label preview with all key print fields:
 * product name, batch, MRP, bottle size, USP/ml, MFG date, expiry date.
 * Used in both Plan Create (job row) and Stock Transfer step.
 */
import { useMemo } from 'react';
import { Tag } from 'lucide-react';
import moment from 'moment';

/**
 * @param {object} props
 * @param {string} props.productName
 * @param {string} props.batchNo
 * @param {number|string} props.mrp            – MRP in INR
 * @param {number} props.mlPerBottle           – bottle size in ml
 * @param {string} props.mfgDate              – DD/MM/YYYY
 * @param {string} props.labellingDate        – YYYY-MM-DD (or DD/MM/YYYY)
 * @param {number} props.shelfLifeDays        – from product master
 * @param {string} props.fssaiNo
 * @param {string} props.templateName         – chosen template name (optional)
 * @param {string} props.bottleType           – e.g. "PET 500ml"
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
  const expiryDate = useMemo(() => {
    // Prefer labelling date for expiry, fall back to mfg date
    let base = null;
    if (labellingDate) {
      base = labellingDate.includes('/')
        ? moment(labellingDate, 'DD/MM/YYYY')
        : moment(labellingDate, 'YYYY-MM-DD');
    } else if (mfgDate) {
      base = mfgDate.includes('/')
        ? moment(mfgDate, 'DD/MM/YYYY')
        : moment(mfgDate, 'YYYY-MM-DD');
    }
    if (!base || !base.isValid() || !shelfLifeDays || Number(shelfLifeDays) === 0) return null;
    return base.clone().add(Number(shelfLifeDays), 'days').format('DD/MM/YYYY');
  }, [labellingDate, mfgDate, shelfLifeDays]);

  const uspPerMl = useMemo(() => {
    if (!mrp || !mlPerBottle || Number(mlPerBottle) === 0) return null;
    return (Number(mrp) / Number(mlPerBottle)).toFixed(2);
  }, [mrp, mlPerBottle]);

  const hasSomeData = productName || batchNo || mrp;

  if (!hasSomeData) return null;

  return (
    <div className="border border-dashed border-slate-300 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
        <Tag className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Label Preview</span>
        {templateName && (
          <span className="ml-auto text-xs text-slate-400 font-mono">{templateName}</span>
        )}
      </div>

      {/* Label mock */}
      <div className="bg-white p-3">
        <div className="border-2 border-slate-800 rounded p-3 space-y-2 max-w-xs">
          {/* Product Name */}
          {productName && (
            <div className="text-center">
              <p className="text-sm font-bold text-slate-900 leading-tight">{productName}</p>
              {bottleType && <p className="text-xs text-slate-500">{bottleType}</p>}
            </div>
          )}

          <div className="border-t border-slate-200" />

          {/* Key Fields Grid */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {mrp && (
              <LabelField label="MRP" value={`₹${mrp}`} highlight />
            )}
            {mlPerBottle && (
              <LabelField label="Volume" value={`${mlPerBottle} ml`} />
            )}
            {uspPerMl && (
              <LabelField label="USP (Cost/ml)" value={`₹${uspPerMl}/ml`} />
            )}
            {batchNo && (
              <LabelField label="Batch No." value={batchNo} mono />
            )}
            {mfgDate && (
              <LabelField label="Mfg. Date" value={mfgDate} />
            )}
            {expiryDate && (
              <LabelField label="Best Before" value={expiryDate} warn />
            )}
            {!expiryDate && shelfLifeDays && (
              <LabelField label="Shelf Life" value={`${shelfLifeDays} days`} />
            )}
          </div>

          {fssaiNo && (
            <div className="border-t border-slate-200 pt-1">
              <p className="text-xs text-slate-500 text-center">FSSAI: {fssaiNo}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LabelField({ label, value, highlight, warn, mono }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-xs font-semibold leading-tight ${
        highlight ? 'text-green-700' :
        warn ? 'text-amber-700' :
        'text-slate-900'
      } ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  );
}