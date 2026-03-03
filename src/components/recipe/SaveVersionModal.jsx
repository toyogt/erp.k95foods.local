import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function SaveVersionModal({ currentVersionNo, onSave, onCancel }) {
  const [changeNote, setChangeNote] = useState('');
  const [versionName, setVersionName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!changeNote.trim()) return;
    setSaving(true);
    await onSave({ changeNote: changeNote.trim(), versionName: versionName.trim() });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800">Save as New Version</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
            This will create <strong>Version {(currentVersionNo || 0) + 1}</strong>. The previous version will be archived.
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Change Note <span className="text-red-500">*</span></label>
            <textarea
              autoFocus
              className="w-full h-20 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
              placeholder="Why are you changing this recipe? (required)"
              value={changeNote}
              onChange={e => setChangeNote(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Version Name (optional)</label>
            <input
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
              placeholder="e.g. Summer 2026 Formula"
              value={versionName}
              onChange={e => setVersionName(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button size="sm" disabled={!changeNote.trim() || saving} onClick={handleSave} className="ml-auto">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Version'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}