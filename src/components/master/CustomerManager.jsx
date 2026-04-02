import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Users, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

function genId() { return 'CUST-' + Date.now().toString(36).toUpperCase().slice(-5); }

export default function CustomerManager() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({
    customer_name: '', contact_person: '', email: '', phone: '', address: '', is_active: true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadCustomers(); }, []);

  async function loadCustomers() {
    setLoading(true);
    const c = await base44.entities.Customer.list('-created_date', 500).catch(() => []);
    setCustomers(c);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm({ customer_name: '', contact_person: '', email: '', phone: '', address: '', is_active: true });
    setShowForm(true);
  }

  function openEdit(customer) {
    setEditing(customer);
    setForm({ ...customer });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.customer_name.trim()) {
      toast.error('Customer name is required');
      return;
    }
    setSaving(true);
    if (editing) {
      await base44.entities.Customer.update(editing.id, form);
      toast.success('Customer updated');
    } else {
      await base44.entities.Customer.create({ ...form, customer_id: genId() });
      toast.success('Customer created');
    }
    setSaving(false);
    setShowForm(false);
    loadCustomers();
  }

  const filteredCustomers = customers.filter(c => {
    const term = searchTerm.toLowerCase();
    const name = (c.customer_name || c.name || '').toLowerCase();
    const code = (c.customer_id || c.code || '').toLowerCase();
    const email = (c.email || '').toLowerCase();
    return name.includes(term) || code.includes(term) || email.includes(term);
  });

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-bold text-slate-900">Customer Master</h2>
        </div>
        <Button onClick={openNew} className="gap-2 h-10">
          <Plus className="w-4 h-4" /> Add Customer
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search customers..."
          className="pl-10 h-11"
        />
      </div>

      <div className="grid gap-3">
        {filteredCustomers.map(c => (
          <div key={c.id} className="flex items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-shadow">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-slate-900">{c.customer_name}</p>
                <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-mono">{c.customer_id}</span>
                {!c.is_active && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded font-semibold">Inactive</span>}
              </div>
              {c.contact_person && <p className="text-sm text-slate-600 mt-0.5">Contact: {c.contact_person}</p>}
              {c.email && <p className="text-xs text-slate-500 mt-0.5">{c.email}</p>}
              {c.phone && <p className="text-xs text-slate-500">{c.phone}</p>}
            </div>
            <Button size="sm" variant="outline" onClick={() => openEdit(c)} className="gap-1.5 shrink-0">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
          </div>
        ))}
        {filteredCustomers.length === 0 && (
          <div className="text-center py-12 text-slate-400">No customers found</div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Customer' : 'New Customer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Customer Name *</Label>
              <Input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Contact Person</Label>
              <Input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} className="h-11" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="h-11" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="h-11" />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${form.is_active ? 'bg-green-600' : 'bg-slate-400'}`}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-8' : 'translate-x-1'}`} />
              </button>
              <Label className="text-sm">{form.is_active ? 'Active' : 'Inactive'}</Label>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.customer_name.trim()}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}