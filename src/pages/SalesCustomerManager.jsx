import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Search, Download, Plus, Edit2, X, Check, Loader2, Users, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';

function exportCSV(rows) {
  const headers = ['Name', 'Code', 'GSTIN', 'PAN', 'Phone', 'Email', 'Price List', 'GST Category', 'Place of Supply', 'Payment Terms', 'Status', 'Credit Limit', 'Current Outstanding'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([
      r.name, r.code, r.gstin, r.pan, r.phone, r.email,
      r.price_list, r.gst_category, r.place_of_supply, r.payment_terms, r.status,
      r.outstanding_limit, r.current_outstanding,
    ].map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'customers.csv'; a.click();
}

const BLANK_FORM = {
  name: '', code: '', contact_name: '', phone: '', email: '', gstin: '', pan: '',
  billing_address: '', shipping_address: '', region: '', gst_category: 'Registered Regular',
  place_of_supply: '', payment_terms: '', price_list: '', status: 'active', notes: '',
  check_outstanding: false, outstanding_limit: 0, leverage_outstanding: 0, current_outstanding: 0,
};

export default function SalesCustomerManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterPriceList, setFilterPriceList] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers_all'],
    queryFn: () => base44.entities.Customer.list('-created_date', 500),
  });

  const { data: allRates = [] } = useQuery({
    queryKey: ['sales_rate_list_all'],
    queryFn: () => base44.entities.SalesRateList.list('-created_date', 1000),
  });

  // Price lists from actual rate master (source of truth)
  const priceLists = [...new Set(allRates.map(r => r.price_list).filter(Boolean))].sort();

  const filtered = customers.filter(c => {
    const s = search.toLowerCase();
    const matchSearch = !search || c.name?.toLowerCase().includes(s) || c.gstin?.toLowerCase().includes(s) || c.code?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s);
    const matchPL = !filterPriceList || c.price_list === filterPriceList;
    const matchStatus = !filterStatus || c.status === filterStatus;
    return matchSearch && matchPL && matchStatus;
  });

  function openNew() {
    setEditing(null); setForm(BLANK_FORM); setShowForm(true);
  }

  function openEdit(c) {
    setEditing(c); setForm({ ...BLANK_FORM, ...c }); setShowForm(true);
  }

  async function handleSave() {
    if (!form.name) { toast({ title: 'Customer name is required', variant: 'destructive' }); return; }
    setSaving(true);
    const data = { ...form, outstanding_limit: parseFloat(form.outstanding_limit) || 0, leverage_outstanding: parseFloat(form.leverage_outstanding) || 0, current_outstanding: parseFloat(form.current_outstanding) || 0 };
    if (editing) {
      await base44.entities.Customer.update(editing.id, data);
      toast({ title: 'Customer updated' });
    } else {
      await base44.entities.Customer.create(data);
      toast({ title: 'Customer created' });
    }
    setSaving(false); setShowForm(false);
    qc.invalidateQueries(['customers_all']);
  }

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Customer Master</h1>
          <p className="text-sm text-slate-500">{customers.length} customers · Manage profiles and price list assignments</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="h-11 text-sm" onClick={() => exportCSV(filtered)}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Link to="/SalesPriceListView">
            <Button variant="outline" className="h-11 text-sm">
              <Tag className="w-4 h-4 mr-2" /> Price Lists
            </Button>
          </Link>
          <Button className="h-11 text-sm bg-slate-900 text-white" onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" /> Add Customer
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search name, GSTIN, code, email..." className="pl-9 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterPriceList} onChange={e => setFilterPriceList(e.target.value)}>
            <option value="">All Price Lists</option>
            {priceLists.map(pl => <option key={pl} value={pl}>{pl}</option>)}
          </select>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
          {(search || filterPriceList || filterStatus) && (
            <button onClick={() => { setSearch(''); setFilterPriceList(''); setFilterStatus(''); }} className="h-9 px-3 text-sm text-slate-500 hover:text-slate-900 border border-slate-200 rounded-md">Clear</button>
          )}
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading customers...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center"><Users className="w-10 h-10 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-500">No customers found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-700 font-medium">
                  <th className="px-3 py-2.5 text-left">Customer Name</th>
                  <th className="px-3 py-2.5 text-left">Code</th>
                  <th className="px-3 py-2.5 text-left">GSTIN</th>
                  <th className="px-3 py-2.5 text-left">Price List</th>
                  <th className="px-3 py-2.5 text-left">Payment Terms</th>
                  <th className="px-3 py-2.5 text-right">Credit Limit</th>
                  <th className="px-3 py-2.5 text-right">Outstanding</th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-900">{c.name}</td>
                    <td className="px-3 py-2 text-slate-500 text-xs font-mono">{c.code || '—'}</td>
                    <td className="px-3 py-2 text-slate-600 text-xs font-mono">{c.gstin || '—'}</td>
                    <td className="px-3 py-2">
                      {c.price_list ? (
                        <Link to={`/SalesPriceListView?list=${encodeURIComponent(c.price_list)}`} className="text-blue-600 hover:underline text-xs font-medium">{c.price_list}</Link>
                      ) : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs">{c.payment_terms || '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{c.outstanding_limit ? `₹${Number(c.outstanding_limit).toLocaleString('en-IN')}` : '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{c.current_outstanding ? `₹${Number(c.current_outstanding).toLocaleString('en-IN')}` : '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === 'active' ? 'bg-green-100 text-green-700' : c.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => openEdit(c)} className="text-slate-400 hover:text-slate-900"><Edit2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Drawer */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-end">
          <div className="bg-white h-full w-full max-w-md overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-base font-semibold text-slate-900">{editing ? 'Edit Customer' : 'Add Customer'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              {[
                ['name', 'Customer Name *', 'text'],
                ['code', 'Customer Code', 'text'],
                ['customer_group', 'Customer Group', 'text'],
                ['contact_name', 'Contact Name', 'text'],
                ['phone', 'Phone', 'text'],
                ['email', 'Email', 'email'],
                ['gstin', 'GSTIN', 'text'],
                ['pan', 'PAN', 'text'],
                ['payment_terms', 'Payment Terms', 'text'],
                ['region', 'Region / Territory', 'text'],
                ['place_of_supply', 'Place of Supply (State Code)', 'text'],
                ['billing_address', 'Billing Address', 'text'],
                ['outstanding_limit', 'Credit Limit (INR)', 'number'],
                ['leverage_outstanding', 'Leverage on Limit (INR)', 'number'],
                ['current_outstanding', 'Current Outstanding (INR)', 'number'],
                ].map(([key, label, type]) => (
                <div key={key}>
                  <Label className="text-xs font-medium text-slate-700">{label}</Label>
                  <Input type={type} className="h-9 text-sm mt-1" value={form[key] ?? ''}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
              {/* Price List Dropdown — linked to actual SalesRateList master */}
              <div>
                <Label className="text-xs font-medium text-slate-700">Default Price List</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm mt-1"
                  value={form.price_list || ''}
                  onChange={e => setForm(f => ({ ...f, price_list: e.target.value }))}
                >
                  <option value="">— None / Select —</option>
                  {priceLists.map(pl => <option key={pl} value={pl}>{pl}</option>)}
                </select>
                <p className="text-xs text-slate-500 mt-0.5">This will auto-apply when creating orders for this customer</p>
              </div>
              <div>
                 <Label className="text-xs font-medium text-slate-700">GST Category</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm mt-1" value={form.gst_category} onChange={e => setForm(f => ({ ...f, gst_category: e.target.value }))}>
                  {['Registered Regular', 'Registered Composition', 'Unregistered', 'SEZ', 'Overseas', 'UIN Holders'].map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Status</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm mt-1" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="check_outstanding" checked={!!form.check_outstanding}
                  onChange={e => setForm(f => ({ ...f, check_outstanding: e.target.checked }))} />
                <label htmlFor="check_outstanding" className="text-sm text-slate-700">Enable Credit Limit Check</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
              <Button variant="outline" className="h-11 px-4" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button className="h-11 bg-slate-900 text-white" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}