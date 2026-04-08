import { Truck, PackageCheck, Footprints } from 'lucide-react';

const TYPES = [
  { key: 'vehicle', label: 'Vehicle', icon: Truck },
  { key: 'courier', label: 'Courier', icon: PackageCheck },
  { key: 'on_foot', label: 'On Foot', icon: Footprints },
];

export default function TransportTypePicker({ value, onChange, labels }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-700 block mb-1.5">Transport Type</label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full h-11 border border-slate-200 rounded-xl px-3 text-base md:text-sm bg-white appearance-none focus:outline-none focus:ring-1 focus:ring-slate-400"
        >
          {TYPES.map(t => (
            <option key={t.key} value={t.key}>
              {labels?.[t.key] || t.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {(() => {
            const Icon = TYPES.find(t => t.key === value)?.icon || Truck;
            return <Icon className="w-4 h-4 text-slate-400" />;
          })()}
        </div>
      </div>
    </div>
  );
}