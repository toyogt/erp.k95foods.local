import { CalendarClock, Clock } from 'lucide-react';

const strategies = [
  { id: 'FEFO', label: 'First Expired, First Out', desc: 'Picks lots with earliest expiry date first', icon: CalendarClock, color: 'border-orange-300 bg-orange-50 text-orange-700' },
  { id: 'FIFO', label: 'First In, First Out', desc: 'Picks lots received earliest first', icon: Clock, color: 'border-blue-300 bg-blue-50 text-blue-700' },
];

export default function PickingStrategySelector({ value, onChange }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-700">Picking Strategy</p>
      <div className="grid grid-cols-2 gap-2">
        {strategies.map(s => {
          const Icon = s.icon;
          const active = value === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                active ? s.color + ' ring-1 ring-offset-1' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">{s.id}</p>
                <p className="text-xs opacity-70">{s.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}