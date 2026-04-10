import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { Plus, Pencil, Loader2, Save, Tag } from 'lucide-react';

export default function LblLineManager() {
  const queryClient = useQueryClient();
  const [editModal, setEditModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ machine_id: '', display_name: '', default_location: '', is_active: true });

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ['labelling-lines-master'],
    queryFn: () => base44.entities.Machine.filter({ machine_type: 'LABEL-LINE' }),
  });

  const openNew = () => { setForm({ machine_id: '', display_name: '', default_location: '', is_active: true }); setEditModal('new'); };
  const openEdit = (line) => { setForm({ machine_id: line.machine_id, display_name: line.display_name, default_location: line.default_location || '', is_active: line.is_active !== false }); setEditModal(line.id); };

  const handleSave = async () => {
    if (!form.machine_id.trim() || !form.display_name.trim()) { toast({ title: 'Machine ID and Display Name are required', variant: 'destructive' }); return; }
    setSaving(true);
    const data = { ...form, machine_type: 'LABEL-LINE' };
    if (editModal === 'new') {
      const exists = lines.find(l => l.machine_id.toLowerCase() === form.machine_id.trim().toLowerCase());
      if (exists) { toast({ title: 'Duplicate Machine ID', description: 'A line with this ID already exists', variant: 'destructive' }); setSaving(false); return; }
      await base44.entities.Machine.create(data);
    } else {
      await base44.entities.Machine.update(editModal, data);
    }
    queryClient.invalidateQueries({ queryKey: ['labelling-lines-master'] });
    queryClient.invalidateQueries({ queryKey: ['labelling-machines'] });
    toast({ title: editModal === 'new' ? 'Labelling Line Added' : 'Labelling Line Updated' });
    setEditModal(null);
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Labelling Lines ({lines.length})</h2>
        <Button className="h-11 md:h-9 gap-2" onClick={openNew}><Plus className="w-4 h-4" /> Add Line</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : lines.length === 0 ? (
        <div className="text-center py-8 bg-white border border-slate-200 rounded-lg"><Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-500">No labelling lines configured</p><p className="text-xs text-slate-400 mt-1">Add your first labelling line to get started</p></div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-100 text-slate-700"><th className="text-left px-4 py-3 font-medium">Machine ID</th><th className="text-left px-4 py-3 font-medium">Display Name</th><th className="text-left px-4 py-3 font-medium">Location</th><th className="text-left px-4 py-3 font-medium">Status</th><th className="px-4 py-3"></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map(line => (
                  <tr key={line.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-sm font-medium">{line.machine_id}</td>
                    <td className="px-4 py-3">{line.display_name}</td>
                    <td className="px-4 py-3 text-slate-500">{line.default_location || '—'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${line.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{line.is_active !== false ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-4 py-3"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(line)}><Pencil className="w-3.5 h-3.5" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden divide-y divide-slate-100">
            {lines.map(line => (
              <button key={line.id} className="w-full text-left p-4 hover:bg-slate-50" onClick={() => openEdit(line)}>
                <div className="flex items-center justify-between"><span className="font-mono text-sm font-semibold text-slate-900">{line.machine_id}</span><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${line.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{line.is_active !== false ? 'Active' : 'Inactive'}</span></div>
                <p className="text-sm text-slate-600 mt-0.5">{line.display_name}</p>
                {line.default_location && <p className="text-xs text-slate-400 mt-0.5">{line.default_location}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!editModal} onOpenChange={() => setEditModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editModal === 'new' ? 'Add Labelling Line' : 'Edit Labelling Line'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs font-medium text-slate-700">Machine ID</Label><Input value={form.machine_id} onChange={e => setForm(f => ({ ...f, machine_id: e.target.value }))} placeholder="e.g. LBL-01" className="h-11 md:h-9" disabled={editModal !== 'new'} /></div>
            <div className="space-y-1"><Label className="text-xs font-medium text-slate-700">Display Name</Label><Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="e.g. Labelling Line 1" className="h-11 md:h-9" /></div>
            <div className="space-y-1"><Label className="text-xs font-medium text-slate-700">Location (Optional)</Label><Input value={form.default_location} onChange={e => setForm(f => ({ ...f, default_location: e.target.value }))} placeholder="e.g. Block A" className="h-11 md:h-9" /></div>
            <div className="flex items-center justify-between"><Label className="text-xs font-medium text-slate-700">Active</Label><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /></div>
            <Button className="h-11 w-full gap-2" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}