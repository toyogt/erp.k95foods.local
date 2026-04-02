import { COST_HEADS } from './costHeads';
import { Calculator } from 'lucide-react';

export default function SystemEstimateCard({ costRecord, compact = false }) {
  if (!costRecord) return null;

  const heads = COST_HEADS.map(h => ({
    label: h.label,
    value: Number(costRecord[`system_${h.key}`]) || 0,
  }));
  const total = Number(costRecord.system_total) || heads.reduce((s, h) => s + h.value, 0);
  const hasEstimate = total > 0;

  if (compact) {
    return (
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-2">
        {hasEstimate ? (
          <div className="flex items-center justify-between text-xs">
            <span className="text-blue-700">System Estimate</span>
            <span className="font-bold text-blue-900">₹{total.toLocaleString('en-IN')}</span>
          </div>
        ) : (
          <p className="text-xs text-blue-600">No rate card matched</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-semibold text-blue-900">System Estimated Cost</span>
        <span className="ml-auto text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Reference Only</span>
      </div>
      {hasEstimate ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
            {heads.filter(h => h.value > 0).map(h => (
              <div key={h.label} className="text-xs">
                <span className="text-blue-700">{h.label}</span>
                <p className="font-medium text-blue-900">₹{h.value.toLocaleString('en-IN')}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-blue-200 pt-2 flex justify-between">
            <span className="text-sm font-semibold text-blue-900">Total System Estimate</span>
            <span className="text-sm font-bold text-blue-900">₹{total.toLocaleString('en-IN')}</span>
          </div>
        </>
      ) : (
        <p className="text-xs text-blue-600">No matching rate card found for this order weight. Add rate cards in Settings → Transport Rate Cards.</p>
      )}
    </div>
  );
}