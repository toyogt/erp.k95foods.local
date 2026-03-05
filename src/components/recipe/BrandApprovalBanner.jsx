import { AlertTriangle, ShieldBan } from 'lucide-react';

/**
 * Shows a warning banner at the top of a recipe option if any locked brand is BLOCKED or HOLD.
 * blockedRows: array of { ingredient_name, brand_name, status }
 */
export default function BrandApprovalBanner({ blockedRows }) {
  if (!blockedRows || blockedRows.length === 0) return null;

  const hasBlocked = blockedRows.some(r => r.status === 'BLOCKED');

  return (
    <div className={`rounded-xl border p-3 flex items-start gap-2 ${hasBlocked ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'}`}>
      {hasBlocked ? <ShieldBan className="w-4 h-4 text-red-600 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
      <div>
        <p className={`text-sm font-bold ${hasBlocked ? 'text-red-700' : 'text-amber-700'}`}>
          This recipe contains locked brands that are not APPROVED.
        </p>
        <ul className="mt-1 space-y-0.5">
          {blockedRows.map((r, i) => (
            <li key={i} className={`text-xs font-semibold ${r.status === 'BLOCKED' ? 'text-red-600' : 'text-amber-600'}`}>
              • {r.ingredient_name}: {r.brand_name} — <span className="uppercase">{r.status}</span>
            </li>
          ))}
        </ul>
        <p className={`text-xs mt-1 ${hasBlocked ? 'text-red-600' : 'text-amber-600'}`}>
          Production release will be blocked until these are replaced with APPROVED brands.
        </p>
      </div>
    </div>
  );
}