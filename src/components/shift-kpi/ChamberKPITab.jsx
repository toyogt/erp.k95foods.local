export default function ChamberKPITab() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-2xl">🏭</div>
      <p className="text-slate-600 font-semibold">Chamber KPIs</p>
      <p className="text-sm text-slate-400 max-w-xs">
        Coming in Prompt 18 — will show cycle counts, average cycle duration, abort rate, and downtime by category per chamber machine.
      </p>
    </div>
  );
}