import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const PLATFORMS = [
  { key: 'hsn_code',         label: 'HSN / SAC Code',     placeholder: 'e.g. 22021090',   note: 'Tax classification code for goods and services' },
  { key: 'swiggy_item_id',   label: 'Swiggy Item ID',     placeholder: 'e.g. 12345678',   note: 'Internal item identifier on the Swiggy platform' },
  { key: 'bigbasket_item_id',label: 'BigBasket Item ID',  placeholder: 'e.g. 40098765',   note: 'Internal item identifier on the BigBasket platform' },
  { key: 'zepto_item_id',    label: 'Zepto Item ID',      placeholder: 'e.g. ZP-00012345',note: 'Internal item identifier on the Zepto platform' },
  { key: 'amazon_item_id',   label: 'Amazon ASIN',        placeholder: 'e.g. B09XYZ1234', note: 'Amazon Standard Identification Number (ASIN)' },
];

function Field({ label, note, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      {children}
      <p className="text-xs text-slate-400">{note}</p>
    </div>
  );
}

export default function PlatformIDsSection({ form, onChange }) {
  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-bold text-blue-900 mb-1">🔗 External Platform Identifiers</p>
        <p className="text-xs text-blue-800 leading-relaxed">
          Map this Product Code (<span className="font-mono font-semibold">{form.item_code || '—'}</span>) to external platform item IDs.
          These are used for order reconciliation, GRN matching, and multi-channel stock sync.
        </p>
      </div>

      {/* Duplicate check notice */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <p className="text-sm font-bold text-slate-700">📋 HSN / SAC Classification</p>
        <Field label="HSN / SAC Code" note={PLATFORMS[0].note}>
          <Input
            className="h-11 text-base font-mono"
            placeholder={PLATFORMS[0].placeholder}
            value={form.hsn_code || ''}
            onChange={e => onChange('hsn_code', e.target.value)}
          />
        </Field>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <p className="text-sm font-bold text-slate-700">🛒 Quick Commerce Platform IDs</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PLATFORMS.slice(1).map(p => (
            <Field key={p.key} label={p.label} note={p.note}>
              <Input
                className="h-11 text-base font-mono"
                placeholder={p.placeholder}
                value={form[p.key] || ''}
                onChange={e => onChange(p.key, e.target.value)}
              />
            </Field>
          ))}
        </div>

        {/* Summary mapping table */}
        {form.item_code && (
          <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-3 py-2">
              <p className="text-xs font-semibold text-slate-700">Product Code → Platform ID Mapping</p>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-3 py-2 text-slate-600 font-medium">Product Code</th>
                  <th className="text-left px-3 py-2 text-slate-600 font-medium">Platform</th>
                  <th className="text-left px-3 py-2 text-slate-600 font-medium">Platform Item ID</th>
                  <th className="text-left px-3 py-2 text-slate-600 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {PLATFORMS.slice(1).map(p => (
                  <tr key={p.key} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-slate-700">{form.item_code}</td>
                    <td className="px-3 py-2 text-slate-700">{p.label}</td>
                    <td className="px-3 py-2 font-mono text-slate-900">{form[p.key] || <span className="text-slate-400 font-sans">Not mapped</span>}</td>
                    <td className="px-3 py-2">
                      {form[p.key]
                        ? <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Mapped</span>
                        : <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">Empty</span>
                      }
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