import { CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DEFAULT_BEFORE = [
  'Vessel cleaned and sanitised',
  'All valves closed',
  'Ingredient weights verified',
  'Temperature probe calibrated',
  'Batch record filled',
];

const DEFAULT_AFTER = [
  'Vessel rinsed',
  'All valves closed',
  'CIP scheduled',
  'Batch record signed off',
  'Equipment returned to storage',
];

export function getDefaultItems(type) {
  return (type === 'BEFORE' ? DEFAULT_BEFORE : DEFAULT_AFTER).map(label => ({ label, checked: false }));
}

export default function ChecklistStep({ type, items, onChange, onComplete, canComplete }) {
  function toggle(idx) {
    const next = items.map((item, i) => i === idx ? { ...item, checked: !item.checked } : item);
    onChange(next);
  }

  const allChecked = items.every(i => i.checked);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        {items.map((item, idx) => (
          <button
            key={idx}
            onClick={() => toggle(idx)}
            className={`w-full flex items-center gap-4 px-5 py-4 text-left border-b border-slate-100 last:border-0 transition-colors ${item.checked ? 'bg-emerald-50' : 'bg-white'}`}
          >
            {item.checked
              ? <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
              : <Circle className="w-6 h-6 text-slate-300 flex-shrink-0" />}
            <span className={`text-base font-medium ${item.checked ? 'text-emerald-800 line-through' : 'text-slate-900'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      <Button
        onClick={onComplete}
        disabled={!allChecked || !canComplete}
        className="w-full h-16 rounded-2xl text-lg font-bold bg-slate-900 hover:bg-slate-800 disabled:opacity-40"
      >
        <CheckCircle2 className="w-5 h-5 mr-2" /> Confirm {type} Checklist
      </Button>
    </div>
  );
}