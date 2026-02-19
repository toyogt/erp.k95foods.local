export default function WIPCounters({ counts }) {
  const items = [
    { label: 'Filling Out',   value: counts.fillingOut,   color: 'border-blue-400' },
    { label: 'In Chamber',    value: counts.inChamber,    color: 'border-orange-400' },
    { label: 'In Transit',    value: counts.inTransit,    color: 'border-teal-400' },
    { label: 'Label Line 1',  value: counts.line1,        color: 'border-pink-400' },
    { label: 'Label Line 2',  value: counts.line2,        color: 'border-rose-400' },
  ];

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5">
      <h3 className="font-semibold text-slate-900 mb-4">WIP Locations</h3>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {items.map(i => (
          <div key={i.label} className={`rounded-xl border-l-4 ${i.color} bg-slate-50 px-3 py-3`}>
            <p className="text-2xl font-black text-slate-900 tabular-nums">{i.value}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{i.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}