export default function StepProgressBar({ currentStep, totalSteps, stepLabel, completionText }) {
  const progress = ((currentStep) / totalSteps) * 100;

  return (
    <div className="space-y-2">
      {/* Progress dots / bar */}
      <div className="flex gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full flex-1 transition-all duration-300 ${
              i <= currentStep ? 'bg-blue-600' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
      {/* Step label */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-900">
          Step {currentStep + 1} — {stepLabel}
        </p>
        {completionText && (
          <p className="text-xs text-slate-500">{completionText}</p>
        )}
      </div>
    </div>
  );
}