import { Truck, PackageCheck, Footprints } from 'lucide-react';

const TYPES = [
  { key: 'vehicle', icon: Truck },
  { key: 'courier', icon: PackageCheck },
  { key: 'on_foot', icon: Footprints },
];

export default function TransportTypePicker({ value, onChange, labels }) {
  return (
    <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
      {TYPES.map(t => {
        const active = value === t.key;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-all ${
              active
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200 rounded-xl -m-px z-10'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {labels?.[t.key] || t.key}
          </button>
        );
      })}
    </div>
  );
}