import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { Plus, Pencil, Loader2, Save, Tag, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const EDIT_ROLES = ['admin', 'production_manager', 'labelling_supervisor', 'lbl_supervisor'];

export default function LblLineManager({ userRole = 'user' }) {
  const queryClient = useQueryClient();
  const [editModal, setEditModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ machine_id: '', display_name: '', default_location: '', is_active: true });
  const canEdit = EDIT_ROLES.includes(userRole);

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ['labelling-lines-master'],
    queryFn: () => base44.entities.Machine.filter({ machine_type: 'LABEL-LINE' }),
  });

  const autoId = (name) => {
    const words = name.trim().split(/\s+/);
    if (words.length <= 1) return words[0]?.toUpperCase().replace(/[^A-Z0-9]/g, '') || '';
    const lastWord = words[words.length - 1];
    const isLastNum = /^\d+$/.test(lastWord);
    const initials = words.slice(0, isLastNum ? words.length - 1 : words.length).map(w => w[0]?.toUpperCase()).join('');
    return isLastNum ? `${initials}-${lastWord}` : initials;
  };
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await base44.entities.Machine.delete(deleteTarget);
    queryClient.invalidateQueries({ queryKey: ['labelling-lines-master'] });
    queryClient.invalidateQueries({ queryKey: ['labelling-machines'] });
    toast({ title: 'Labelling Line Deleted' });
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Labelling Lines ({lines.length})</h2>
        {canEdit && <Button className="h-11 md:h-9 gap-2" onClick={openNew}><Plus className="w-4 h-4" /> Add Line</Button>}
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
                    <td className="px-4 py-3 flex items-center gap-1">
                      {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(line)}><Pencil className="w-3.5 h-3.5" /></Button>}
                      {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteTarget(line.id)}><Trash2 className="w-3.5 h-3.5" /></Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden divide-y divide-slate-100">
            {lines.map(line => (
              <button key={line.id} className="w-full text-left p-4 hover:bg-slate-50" onClick={() => canEdit && openEdit(line)}>
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
            <div className="space-y-1"><Label className="text-xs font-medium text-slate-700">Display Name</Label><Input value={form.display_name} onChange={e => { const name = e.target.value; setForm(f => ({ ...f, display_name: name, ...(editModal === 'new' ? { machine_id: autoId(name) } : {}) })); }} placeholder="e.g. Labelling Line 1" className="h-11 md:h-9" /></div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Machine ID</Label>
              <Input
                value={form.machine_id}
                onChange={e => setForm(f => ({ ...f, machine_id: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') }))}
                className="h-11 md:h-9 font-mono"
                placeholder="e.g. LL-1"
              />
              {editModal === 'new' && <p className="text-xs text-slate-500">Auto-generated from display name — you can edit it</p>}
            </div>
            <div className="space-y-1"><Label className="text-xs font-medium text-slate-700">Location (Optional)</Label><Input value={form.default_location} onChange={e => setForm(f => ({ ...f, default_location: e.target.value }))} placeholder="e.g. Block A" className="h-11 md:h-9" /></div>
            <div className="flex items-center justify-between"><Label className="text-xs font-medium text-slate-700">Active</Label><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /></div>
            <Button className="h-11 w-full gap-2" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Labelling Line?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. Any jobs referencing this line will remain but the line will be removed from selection.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 md:h-9">Cancel</AlertDialogCancel>
            <AlertDialogAction className="h-11 md:h-9 bg-red-600 hover:bg-red-700" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}