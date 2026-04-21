/**
 * LblPrintLiveCounters
 *
 * Displays the 4-counter grid (Total / Printed / Remaining / Done %) + progress bar
 * used in the Bulk Print Dashboard. Receives all values as props — no data fetching.
 */

import { Activity, Pause } from 'lucide-react';

export default function LblPrintLiveCounters({ planned, printedQty, remaining, progress, isPrinting, isPaused, isAwaitingReset }) {
  return (
    <div className="space-y-3">
      {/* ── 4 live counter tiles ── */}
      <div className="grid grid-cols-4 gap-2">

        {/* Total */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Total</p>
          <span className="text-2xl font-bold text-slate-900">{planned.toLocaleString()}</span>
        </div>

        {/* Printed */}
        <div className={`border rounded-xl p-3 text-center transition-colors ${
          isPrinting ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'
        }`}>
          <p className={`text-xs mb-1 ${isPrinting ? 'text-blue-500' : 'text-slate-500'}`}>Printed</p>
          <span className={`text-2xl font-bold ${isPrinting ? 'text-blue-700' : 'text-slate-900'}`}>
            {printedQty.toLocaleString()}
          </span>
          {isPrinting && (
            <p className="text-xs text-blue-400 mt-0.5 flex items-center justify-center gap-0.5">
              <Activity className="w-3 h-3" /> live
            </p>
          )}
        </div>

        {/* Remaining */}
        <div className={`border rounded-xl p-3 text-center transition-colors ${
          isPaused ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200'
        }`}>
          <p className={`text-xs mb-1 ${isPaused ? 'text-orange-500' : 'text-slate-500'}`}>Remaining</p>
          <span className={`text-2xl font-bold ${isPaused ? 'text-orange-700' : 'text-slate-900'}`}>
            {remaining.toLocaleString()}
          </span>
        </div>

        {/* % Done */}
        <div className={`border rounded-xl p-3 text-center transition-colors ${
          isAwaitingReset ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'
        }`}>
          <p className={`text-xs mb-1 ${isAwaitingReset ? 'text-green-500' : 'text-slate-500'}`}>Done</p>
          <span className={`text-2xl font-bold ${isAwaitingReset ? 'text-green-700' : 'text-slate-900'}`}>
            {progress.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="space-y-1.5">
        <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isAwaitingReset ? 'bg-green-500' :
              isPaused        ? 'bg-orange-400' :
              isPrinting      ? 'bg-blue-500' :
              'bg-slate-400'
            }`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400">
          <span>0</span>
          <span className="font-medium text-slate-600">
            {printedQty.toLocaleString()} / {planned.toLocaleString()} labels
          </span>
          <span>{planned.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}