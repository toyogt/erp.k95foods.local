import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * Generic 2-step Replace Wizard modal.
 *
 * Props:
 *  title          – modal title
 *  oldItem        – the item being replaced  { label, id }
 *  options        – array of { value, label } for the "replace with" dropdown
 *  previewLines   – array of strings describing what will change
 *  onConfirm(newValue) – async fn that performs the migration; receives selected option value
 *  onClose        – fn to close the modal
 */
export default function ReplaceWizard({ title, oldItem, options, previewLines, onConfirm, onClose }) {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState('');
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState('');
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState('');

  const filtered = options.filter(o =>
    !search || o.label.toLowerCase().includes(search.toLowerCase())
  );

  async function execute() {
    if (confirm !== 'REPLACE') return;
    setRunning(true);
    const result = await onConfirm(selected);
    setSummary(result || 'Migration complete.');
    setDone(true);
    setRunning(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>

        <div className="p-6 space-y-4">
          {done ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
                <span className="font-semibold">Migration complete</span>
              </div>
              <p className="text-sm text-slate-600">{summary}</p>
              <Button onClick={onClose} className="w-full mt-2">Close</Button>
            </div>
          ) : step === 1 ? (
            <>
              <div className="text-sm text-slate-600">
                Replacing: <span className="font-semibold text-slate-800">{oldItem.label}</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Search replacement</label>
                <input
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500 mb-2"
                  placeholder="Type to filter…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {filtered.length === 0 && <p className="text-xs text-slate-400 p-3">No options found.</p>}
                  {filtered.map(o => (
                    <button
                      key={o.value}
                      onClick={() => setSelected(o.value)}
                      className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${selected === o.value ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-slate-50 text-slate-700'}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              {selected && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
                  <p className="text-xs font-semibold text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Preview of changes</p>
                  {previewLines(selected).map((line, i) => (
                    <p key={i} className="text-xs text-amber-800">• {line}</p>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
                <Button size="sm" disabled={!selected} onClick={() => setStep(2)} className="gap-1.5 ml-auto">
                  Next <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm font-semibold text-red-700">⚠️ This action cannot be undone.</p>
                <p className="text-xs text-red-600 mt-1">All references will be updated to the new value, and the old item will be deactivated.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Type <span className="font-mono bg-slate-100 px-1">REPLACE</span> to confirm</label>
                <input
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:border-red-500"
                  placeholder="REPLACE"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <Button
                  size="sm"
                  disabled={confirm !== 'REPLACE' || running}
                  onClick={execute}
                  className="gap-1.5 ml-auto bg-red-600 hover:bg-red-700"
                >
                  {running ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Replace'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}