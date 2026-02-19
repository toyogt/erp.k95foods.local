import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle } from 'lucide-react';

const STARTUP_ITEMS = [
  'Correct label roll mounted and verified',
  'Label SKU matches Work Order',
  'Ink / ribbon fresh and seated',
  'Date coder settings verified (MFG / EXP / MRP)',
  'Printer self-test print OK',
  'Conveyor clear and clean',
  'Crate stop sensor functional',
  'Empty crate confirmed on conveyor',
  'All guards in place',
  'Supervisor approval obtained',
];

export default function StartupChecklist({ onComplete }) {
  const [checks, setChecks] = useState(Array(STARTUP_ITEMS.length).fill(false));

  function toggle(i) {
    setChecks(prev => { const n = [...prev]; n[i] = !n[i]; return n; });
  }

  const allDone = checks.every(Boolean);

  function handleSubmit() {
    const items = STARTUP_ITEMS.map((label, i) => ({ label, checked: checks[i] }));
    onComplete(items);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-600 uppercase tracking-widest">Startup Checklist</p>
      <div className="space-y-2">
        {STARTUP_ITEMS.map((item, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
              checks[i] ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            {checks[i]
              ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              : <Circle className="w-5 h-5 text-slate-400 flex-shrink-0" />}
            <span className="text-sm font-medium">{item}</span>
          </button>
        ))}
      </div>
      <div className="pt-2">
        <p className="text-xs text-slate-400 mb-2">{checks.filter(Boolean).length} / {STARTUP_ITEMS.length} completed</p>
        <Button
          className="w-full h-12 rounded-xl"
          disabled={!allDone}
          onClick={handleSubmit}
        >
          Confirm Startup Checklist
        </Button>
      </div>
    </div>
  );
}