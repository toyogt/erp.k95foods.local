import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FlaskConical } from 'lucide-react';

export default function WhileChecks({ onSubmit }) {
  const [form, setForm] = useState({ brix: '', ph: '', temp: '', notes: '' });

  const f = (field, val) => setForm(p => ({ ...p, [field]: val }));
  const valid = form.brix && form.ph && form.temp;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-rose-500" /> In-Process QC
        </h3>

        {[
          { label: 'Brix (°Bx)', key: 'brix', placeholder: 'e.g. 12.5' },
          { label: 'pH',         key: 'ph',   placeholder: 'e.g. 3.8' },
          { label: 'Temp (°C)',  key: 'temp', placeholder: 'e.g. 20' },
        ].map(({ label, key, placeholder }) => (
          <div key={key}>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">{label}</label>
            <Input
              type="number"
              step="0.01"
              placeholder={placeholder}
              value={form[key]}
              onChange={e => f(key, e.target.value)}
              className="h-14 text-xl text-center font-bold rounded-xl"
            />
          </div>
        ))}

        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-1.5">Notes (optional)</label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={e => f('notes', e.target.value)}
            placeholder="Any observations…"
            className="w-full rounded-xl border border-slate-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
      </div>

      <Button
        onClick={() => onSubmit(form)}
        disabled={!valid}
        className="w-full h-16 rounded-2xl text-lg font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-40"
      >
        Save QC Readings
      </Button>
    </div>
  );
}