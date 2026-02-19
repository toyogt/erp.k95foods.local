import { Package, Box, FlaskConical, ClipboardList } from 'lucide-react';

export default function LiveCounters({ crates, pallets, batches, jobs }) {
  const counters = [
    { label: 'Active Crates', value: crates, icon: Box, color: 'bg-blue-600' },
    { label: 'Open Pallets', value: pallets, icon: Package, color: 'bg-indigo-600' },
    { label: 'Batches Today', value: batches, icon: FlaskConical, color: 'bg-amber-600' },
    { label: 'Active Jobs', value: jobs, icon: ClipboardList, color: 'bg-emerald-600' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {counters.map((c) => (
        <div key={c.label} className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-9 h-9 rounded-lg ${c.color} flex items-center justify-center`}>
              <c.icon className="w-4.5 h-4.5 text-white" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{c.value}</div>
          <div className="text-xs text-slate-500 mt-0.5">{c.label}</div>
        </div>
      ))}
    </div>
  );
}