/**
 * Kiosk Layout
 * Shared terminal mode with center-focused content
 */

export default function KioskLayout({
  children,
  title,
  step,
  totalSteps,
  backButton = null,
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 text-center border-b-2 border-amber-500">
        {step && totalSteps && (
          <p className="text-sm font-medium text-amber-400 mb-2">
            Step {step} of {totalSteps}
          </p>
        )}
        {title && <h1 className="text-3xl font-bold">{title}</h1>}
      </div>

      {/* Content - centered */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl p-8 space-y-8">
          {children}
        </div>
      </div>

      {/* Footer navigation */}
      {backButton && (
        <div className="bg-slate-900 border-t border-slate-700 p-6 flex justify-center">
          {backButton}
        </div>
      )}

      {/* Bottom hint */}
      <div className="bg-slate-950 text-white text-center text-xs py-3">
        Kiosk Mode • Follow on-screen instructions
      </div>
    </div>
  );
}