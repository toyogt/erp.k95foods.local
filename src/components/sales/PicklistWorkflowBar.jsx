/**
 * Picklist Workflow Progress Bar — visual step indicator for picklist lifecycle.
 */
import { CheckCircle2 } from 'lucide-react';

const STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'picking', label: 'Picking' },
  { key: 'dispatch_scheduled', label: 'Dispatch Scheduled' },
  { key: 'pick_packed', label: 'Pick & Packed' },
  { key: 'completed', label: 'Completed' },
];

export default function PicklistWorkflowBar({ status }) {
  const currentIdx = STEPS.findIndex(s => s.key === status);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
      <div className="flex items-center min-w-max">
        {STEPS.map((step, i) => {
          const done = currentIdx > i;
          const active = currentIdx === i;
          return (
            <div key={step.key} className="flex items-center">
              <div className="flex flex-col items-center gap-1 px-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  done ? 'bg-green-100 text-green-600' :
                  active ? 'bg-slate-900 text-white' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  {done ? <CheckCircle2 className="w-4 h-4" /> : (i + 1)}
                </div>
                <span className={`text-xs font-medium text-center max-w-[90px] ${
                  active ? 'text-slate-900' :
                  done ? 'text-green-700' :
                  'text-slate-400'
                }`}>
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-10 h-0.5 mb-5 ${done ? 'bg-green-400' : 'bg-slate-200'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}