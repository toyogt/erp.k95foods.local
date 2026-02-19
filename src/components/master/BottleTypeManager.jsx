import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Loader2, Package } from 'lucide-react';
import { logAudit } from '@/components/AuditLogger';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function BottleTypeManager({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', bottles_per_crate: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const data = await base44.entities.BottleType.list('name');
    setItems(data);
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.name || !form.bottles_per_crate) return;
    await base44.entities.BottleType.create({
      name: form.name,
      bottles_per_crate: Number(form.bottles_per_crate),
    });
    await logAudit({ action: 'Created bottle type: ' + form.name, entity_type: 'BottleType', entity_id: form.name, user });
    setForm({ name: '', bottles_per_crate: '' });
    setOpen(false);
    load();
  }

  async function handleDelete(item) {
    await base44.entities.BottleType.delete(item.id);
    await logAudit({ action: 'Deleted bottle type: ' + item.name, entity_type: 'BottleType', entity_id: item.name, user });
    load();
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Package className="w-5 h-5" /> Bottle Types
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-xl gap-1.5 h-10 px-4">
              <Plus className="w-4 h-4" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Bottle Type</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Name</Label>
                <Input placeholder="e.g. 200ml" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1 rounded-xl h-12" />
              </div>
              <div>
                <Label>Bottles per Crate</Label>
                <Input type="number" placeholder="e.g. 24" value={form.bottles_per_crate} onChange={e => setForm({ ...form, bottles_per_crate: e.target.value })} className="mt-1 rounded-xl h-12" />
              </div>
              <Button onClick={handleCreate} className="w-full h-12 rounded-xl text-base">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No bottle types defined</p>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200">
              <div>
                <span className="font-semibold text-slate-900">{item.name}</span>
                <span className="text-sm text-slate-500 ml-2">({item.bottles_per_crate} per crate)</span>
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