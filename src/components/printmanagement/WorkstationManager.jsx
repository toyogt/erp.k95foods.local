import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Loader2 } from 'lucide-react';

const empty = { workstation_id: '', display_name: '', location: '', department: '', is_active: true };

export default function WorkstationManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['workstations-all'],
    queryFn: () => base44.entities.Workstation.list('-created_date', 500),
  });
  const [draft, setDraft] = useState(empty);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!draft.workstation_id || !draft.display_name || !draft.location) {
      return toast({ title: 'workstation_id, display_name and location are required', variant: 'destructive' });
    }
    setSaving(true);
    try {
      const dup = rows.find(r => r.workstation_id === draft.workstation_id);
      if (dup) await base44.entities.Workstation.update(dup.id, draft);
      else await base44.entities.Workstation.create(draft);
      setDraft(empty);
      qc.invalidateQueries({ queryKey: ['workstations-all'] });
      toast({ title: 'Workstation saved' });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const remove = async (r) => {
    if (!confirm(`Delete workstation ${r.workstation_id}?`)) return;
    await base44.entities.Workstation.delete(r.id);
    qc.invalidateQueries({ queryKey: ['workstations-all'] });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-slate-900">Workstations</h3>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <div><Label className="text-xs font-medium text-slate-700">ID</Label><Input className="h-9 text-sm" value={draft.workstation_id} onChange={e => setDraft({ ...draft, workstation_id: e.target.value })} /></div>
        <div><Label className="text-xs font-medium text-slate-700">Display Name</Label><Input className="h-9 text-sm" value={draft.display_name} onChange={e => setDraft({ ...draft, display_name: e.target.value })} /></div>
        <div><Label className="text-xs font-medium text-slate-700">Location</Label><Input className="h-9 text-sm" value={draft.location} onChange={e => setDraft({ ...draft, location: e.target.value })} /></div>
        <div><Label className="text-xs font-medium text-slate-700">Department</Label><Input className="h-9 text-sm" value={draft.department} onChange={e => setDraft({ ...draft, department: e.target.value })} /></div>
        <div className="flex items-end"><Button className="h-9 gap-2 w-full" onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Save</Button></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr><th className="text-left px-3 py-2 font-medium">ID</th><th className="text-left px-3 py-2 font-medium">Name</th><th className="text-left px-3 py-2 font-medium">Location</th><th className="text-left px-3 py-2 font-medium">Active</th><th></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? <tr><td colSpan={5} className="text-center py-6"><Loader2 className="w-5 h-5 inline animate-spin text-slate-400" /></td></tr>
              : rows.length === 0 ? <tr><td colSpan={5} className="text-center py-6 text-slate-500">No workstations</td></tr>
              : rows.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">{r.workstation_id}</td>
                  <td className="px-3 py-2">{r.display_name}</td>
                  <td className="px-3 py-2 text-slate-600">{r.location}</td>
                  <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{r.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-3 py-2 text-right"><Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="w-4 h-4 text-red-600" /></Button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}