import { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronDown, Plus, Loader2, X } from 'lucide-react';

/**
 * CreatableSelect — combined searchable dropdown + free-text + create-new.
 *
 * Props:
 *   value          — current selected string
 *   onChange(val)  — called when user picks or creates a value
 *   options        — array of { value, label } (or string[])
 *   onCreate(text) — async fn that persists a new option; must return the new value (string)
 *   placeholder    — input placeholder
 *   loading        — show a small spinner in dropdown
 *   disabled
 *   className      — applied to the trigger button
 */
export default function CreatableSelect({
  value = '',
  onChange,
  options = [],
  onCreate,
  placeholder = 'Type to search or add new',
  loading = false,
  disabled = false,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  // Normalize options to {value, label}
  const norm = useMemo(
    () => (options || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o)),
    [options]
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q ? norm.filter((o) => o.label.toLowerCase().includes(q)) : norm;
  const exactMatch = norm.some((o) => o.label.toLowerCase() === q);
  const canCreate = !!q && !exactMatch && !!onCreate;

  const handlePick = (val) => {
    onChange?.(val);
    setOpen(false);
    setQuery('');
  };

  const handleCreate = async () => {
    if (!q || creating) return;
    setCreating(true);
    try {
      const newVal = await onCreate(query.trim());
      if (newVal) handlePick(newVal);
    } finally {
      setCreating(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length === 1) handlePick(filtered[0].value);
      else if (canCreate) handleCreate();
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`flex h-11 md:h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-base md:text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        <span className={`truncate ${value ? 'text-slate-900' : 'text-muted-foreground'}`}>
          {value || placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
            <X
              className="w-4 h-4 text-slate-400 hover:text-slate-700"
              onClick={(e) => { e.stopPropagation(); onChange?.(''); }}
            />
          )}
          <ChevronDown className="w-4 h-4 opacity-50" />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="p-2 border-b border-slate-100">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type to search or add new"
              className="w-full h-9 px-2 text-sm bg-transparent border-0 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {loading && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
              </div>
            )}

            {!loading && filtered.length === 0 && !canCreate && (
              <div className="px-3 py-2 text-sm text-slate-500">No results</div>
            )}

            {!loading && filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => handlePick(o.value)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-slate-50"
              >
                <span className="text-slate-900 truncate">{o.label}</span>
                {value === o.value && <Check className="w-4 h-4 text-slate-700 shrink-0" />}
              </button>
            ))}

            {canCreate && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left border-t border-slate-100 hover:bg-slate-50 text-slate-700"
              >
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Add &ldquo;<span className="font-medium">{query.trim()}</span>&rdquo;</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}