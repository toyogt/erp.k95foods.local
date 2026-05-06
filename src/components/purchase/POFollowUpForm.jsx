import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

const EMPTY = { follow_up_date: '', follow_up_mode: 'Call', contact_person: '' };

export default function POFollowUpForm({ followUps, onChange }) {
  function addEntry() { onChange([...followUps, { ...EMPTY }]); }
  function removeEntry(i) { onChange(followUps.filter((_, idx) => idx !== i)); }
  function updateEntry(i, updates) { onChange(followUps.map((f, idx) => idx === i ? { ...f, ...updates } : f)); }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-700">Follow-Up Schedule</p>
      {followUps.map((f, i) => (
        <div key={i} className="flex items-end gap-2 border border-slate-100 rounded-xl p-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-slate-700">Date</label>
            <input type="date" className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm" value={f.follow_up_date} onChange={e => updateEntry(i, { follow_up_date: e.target.value })} />
          </div>
          <div className="w-28 space-y-1">
            <label className="text-xs font-medium text-slate-700">Mode</label>
            <select className="w-full h-9 border border-slate-200 rounded-lg px-2 text-sm bg-white" value={f.follow_up_mode} onChange={e => updateEntry(i, { follow_up_mode: e.target.value })}>
              <option value="Call">Call</option><option value="Email">Email</option><option value="WhatsApp">WhatsApp</option>
            </select>
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-slate-700">Contact Person</label>
            <input className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm" value={f.contact_person} onChange={e => updateEntry(i, { contact_person: e.target.value })} placeholder="Name" />
          </div>
          <button onClick={() => removeEntry(i)} className="text-red-400 hover:text-red-600 p-2"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <button onClick={addEntry} className="text-sm text-blue-600 font-medium flex items-center gap-1"><Plus className="w-4 h-4" /> Add Follow-Up</button>
    </div>
  );
}