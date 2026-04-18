/**
 * PageSizePanel
 * Lets the user choose a preset page size or enter custom dimensions.
 */
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const PRESETS = [
  { label: 'A4',          width: 210, height: 297, unit: 'mm' },
  { label: 'A5',          width: 148, height: 210, unit: 'mm' },
  { label: '4×6 in',      width: 101, height: 152, unit: 'mm' },
  { label: '100×150 mm',  width: 100, height: 150, unit: 'mm' },
  { label: '60×40 mm',    width: 60,  height: 40,  unit: 'mm' },
  { label: '50×30 mm',    width: 50,  height: 30,  unit: 'mm' },
  { label: 'Custom',      width: null, height: null, unit: 'mm' },
];

export default function PageSizePanel({ pageSize, onChange }) {
  const isCustom = !PRESETS.slice(0, -1).some(
    p => p.width === pageSize.width && p.height === pageSize.height
  );

  const applyPreset = (p) => {
    if (p.width !== null) onChange({ width: p.width, height: p.height, unit: 'mm' });
  };

  return (
    <div className="p-4 space-y-3 border-b border-slate-200">
      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Page Size</p>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map(p => {
          const active = p.label === 'Custom'
            ? isCustom
            : p.width === pageSize.width && p.height === pageSize.height;
          return (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className={`px-2 py-1 rounded text-xs border transition-colors ${
                active
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'border-slate-200 text-slate-600 hover:border-purple-400 hover:text-purple-700'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Width (mm)</Label>
          <Input
            type="number"
            value={pageSize.width}
            min={10}
            max={500}
            onChange={e => onChange({ ...pageSize, width: parseFloat(e.target.value) || 0 })}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Height (mm)</Label>
          <Input
            type="number"
            value={pageSize.height}
            min={10}
            max={500}
            onChange={e => onChange({ ...pageSize, height: parseFloat(e.target.value) || 0 })}
            className="h-8 text-xs"
          />
        </div>
      </div>
    </div>
  );
}