import { Check } from 'lucide-react';

const RULES = [
  { key: 'batch_required', label: 'Batch Number Required' },
  { key: 'mfg_date_required', label: 'Manufacture Date Required' },
  { key: 'expiry_required', label: 'Expiry Date Required' },
];

function RuleCheckbox({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
        checked
          ? 'bg-teal-600 border-teal-600 text-white'
          : 'border-slate-300 hover:border-slate-400 bg-white'
      }`}
    >
      {checked && <Check className="w-4 h-4" />}
    </button>
  );
}

export default function ImportRulesTable({ items, rulesMap, onToggleRule, onChangeShelfLife }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-100 text-slate-700 text-xs">
            <th className="px-3 py-2.5 text-left font-semibold sticky left-0 bg-slate-100 min-w-[180px]">Item Name</th>
            {RULES.map(r => (
              <th key={r.key} className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">{r.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item, idx) => {
            const rules = rulesMap[idx] || {};
            return (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="px-3 py-2.5 sticky left-0 bg-white">
                  <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]">{item.item_name}</p>
                  <p className="text-xs text-slate-400">{item.uom} · {item.item_category}</p>
                </td>
                {RULES.map(r => (
                  <td key={r.key} className="px-3 py-2.5 text-center">
                    <div className="flex justify-center">
                      <RuleCheckbox
                        checked={!!rules[r.key]}
                        onChange={() => onToggleRule(idx, r.key)}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Bulk toggles */}
      <div className="flex flex-wrap gap-2 mt-3 px-1">
        <p className="text-xs font-medium text-slate-500 mr-2 self-center">Apply to All:</p>
        {RULES.map(r => (
          <button
            key={r.key}
            type="button"
            onClick={() => items.forEach((_, idx) => {
              const current = rulesMap[idx]?.[r.key];
              if (!current) onToggleRule(idx, r.key, true);
            })}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-teal-50 hover:border-teal-300 text-xs text-slate-600 transition-colors"
          >
            ✓ {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}