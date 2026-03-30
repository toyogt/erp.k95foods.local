import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Zap, Loader2, ChevronDown } from 'lucide-react';

/**
 * Reusable bulk action bar.
 * Props:
 *   selectedCount — number of selected rows
 *   onClearSelection — fn to clear all
 *   actions — [{ label, key, type: 'select'|'text', options: [{value, label}] }]
 *   onApply — fn(key, value) called when user clicks Apply
 *   applying — boolean loading state
 */
export default function BulkActionBar({ selectedCount, onClearSelection, actions = [], onApply, applying }) {
  const [activeAction, setActiveAction] = useState(null); // key of open action
  const [value, setValue] = useState('');

  if (selectedCount === 0) return null;

  function handleApply() {
    if (!activeAction || value === '') return;
    onApply(activeAction, value);
    setActiveAction(null);
    setValue('');
  }

  const action = actions.find(a => a.key === activeAction);

  return (
    <div className="sticky bottom-4 z-40 mx-auto max-w-5xl px-2">
      <div className="bg-slate-900 text-white rounded-xl shadow-2xl px-4 py-3 flex flex-wrap items-center gap-3">
        {/* Count + clear */}
        <div className="flex items-center gap-2 mr-1">
          <span className="text-sm font-semibold">{selectedCount} selected</span>
          <button onClick={onClearSelection} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 flex-1">
          {actions.map(a => (
            <button
              key={a.key}
              onClick={() => { setActiveAction(activeAction === a.key ? null : a.key); setValue(''); }}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                activeAction === a.key
                  ? 'bg-white text-slate-900'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
              }`}
            >
              {a.label}
              <ChevronDown className={`w-3 h-3 transition-transform ${activeAction === a.key ? 'rotate-180' : ''}`} />
            </button>
          ))}
        </div>

        {/* Inline value picker */}
        {action && (
          <div className="flex items-center gap-2 border-l border-slate-700 pl-3">
            <span className="text-xs text-slate-400 whitespace-nowrap">{action.label}:</span>
            {action.type === 'select' ? (
              <select
                className="h-8 rounded-md bg-slate-700 text-white text-xs border border-slate-600 px-2 min-w-[140px]"
                value={value}
                onChange={e => setValue(e.target.value)}
                autoFocus
              >
                <option value="">— Select —</option>
                {action.options?.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="h-8 rounded-md bg-slate-700 text-white text-xs border border-slate-600 px-2 w-36"
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder={`Enter ${action.label.toLowerCase()}...`}
                autoFocus
              />
            )}
            <Button
              size="sm"
              className="h-8 bg-white text-slate-900 hover:bg-slate-100 text-xs px-3"
              onClick={handleApply}
              disabled={!value || applying}
            >
              {applying ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Zap className="w-3 h-3 mr-1" />Apply</>}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}