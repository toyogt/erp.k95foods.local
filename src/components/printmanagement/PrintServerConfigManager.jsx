import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Loader2, Activity, Pencil, X } from 'lucide-react';

const empty = {
  print_server_config_id: '',
  workstation_id: '',
  base_url: '',
  auth_token_secret_name: '',
  request_timeout_ms: 1200,
  heartbeat_stale_seconds: 45,
  is_active: true,
  description: '',
};

export default function PrintServerConfigManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [draft, setDraft] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [probingId, setProbingId] = useState(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['print-server-configs'],
    queryFn: () => base44.entities.PrintServerConfig.list('-created_date', 500),
  });

  const { data: workstations = [] } = useQuery({
    queryKey: ['workstations-active'],
    queryFn: () => base44.entities.Workstation.filter({ is_active: true }),
  });

  const save = async () => {
    if (!draft.print_server_config_id || !draft.workstation_id || !draft.base_url || !draft.auth_token_secret_name) {
      return toast({ title: 'All required fields must be filled', variant: 'destructive' });
    }
    try { new URL(draft.base_url); } catch { return toast({ title: 'Invalid base_url', variant: 'destructive' }); }
    setSaving(true);
    try {
      const dup = rows.find(r => r.print_server_config_id === draft.print_server_config_id);
      const payload = {
        ...draft,
        request_timeout_ms: parseInt(draft.request_timeout_ms, 10) || 1200,
        heartbeat_stale_seconds: parseInt(draft.heartbeat_stale_seconds, 10) || 45,
      };
      if (dup) await base44.entities.PrintServerConfig.update(dup.id, payload);
      else await base44.entities.PrintServerConfig.create(payload);
      setDraft(empty);
      qc.invalidateQueries({ queryKey: ['print-server-configs'] });
      toast({ title: 'Configuration saved' });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const remove = async (r) => {
    if (!confirm(`Delete config ${r.print_server_config_id}?`)) return;
    await base44.entities.PrintServerConfig.delete(r.id);
    qc.invalidateQueries({ queryKey: ['print-server-configs'] });
  };

  const startEdit = (r) => {
    setDraft({
      print_server_config_id: r.print_server_config_id || '',
      workstation_id: r.workstation_id || '',
      base_url: r.base_url || '',
      auth_token_secret_name: r.auth_token_secret_name || '',
      request_timeout_ms: r.request_timeout_ms ?? 1200,
      heartbeat_stale_seconds: r.heartbeat_stale_seconds ?? 45,
      is_active: r.is_active ?? true,
      description: r.description || '',
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => setDraft(empty);
  const isEditing = !!rows.find(r => r.print_server_config_id === draft.print_server_config_id);

  const probe = async (r) => {
    setProbingId(r.id);
    try {
      const res = await base44.functions.invoke('printProbeWorkstation', { workstation_id: r.workstation_id });
      const d = res.data;
      toast({
        title: d.ok ? 'Probe OK' : 'Probe failed',
        description: d.ok ? `Latency ${d.probe_latency_ms} ms` : (d.probe_error || d.error || 'Unknown'),
        variant: d.ok ? 'default' : 'destructive',
      });
    } catch (e) {
      toast({ title: 'Probe failed', description: e.message, variant: 'destructive' });
    } finally { setProbingId(null); }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Print Server Configurations {isEditing && <span className="ml-2 text-xs font-normal text-amber-600">(editing {draft.print_server_config_id})</span>}</h3>
        {isEditing && (
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={cancelEdit}>
            <X className="w-3.5 h-3.5" /> Cancel edit
          </Button>
        )}
      </div>
      <p className="text-xs text-slate-500">Maps a workstation to its print agent base URL. Token is resolved server-side from the named environment variable — never exposed to the browser.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        <div><Label className="text-xs font-medium text-slate-700">Config ID</Label><Input className="h-9 text-sm" value={draft.print_server_config_id} onChange={e => setDraft({ ...draft, print_server_config_id: e.target.value })} disabled={isEditing} /></div>
        <div><Label className="text-xs font-medium text-slate-700">Workstation ID</Label><Input className="h-9 text-sm" placeholder="must match a Workstation" list="ws-options" value={draft.workstation_id} onChange={e => setDraft({ ...draft, workstation_id: e.target.value })} /><datalist id="ws-options">{workstations.map(w => <option key={w.workstation_id} value={w.workstation_id}>{w.display_name}</option>)}</datalist></div>
        <div className="md:col-span-2"><Label className="text-xs font-medium text-slate-700">Base URL</Label><Input className="h-9 text-sm font-mono" placeholder="http://192.168.1.100:8089" value={draft.base_url} onChange={e => setDraft({ ...draft, base_url: e.target.value })} /></div>
        <div className="md:col-span-2"><Label className="text-xs font-medium text-slate-700">Auth Token Secret Name</Label><Input className="h-9 text-sm font-mono" placeholder="PRINT_AGENT_TOKEN_PACK_01" value={draft.auth_token_secret_name} onChange={e => setDraft({ ...draft, auth_token_secret_name: e.target.value })} /><p className="text-xs text-slate-500 mt-1">Name of an environment variable holding X-Auth-Token</p></div>
        <div><Label className="text-xs font-medium text-slate-700">Timeout (ms)</Label><Input type="number" className="h-9 text-sm" value={draft.request_timeout_ms} onChange={e => setDraft({ ...draft, request_timeout_ms: e.target.value })} /></div>
        <div><Label className="text-xs font-medium text-slate-700">Heartbeat Stale (s)</Label><Input type="number" className="h-9 text-sm" value={draft.heartbeat_stale_seconds} onChange={e => setDraft({ ...draft, heartbeat_stale_seconds: e.target.value })} /></div>
        <div className="md:col-span-3"><Label className="text-xs font-medium text-slate-700">Description</Label><Input className="h-9 text-sm" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></div>
        <div className="flex items-end"><Button className="h-9 gap-2 w-full" onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEditing ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />)} {isEditing ? 'Update' : 'Save'}</Button></div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Config</th>
              <th className="text-left px-3 py-2 font-medium">Workstation</th>
              <th className="text-left px-3 py-2 font-medium">Base URL</th>
              <th className="text-left px-3 py-2 font-medium">Token Secret</th>
              <th className="text-left px-3 py-2 font-medium">Timeouts</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? <tr><td colSpan={6} className="text-center py-6"><Loader2 className="w-5 h-5 inline animate-spin text-slate-400" /></td></tr>
              : rows.length === 0 ? <tr><td colSpan={6} className="text-center py-6 text-slate-500">No configurations</td></tr>
              : rows.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">{r.print_server_config_id}</td>
                  <td className="px-3 py-2 text-xs">{r.workstation_id}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{r.base_url}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{r.auth_token_secret_name}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{r.request_timeout_ms}ms / {r.heartbeat_stale_seconds}s</td>
                  <td className="px-3 py-2 text-right space-x-1 whitespace-nowrap">
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => probe(r)} disabled={probingId === r.id}>
                      {probingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />} Probe
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => startEdit(r)}>
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}