import { CheckCircle2, Loader2, Circle } from 'lucide-react';

// steps: [{ key, label, status: 'pending' | 'active' | 'done' | 'error', detail }]
export default function PDFProcessingSteps({ steps, filename }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-8 py-12">
      {/* Animated icon */}
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-slate-600 animate-spin" />
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold text-slate-800">Processing PDF</p>
        {filename && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[220px]">{filename}</p>}
      </div>

      {/* Step list */}
      <div className="w-full max-w-sm space-y-2">
        {steps.map((step) => (
          <div
            key={step.key}
            className={`flex items-start gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 ${
              step.status === 'active'
                ? 'bg-blue-50 border border-blue-200'
                : step.status === 'done'
                ? 'bg-green-50 border border-green-100'
                : step.status === 'error'
                ? 'bg-red-50 border border-red-200'
                : 'bg-slate-50 border border-slate-100 opacity-50'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {step.status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
              {step.status === 'active' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
              {step.status === 'error' && <Circle className="w-4 h-4 text-red-400" />}
              {step.status === 'pending' && <Circle className="w-4 h-4 text-slate-300" />}
            </div>
            <div>
              <p className={`text-xs font-medium ${
                step.status === 'active' ? 'text-blue-700'
                : step.status === 'done' ? 'text-green-700'
                : step.status === 'error' ? 'text-red-600'
                : 'text-slate-400'
              }`}>
                {step.label}
              </p>
              {step.detail && step.status !== 'pending' && (
                <p className="text-[11px] text-slate-500 mt-0.5">{step.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}