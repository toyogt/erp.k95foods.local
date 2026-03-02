import { useState } from 'react';
import { Button } from '@/components/ui/button';

const LINES = [
  { value: '', label: 'All Lines' },
  { value: 'LABEL-LINE-1', label: 'Line 1' },
  { value: 'LABEL-LINE-2', label: 'Line 2' },
];

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

export default function KPIFilters({ filters, onChange }) {
  function set(k, v) { onChange({ ...filters, [k]: v }); }

  return (
    <div className="flex flex-wrap gap-3 items-end bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500 font-medium">From</label>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={e => set('dateFrom', e.target.value)}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500 font-medium">To</label>
        <input
          type="date"
          value={filters.dateTo}
          onChange={e => set('dateTo', e.target.value)}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500 font-medium">Line</label>
        <select
          value={filters.line}
          onChange={e => set('line', e.target.value)}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
        >
          {LINES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500 font-medium">Operator (email)</label>
        <input
          type="text"
          value={filters.operator}
          onChange={e => set('operator', e.target.value)}
          placeholder="any"
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm w-44"
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange({
          dateFrom: formatDate(new Date(Date.now() - 7 * 86400_000)),
          dateTo: formatDate(new Date()),
          line: '',
          operator: '',
        })}
      >
        Reset
      </Button>
    </div>
  );
}