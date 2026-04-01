/**
 * TransportRateManager — manage weight-based transportation rate cards.
 * Used in Sales Settings page.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Loader2, Truck, Edit2 } from 'lucide-react';

const EMPTY = {
  name: '', customer_name: '', customer_group: '',
  weight_from_kg: '', weight_to_kg: '',
  freight_cost: '', door_delivery_cost: '', bilty_cost: '',
  labour_cost: '', pickup_charges: '', late_fees: '',
  transporter: '', destination_region: '', is_active: true, notes: '',
};

export default function TransportRateManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['transport-rate-cards-all'],
    queryFn: () => base44.entities.TransportRateCard.list('weight_from_kg', 100),
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY }); setModalOpen(true); };
  const openEdit = (card) => {
    setEditing(card);
    setForm({
      name: card.name || '',
      customer_name: card.customer_name || '',
      customer_group: card.customer_group || '',
      weight_from_kg: card.weight_from_kg || '',
      weight_to_kg: card.weight_to_kg || '',
      freight_cost: card.freight_cost || '',
      door_delivery_cost: card.door_delivery_cost || '',
      bilty_cost: card.bilty_cost || '',
      labour_cost: card.labour_cost || '',
      pickup_charges: card.pickup_charges || '',
      late_fees: card.late_fees || '',
      transporter: card.transporter || '',
      destination_region: card.destination_region || '',
      is_active: card.is_active !== false,
      notes: card.notes || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.weight_from_kg || !form.weight_to_kg) {
      toast({ title: 'Weight range is required', variant: 'destructive' }); return;
    }
    setSaving(true);
    const payload = {
      name: form.name || undefined,
      customer_name: form.customer_name || undefined,
      customer_group: form.customer_group || undefined,
      weight_from_kg: Number(form.weight_from_kg),
      weight_to_kg: Number(form.weight_to_kg),
      freight_cost: Number(form.freight_cost) || 0,
      door_delivery_cost: Number(form.door_delivery_cost) || 0,
      bilty_cost: Number(form.bilty_cost) || 0,
      labour_cost: Number(form.labour_cost) || 0,
      pickup_charges: Number(form.pickup_charges) || 0,
      late_fees: Number(form.late_fees) || 0,
      transporter: form.transporter || undefined,
      destination_region: form.destination_region || undefined,
      is_active: form.is_active,
      notes: form.notes || undefined,
    };
    if (editing) {
      await base44.entities.TransportRateCard.update(editing.id, payload);
      toast({ title: 'Rate card updated' });
    } else {
      await base44.entities.TransportRateCard.create(payload);
      toast({ title: 'Rate card created' });
    }
    qc.invalidateQueries({ queryKey: ['transport-rate-cards-all'] });
    setSaving(false);
    setModalOpen(false);
  };

  const handleDelete = async (card) => {
    if (!confirm(`Delete rate card ${card.weight_from_kg}–${card.weight_to_kg} kg?`)) return;
    await base44.entities.TransportRateCard.delete(card.id);
    qc.invalidateQueries({ queryKey: ['transport-rate-cards-all'] });
    toast({ title: 'Rate card deleted' });
  };

  const totalCost = (c) =>
    (c.freight_cost || 0) + (c.door_delivery_cost || 0) + (c.bilty_cost || 0) +
    (c.labour_cost || 0) + (c.pickup_charges || 0) + (c.late_fees || 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-semibold text-slate-900">Transport Rate Cards</span>
        </div>
        <Button variant="outline" className="h-9 text-sm gap-1" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Add Rate Card
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
      ) : cards.length === 0 ? (
        <p className="text-sm text-slate-500">No rate cards configured yet. Add your first rate card to enable system cost estimates.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="text-left py-2 px-2 font-medium">Name</th>
                <th className="text-left py-2 px-2 font-medium">Customer</th>
                <th className="text-left py-2 px-2 font-medium">Group</th>
                <th className="text-left py-2 px-2 font-medium">Weight Range (kg)</th>
                <th className="text-right py-2 px-2 font-medium">Freight</th>
                <th className="text-right py-2 px-2 font-medium">Door Delivery</th>
                <th className="text-right py-2 px-2 font-medium">Bilty</th>
                <th className="text-right py-2 px-2 font-medium">Labour</th>
                <th className="text-right py-2 px-2 font-medium">Pickup</th>
                <th className="text-right py-2 px-2 font-medium">Late Fee</th>
                <th className="text-right py-2 px-2 font-medium">Total</th>
                <th className="text-center py-2 px-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cards.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="py-1.5 px-2 font-medium">{c.name || '—'}</td>
                  <td className="py-1.5 px-2">{c.customer_name || <span className="text-slate-400">All</span>}</td>
                  <td className="py-1.5 px-2">{c.customer_group || <span className="text-slate-400">All</span>}</td>
                  <td className="py-1.5 px-2">{c.weight_from_kg}–{c.weight_to_kg} kg</td>
                  <td className="py-1.5 px-2 text-right">₹{(c.freight_cost || 0).toLocaleString('en-IN')}</td>
                  <td className="py-1.5 px-2 text-right">₹{(c.door_delivery_cost || 0).toLocaleString('en-IN')}</td>
                  <td className="py-1.5 px-2 text-right">₹{(c.bilty_cost || 0).toLocaleString('en-IN')}</td>
                  <td className="py-1.5 px-2 text-right">₹{(c.labour_cost || 0).toLocaleString('en-IN')}</td>
                  <td className="py-1.5 px-2 text-right">₹{(c.pickup_charges || 0).toLocaleString('en-IN')}</td>
                  <td className="py-1.5 px-2 text-right">₹{(c.late_fees || 0).toLocaleString('en-IN')}</td>
                  <td className="py-1.5 px-2 text-right font-semibold">₹{totalCost(c).toLocaleString('en-IN')}</td>
                  <td className="py-1.5 px-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Edit2 className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(c)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Rate Card' : 'New Transport Rate Card'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium text-slate-700">Name (optional)</Label>
              <Input className="h-9 text-sm mt-1" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Local Mumbai" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-700">Customer Name</Label>
                <Input className="h-9 text-sm mt-1" value={form.customer_name} onChange={e => set('customer_name', e.target.value)} placeholder="Leave blank for all customers" />
                <p className="text-xs text-slate-500 mt-0.5">Maps rate to a specific customer</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Customer Group</Label>
                <Input className="h-9 text-sm mt-1" value={form.customer_group} onChange={e => set('customer_group', e.target.value)} placeholder="e.g. Quick Commerce" />
                <p className="text-xs text-slate-500 mt-0.5">Maps rate to a customer group</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-700">Weight From (kg) *</Label>
                <Input className="h-9 text-sm mt-1" type="number" value={form.weight_from_kg} onChange={e => set('weight_from_kg', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Weight To (kg) *</Label>
                <Input className="h-9 text-sm mt-1" type="number" value={form.weight_to_kg} onChange={e => set('weight_to_kg', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                ['Freight (₹)', 'freight_cost'],
                ['Door Delivery (₹)', 'door_delivery_cost'],
                ['Bilty (₹)', 'bilty_cost'],
                ['Labour Charge (₹)', 'labour_cost'],
                ['Pickup Charges (₹)', 'pickup_charges'],
                ['Late Fees (₹)', 'late_fees'],
              ].map(([lbl, key]) => (
                <div key={key}>
                  <Label className="text-xs font-medium text-slate-700">{lbl}</Label>
                  <Input className="h-9 text-sm mt-1" type="number" value={form[key]} onChange={e => set(key, e.target.value)} placeholder="0" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-700">Transporter (optional)</Label>
                <Input className="h-9 text-sm mt-1" value={form.transporter} onChange={e => set('transporter', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Destination Region (optional)</Label>
                <Input className="h-9 text-sm mt-1" value={form.destination_region} onChange={e => set('destination_region', e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Notes</Label>
              <Input className="h-9 text-sm mt-1" value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" className="h-11" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button className="h-11" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                {editing ? 'Update' : 'Create'} Rate Card
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}