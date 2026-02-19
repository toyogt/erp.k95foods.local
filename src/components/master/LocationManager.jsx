import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Loader2, MapPin } from 'lucide-react';
import { logAudit } from '@/components/AuditLogger';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function LocationManager({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', display_name: '', zone: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const data = await base44.entities.Location.list('code');
    setItems(data);
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.code || !form.display_name) return;
    await base44.entities.Location.create({ ...form, is_active: true });
    await logAudit({ action: 'Created location: ' + form.code, entity_type: 'Location', entity_id: form.code, user });
    setForm({ code: '', display_name: '', zone: '' });
    setOpen(false);
    load();
  }

  async function handleDelete(item) {
    await base44.entities.Location.delete(item.id);
    await logAudit({ action: 'Deleted location: ' + item.code, entity_type: 'Location', entity_id: item.code, user });
    load();
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <MapPin className="w-5 h-5" /> Locations
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-xl gap-1.5 h-10 px-4">
              <Plus className="w-4 h-4" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Location</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Code</Label>
                <Input placeholder="e.g. WIP-FILLING-OUT" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="mt-1 rounded-xl h-12" />
              </div>
              <div>
                <Label>Display Name</Label>
                <Input placeholder="e.g. WIP Filling Output" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} className="mt-1 rounded-xl h-12" />
              </div>
              <div>
                <Label>Zone</Label>
                <Input placeholder="e.g. WIP, TRANSIT, FG" value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })} className="mt-1 rounded-xl h-12" />
              </div>
              <Button onClick={handleCreate} className="w-full h-12 rounded-xl text-base">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No locations defined</p>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200">
              <div>
                <span className="font-semibold text-slate-900 font-mono text-sm">{item.code}</span>
                <span className="text-sm text-slate-500 ml-2">{item.display_name}</span>
                {item.zone && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded ml-2">{item.zone}</span>}
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