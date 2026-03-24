import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Save, Loader2, Edit2, X } from 'lucide-react';

const EMPTY = {
  item_code: '', item_name: '', distributor_id: '', distributor_name: '',
  min_order_qty: '', min_order_boxes: '', packing_unit: '', notes: '', is_active: true,
};

export default function MOQConfigManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const { data: configs = [], isLoading, refetch } = useQuery({
    queryKey: ['sales_moq_configs'],
    queryFn: () => base44.entities.SalesMinOrderConfig.list('-created_date', 200),
  });

  const { data: rateItems = [] } = useQuery({
    queryKey: ['sales_rate_list_for_moq'],
    queryFn: () => base44.entities.SalesRateList.filter({ is_active: true }, 'item_name', 200),
  });

  const { data: distributors = [] } = useQuery({
    queryKey: ['distributors_for_moq'],
    queryFn: () => base44.entities.Distributor.filter({ status: 'active' }, 'name', 100),
  });

  function openNew() { setEditing(null); setForm(EMPTY); setShowForm(true); }
  function openEdit(c) { setEditing(c); setForm({ ...EMPTY, ...c }); setShowForm(true); }

  function handleItemSelect(itemCode) {
    const found = rateItems.find(r => r.item_code === itemCode);
    setForm(f => ({
      ...f,
      item_code: itemCode,
      item_name: found?.item_name || f.item_name,
      packing_unit: found?.packing_unit || f.packing_unit,
    }));
  }

  function handleDistributorSelect(distId) {
    const found = distributors.find(d => d.id === distId);
    setForm(f => ({ ...f, distributor_id: distId, distributor_name: found?.name || '' }));
  }

  async function save() {
    if (!form.item_code) { toast({ title: 'Item code is required', variant: 'destructive' }); return; }
    if (!form.min_order_qty) { toast({ title: 'Minimum order quantity is required', variant: 'destructive' }); return; }
    setSaving(true);
    const data = {
      ...form,
      min_order_qty: parseFloat(form.min_order_qty) || 0,
      min_order_boxes: parseFloat(form.min_order_boxes) || 0,
      packing_unit: parseFloat(form.packing_unit) || 0,
    };
    if (editing) {
      await base44.entities.SalesMinOrderConfig.update(editing.id, data);
      toast({ title: 'Configuration updated' });
    } else {
      await base44.entities.SalesMinOrderConfig.create(data);
      toast({ title: 'Configuration added' });
    }
    setSaving(false);
    setShowForm(false);
    refetch();
    qc.invalidateQueries(['sales_moq_configs']);
  }

  async function remove(id) {
    await base44.entities.SalesMinOrderConfig.delete(id);
    toast({ title: 'Configuration removed' });
    refetch();
  }

  if (isLoading) return <div className="p-6 text-center text-slate-400 text-sm">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Minimum Order Quantities</p>
          <p className="text-xs text-slate-500 mt-0.5">Set minimum order quantities per product code and optionally per distributor</p>
        </div>
        <Button className="h-9 bg-slate-900 text-white text-sm" onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Add Rule
        </Button>
      </div>

      {configs.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
          No minimum order rules set yet
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-700 font-medium">
                <th className="px-3 py-2.5 text-left">Product Code</th>
                <th className="px-3 py-2.5 text-left">Item Name</th>
                <th className="px-3 py-2.5 text-left">Distributor</th>
                <th className="px-3 py-2.5 text-right">Min Qty</th>
                <th className="px-3 py-2.5 text-right">Min Boxes</th>
                <th className="px-3 py-2.5 text-right">Units/Box</th>
                <th className="px-3 py-2.5 text-center">Status</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {configs.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-800">{c.item_code}</td>
                  <td className="px-3 py-2.5 text-slate-700">{c.item_name || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{c.distributor_name || <span className="italic text-slate-400">All distributors</span>}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-slate-900">{c.min_order_qty}</td>
                  <td className="px-3 py-2.5 text-right text-slate-700">{c.min_order_boxes || '—'}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{c.packing_unit || '—'}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {c.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(c)} className="text-slate-400 hover:text-slate-700">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => remove(c.id)} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">{editing ? 'Edit Rule' : 'Add Minimum Order Rule'}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <Label className="text-xs font-medium text-slate-700">Product Code *</Label>
                {rateItems.length > 0 ? (
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.item_code}
                    onChange={e => handleItemSelect(e.target.value)}
                  >
                    <option value="">Select product...</option>
                    {rateItems.map(r => (
                      <option key={r.id} value={r.item_code}>{r.item_code} — {r.item_name}</option>
                    ))}
                  </select>
                ) : (
                  <Input className="h-9 text-sm mt-1" placeholder="e.g. K95-001" value={form.item_code}
                    onChange={e => setForm(f => ({ ...f, item_code: e.target.value }))} />
                )}
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Item Name</Label>
                <Input className="h-9 text-sm mt-1" placeholder="Item name" value={form.item_name}
                  onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Distributor (leave blank to apply to all)</Label>
                <select
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.distributor_id}
                  onChange={e => handleDistributorSelect(e.target.value)}
                >
                  <option value="">All Distributors</option>
                  {distributors.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs font-medium text-slate-700">Min Quantity *</Label>
                  <Input type="number" min="0" className="h-9 text-sm mt-1" value={form.min_order_qty}
                    onChange={e => setForm(f => ({ ...f, min_order_qty: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Min Boxes</Label>
                  <Input type="number" min="0" className="h-9 text-sm mt-1" value={form.min_order_boxes}
                    onChange={e => setForm(f => ({ ...f, min_order_boxes: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Units per Box</Label>
                  <Input type="number" min="0" className="h-9 text-sm mt-1" value={form.packing_unit}
                    onChange={e => setForm(f => ({ ...f, packing_unit: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Notes</Label>
                <Input className="h-9 text-sm mt-1" placeholder="Optional notes" value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="moq_active" checked={form.is_active !== false}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="rounded" />
                <Label htmlFor="moq_active" className="text-xs font-medium text-slate-700">Active</Label>
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-slate-100">
              <Button variant="outline" className="h-11 flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button className="h-11 flex-1 bg-slate-900 text-white text-sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {editing ? 'Save Changes' : 'Add Rule'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}