import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Loader2 } from 'lucide-react';

const empty = { primary_workstation_id: '', fallback_workstation_id: '', rank: 1, is_active: true };

export default function WorkstationFallbackManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [draft, setDraft] = useState(empty);
  const [saving, setSaving] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['workstation-fallbacks'],
    queryFn: () => base44.entities.WorkstationFallback.list('rank', 500),
  });

  const { data: workstations = [] } = useQuery({
    queryKey: ['workstations-active-fb'],
    queryFn: () => base44.entities.Workstation.filter({ is_active: true }),
  });

  const save = async () => {
    if (!draft.primary_workstation_id || !draft.fallback_workstation_id) {
      return toast({ title: 'Primary and fallback workstation are required', variant: 'destructive' });
    }
    if (draft.primary_workstation_id === draft.fallback_workstation_id) {
      return toast({ title: 'Primary and fallback cannot be the same', variant: 'destructive' });
    }
    setSaving(true);
    try {
      const dup = rows.find(r => r.primary_workstation_id === draft.primary_workstation_id && r.fallback_workstation_id === draft.fallback_workstation_id);
      const payload = { ...draft, rank: parseInt(draft.rank, 10) || 1 };
      if (dup) await base44.entities.WorkstationFallback.update(dup.id, payload);
      else await base44.entities.WorkstationFallback.create(payload);
      setDraft(empty);
      qc.invalidateQueries({ queryKey: ['workstation-fallbacks'] });
      toast({ title: 'Fallback rule saved' });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const remove = async (r) => {
    if (!confirm('Delete this fallback rule?')) return;
    await base44.entities.WorkstationFallback.delete(r.id);
    qc.invalidateQueries({ queryKey: ['workstation-fallbacks'] });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-slate-900">Fallback Routing Rules</h3>
      <p className="text-xs text-slate-500">When a primary workstation has no available printer, the routing engine tries fallback workstations in ascending rank order.</p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <div>
          <Label className="text-xs font-medium text-slate-700">Primary</Label>
          <Select value={draft.primary_workstation_id || '__none__'} onValueChange={v => setDraft({ ...draft, primary_workstation_id: v === '__none__' ? '' : v })}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Select…</SelectItem>
              {workstations.map(w => <SelectItem key={w.workstation_id} value={w.workstation_id}>{w.display_name} ({w.workstation_id})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Fallback</Label>
          <Select value={draft.fallback_workstation_id || '__none__'} onValueChange={v => setDraft({ ...draft, fallback_workstation_id: v === '__none__' ? '' : v })}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Select…</SelectItem>
              {workstations.map(w => <SelectItem key={w.workstation_id} value={w.workstation_id}>{w.display_name} ({w.workstation_id})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Rank</Label>
          <Input type="number" min={1} max={999} className="h-9 text-sm" value={draft.rank} onChange={e => setDraft({ ...draft, rank: e.target.value })} />
        </div>
        <div className="flex items-end"><Button className="h-9 gap-2 w-full" onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Save</Button></div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Primary</th>
              <th className="text-left px-3 py-2 font-medium">Fallback</th>
              <th className="text-left px-3 py-2 font-medium">Rank</th>
              <th className="text-left px-3 py-2 font-medium">Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? <tr><td colSpan={5} className="text-center py-6"><Loader2 className="w-5 h-5 inline animate-spin text-slate-400" /></td></tr>
              : rows.length === 0 ? <tr><td colSpan={5} className="text-center py-6 text-slate-500">No fallback rules</td></tr>
              : rows.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">{r.primary_workstation_id}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.fallback_workstation_id}</td>
                  <td className="px-3 py-2">{r.rank}</td>
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