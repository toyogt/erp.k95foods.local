import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Loader2, Cog } from 'lucide-react';
import { logAudit } from '@/components/AuditLogger';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function MachineManager({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ machine_id: '', display_name: '', default_location: '', machine_type: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const data = await base44.entities.Machine.list('machine_id');
    setItems(data);
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.machine_id || !form.display_name) return;
    await base44.entities.Machine.create({ ...form, qr_code: form.machine_id, is_active: true });
    await logAudit({ action: 'Created machine: ' + form.machine_id, entity_type: 'Machine', entity_id: form.machine_id, user });
    setForm({ machine_id: '', display_name: '', default_location: '', machine_type: '' });
    setOpen(false);
    load();
  }

  async function handleDelete(item) {
    await base44.entities.Machine.delete(item.id);
    await logAudit({ action: 'Deleted machine: ' + item.machine_id, entity_type: 'Machine', entity_id: item.machine_id, user });
    load();
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const typeColors = {
    'FILLER': 'bg-blue-100 text-blue-700',
    'CHAMBER': 'bg-orange-100 text-orange-700',
    'LABEL-LINE': 'bg-pink-100 text-pink-700',
    'RECIPE-ROOM': 'bg-rose-100 text-rose-700',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Cog className="w-5 h-5" /> Machines / Stations
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-xl gap-1.5 h-10 px-4">
              <Plus className="w-4 h-4" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Machine</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Machine ID</Label>
                <Input placeholder="e.g. FILLER-1" value={form.machine_id} onChange={e => setForm({ ...form, machine_id: e.target.value })} className="mt-1 rounded-xl h-12" />
              </div>
              <div>
                <Label>Display Name</Label>
                <Input placeholder="e.g. Filler Line 1" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} className="mt-1 rounded-xl h-12" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.machine_type} onValueChange={v => setForm({ ...form, machine_type: v })}>
                  <SelectTrigger className="mt-1 rounded-xl h-12"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FILLER">Filler</SelectItem>
                    <SelectItem value="CHAMBER">Chamber</SelectItem>
                    <SelectItem value="LABEL-LINE">Label Line</SelectItem>
                    <SelectItem value="RECIPE-ROOM">Recipe Room</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Default Location</Label>
                <Input placeholder="e.g. WIP-FILLING-OUT" value={form.default_location} onChange={e => setForm({ ...form, default_location: e.target.value })} className="mt-1 rounded-xl h-12" />
              </div>
              <Button onClick={handleCreate} className="w-full h-12 rounded-xl text-base">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No machines defined</p>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 font-mono text-sm">{item.machine_id}</span>
                  {item.machine_type && (
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${typeColors[item.machine_type] || 'bg-slate-100 text-slate-600'}`}>
                      {item.machine_type}
                    </span>
                  )}
                </div>
                <span className="text-sm text-slate-500">{item.display_name}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(item)} className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}