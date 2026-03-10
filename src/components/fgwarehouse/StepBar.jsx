import React from 'react';

// steps: [{id: string, label: string}]
// current: step id string
export default function StepBar({ steps, current }) {
  const idx = steps.findIndex(s => s.id === current);
  return (
    <div className="flex items-center mb-1">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center">
          {i > 0 && (
            <div className={`flex-1 h-1 mx-1.5 rounded-full transition-colors ${i <= idx ? 'bg-slate-700' : 'bg-slate-200'}`} />
          )}
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              i < idx ? 'bg-green-600 text-white' : i === idx ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              {i < idx ? '✓' : i + 1}
            </div>
            <span className={`text-[10px] font-bold tracking-wide uppercase transition-colors ${
              i === idx ? 'text-slate-900' : i < idx ? 'text-green-700' : 'text-slate-400'
            }`}>
              {s.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}