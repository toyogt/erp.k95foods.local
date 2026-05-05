import { useState, useRef, useEffect } from 'react';
import { Pencil, Check, X } from 'lucide-react';

/**
 * Inline-editable cell — supports "number" (small numeric input) and "text" (textarea) modes.
 */
export default function MeetingPlanCell({ value, onSave, editable = true, placeholder = '—', mode = 'text' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const ref = useRef(null);

  useEffect(() => { setDraft(value ?? ''); }, [value]);
  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

  const handleSave = () => {
    setEditing(false);
    const newVal = mode === 'number' ? (Number(draft) || 0) : draft.toString().trim();
    const oldVal = mode === 'number' ? (Number(value) || 0) : (value || '').toString().trim();
    if (newVal !== oldVal) onSave(newVal);
  };

  const handleCancel = () => { setDraft(value ?? ''); setEditing(false); };

  if (editing) {
    if (mode === 'number') {
      return (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <input
            ref={ref}
            type="number"
            min={0}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="w-14 h-8 border border-slate-300 rounded px-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
          />
          <button onClick={handleSave} className="p-0.5 rounded hover:bg-green-100 text-green-600"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={handleCancel} className="p-0.5 rounded hover:bg-red-100 text-red-500"><X className="w-3.5 h-3.5" /></button>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-1 min-w-[180px]" onClick={e => e.stopPropagation()}>
        <textarea
          ref={ref}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[60px]"
          rows={3}
          onKeyDown={e => { if (e.key === 'Escape') handleCancel(); }}
        />
        <div className="flex gap-1 justify-end">
          <button onClick={handleSave} className="p-1 rounded hover:bg-green-100 text-green-600"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={handleCancel} className="p-1 rounded hover:bg-red-100 text-red-500"><X className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    );
  }

  // Display mode
  if (mode === 'number') {
    const displayVal = Number(value) || 0;
    return (
      <div
        className={`group flex items-center justify-center gap-1 ${editable ? 'cursor-pointer' : ''}`}
        onClick={e => { if (editable) { e.stopPropagation(); setEditing(true); } }}
      >
        <span className={`text-sm font-semibold ${displayVal > 0 ? 'text-slate-900' : 'text-slate-300'}`}>{displayVal}</span>
        {editable && <Pencil className="w-3 h-3 text-slate-200 group-hover:text-slate-500 shrink-0" />}
      </div>
    );
  }

  return (
    <div
      className={`group flex items-start gap-1 min-w-[140px] max-w-[220px] ${editable ? 'cursor-pointer' : ''}`}
      onClick={e => { if (editable) { e.stopPropagation(); setEditing(true); } }}
    >
      <span className={`text-sm leading-snug whitespace-pre-wrap ${value ? 'text-slate-700' : 'text-slate-400 italic'}`}>
        {value || placeholder}
      </span>
      {editable && <Pencil className="w-3 h-3 text-slate-300 group-hover:text-slate-500 shrink-0 mt-0.5" />}
    </div>
  );
}