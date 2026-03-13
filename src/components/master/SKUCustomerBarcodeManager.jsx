import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Barcode, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function SKUCustomerBarcodeManager() {
  const [barcodes, setBarcodes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [skus, setSkus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({ sku_code: '', customer_id: '', barcode_value: '', notes: '', is_active: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [b, c, s] = await Promise.all([
      base44.entities.SKUCustomerBarcode.list('-created_date', 500).catch(() => []),
      base44.entities.Customer.filter({ is_active: true }).catch(() => []),
      base44.entities.ProductMaster.filter({ is_active: true }).catch(() => []),
    ]);
    setBarcodes(b);
    setCustomers(c);
    setSkus(s);
    setLoading(false);
  }

  function openNew() {
    setForm({ sku_code: '', customer_id: '', barcode_value: '', notes: '', is_active: true });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.sku_code || !form.customer_id || !form.barcode_value.trim()) {
      toast.error('SKU, Customer, and Barcode are required');
      return;
    }
    const duplicate = barcodes.find(b => b.sku_code === form.sku_code && b.customer_id === form.customer_id);
    if (duplicate) {
      toast.error('This SKU-Customer combination already exists');
      return;
    }
    setSaving(true);
    await base44.entities.SKUCustomerBarcode.create(form);
    toast.success('Barcode mapping created');
    setSaving(false);
    setShowForm(false);
    loadAll();
  }

  async function handleDelete(id) {
    if (!confirm('Delete this barcode mapping?')) return;
    await base44.entities.SKUCustomerBarcode.delete(id);
    toast.success('Deleted');
    loadAll();
  }

  const enrichedBarcodes = barcodes.map(b => ({
    ...b,
    customer_name: customers.find(c => c.customer_id === b.customer_id)?.customer_name || b.customer_id,
    sku_name: skus.find(s => s.item_code === b.sku_code)?.product_name || b.sku_code,
  }));

  const filteredBarcodes = enrichedBarcodes.filter(b =>
    b.sku_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.sku_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.barcode_value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Barcode className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-bold text-slate-900">SKU Customer Barcodes</h2>
        </div>
        <Button onClick={openNew} className="gap-2 h-10">
          <Plus className="w-4 h-4" /> Add Mapping
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search SKU, customer, or barcode..."
          className="pl-10 h-11"
        />
      </div>

      <div className="grid gap-3">
        {filteredBarcodes.map(b => (
          <div key={b.id} className="flex items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-shadow">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-mono font-semibold">{b.sku_code}</span>
                <span className="text-xs text-slate-400">→</span>
                <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded font-semibold">{b.customer_name}</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">{b.sku_name}</p>
              <p className="text-xs text-slate-800 font-mono mt-1 bg-slate-50 inline-block px-2 py-0.5 rounded">Barcode: {b.barcode_value}</p>
              {b.notes && <p className="text-xs text-slate-500 mt-1">{b.notes}</p>}
            </div>
            <Button size="sm" variant="outline" onClick={() => handleDelete(b.id)} className="gap-1.5 shrink-0 text-red-600 hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </Button>
          </div>
        ))}
        {filteredBarcodes.length === 0 && (
          <div className="text-center py-12 text-slate-400">No barcode mappings found</div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Customer Barcode Mapping</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>SKU *</Label>
              <select value={form.sku_code} onChange={e => setForm(f => ({ ...f, sku_code: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 h-11 bg-white">
                <option value="">— Select SKU —</option>
                {skus.map(s => <option key={s.id} value={s.item_code}>{s.item_code} — {s.product_name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Customer *</Label>
              <select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 h-11 bg-white">
                <option value="">— Select Customer —</option>
                {customers.map(c => <option key={c.id} value={c.customer_id}>{c.customer_name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Barcode Value *</Label>
              <Input value={form.barcode_value} onChange={e => setForm(f => ({ ...f, barcode_value: e.target.value }))} className="h-11 font-mono" placeholder="8901234567890" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="h-11" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}