import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Edit2, X, CheckCircle2, Users, Loader2, Download, ChevronRight } from 'lucide-react';
import usePagination from '@/hooks/usePagination';
import TablePagination from '@/components/sales/TablePagination';

function exportDistributorsCSV(rows) {
  const headers = ['Name','Code','Contact','Phone','Email','GSTIN','PAN','Region','Credit Limit','Utilized','Status','Payment Terms'];
  const lines = [headers.join(',')];
  for (const d of rows) {
    lines.push([d.name,d.code,d.contact_name,d.phone,d.email,d.gstin,d.pan,d.region,d.credit_limit,d.utilized_limit,d.status,d.payment_terms]
      .map(v => `"${(v ?? '').toString().replace(/"/g,'""')}"`).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'distributors.csv'; a.click();
}

const EMPTY_FORM = {
  name: '', code: '', contact_name: '', phone: '', email: '',
  gstin: '', pan: '', address: '', region: '',
  credit_limit: '', payment_terms: '', status: 'active', notes: '',
};

export default function SalesDistributors() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const { data: distributors = [], isLoading, refetch } = useQuery({
    queryKey: ['distributors'],
    queryFn: () => base44.entities.Distributor.list('-created_date', 200),
    staleTime: 120000,
    cacheTime: 600000,
    refetchOnWindowFocus: false,
  });

  const pagination = usePagination(distributors, 25);

  function openNew() { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); }
  function openEdit(d) {
    setEditing(d);
    setForm({ ...EMPTY_FORM, ...d });
    setShowForm(true);
  }

  async function save() {
    if (!form.name) { toast({ title: 'Name is required', variant: 'destructive' }); return; }
    setSaving(true);
    const data = { ...form, credit_limit: parseFloat(form.credit_limit) || 0 };
    if (editing) {
      // Audit changes
      const changed = Object.entries(data).filter(([k, v]) => editing[k] !== v);
      await base44.entities.Distributor.update(editing.id, data);
      for (const [field, newVal] of changed) {
        await base44.entities.SalesAuditLog.create({
          entity_type: 'Distributor', entity_id: editing.id,
          reference_number: editing.name, action: 'updated',
          field_name: field, old_value: String(editing[field] ?? ''), new_value: String(newVal),
          user_email: user?.email,
        });
      }
      toast({ title: 'Distributor updated' });
    } else {
      const d = await base44.entities.Distributor.create(data);
      await base44.entities.SalesAuditLog.create({
        entity_type: 'Distributor', entity_id: d.id,
        reference_number: form.name, action: 'created', user_email: user?.email,
      });
      toast({ title: 'Distributor created' });
    }
    setSaving(false);
    setShowForm(false);
    refetch();
  }

  return (
    <div className="p-3 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Distributors</h1>
          <p className="text-sm text-slate-500">Manage distributor accounts and credit limits</p>
        </div>
        <Button variant="outline" className="h-11 text-sm" onClick={() => exportDistributorsCSV(distributors)}>
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
        <Button className="h-11 bg-slate-900 text-white text-sm" onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" /> Add Distributor
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Total Distributors</p>
          <p className="text-2xl font-bold text-slate-900">{distributors.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Active</p>
          <p className="text-2xl font-bold text-green-600">{distributors.filter(d => d.status === 'active').length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Total Credit Limit</p>
          <p className="text-xl font-bold text-slate-900">
            ₹{(distributors.reduce((s, d) => s + (d.credit_limit || 0), 0) / 100000).toFixed(1)}L
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Total Utilized</p>
          <p className="text-xl font-bold text-amber-600">
            ₹{(distributors.reduce((s, d) => s + (d.utilized_limit || 0), 0) / 100000).toFixed(1)}L
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Total Available</p>
          <p className="text-xl font-bold text-green-600">
            ₹{(distributors.reduce((s, d) => s + ((d.credit_limit || 0) - (d.utilized_limit || 0)), 0) / 100000).toFixed(1)}L
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
        ) : distributors.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No distributors added yet</p>
          </div>
        ) : (
          <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-700 font-medium">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Region</th>
                  <th className="px-4 py-3 text-right">Credit Limit</th>
                  <th className="px-4 py-3 text-right">Utilized</th>
                  <th className="px-4 py-3 text-right">Available</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagination.paged.map(d => {
                  const available = (d.credit_limit || 0) - (d.utilized_limit || 0);
                  return (
                    <tr key={d.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => openEdit(d)}>
                      <td className="px-4 py-3 font-medium text-slate-900">{d.name}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <div>{d.contact_name}</div>
                        <div className="text-xs text-slate-400">{d.phone}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{d.region || '—'}</td>
                      <td className="px-4 py-3 text-right">₹{(d.credit_limit || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right text-amber-600">₹{(d.utilized_limit || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">₹{available.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.status === 'active' ? 'bg-green-100 text-green-700' : d.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{d.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEdit(d)} className="text-slate-400 hover:text-slate-900">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {pagination.paged.map(d => {
              const available = (d.credit_limit || 0) - (d.utilized_limit || 0);
              return (
                <div key={d.id} className="px-4 py-3.5 active:bg-slate-50 cursor-pointer" onClick={() => openEdit(d)}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">{d.name}</p>
                      <p className="text-sm text-slate-600 mt-0.5">{d.contact_name || ''}{d.region ? ` · ${d.region}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.status === 'active' ? 'bg-green-100 text-green-700' : d.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{d.status}</span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="bg-slate-50 rounded-lg px-2 py-1.5 text-center">
                      <p className="text-xs text-slate-500">Limit</p>
                      <p className="text-sm font-bold text-slate-800">₹{((d.credit_limit || 0) / 1000).toFixed(0)}K</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg px-2 py-1.5 text-center">
                      <p className="text-xs text-amber-500">Utilized</p>
                      <p className="text-sm font-bold text-amber-600">₹{((d.utilized_limit || 0) / 1000).toFixed(0)}K</p>
                    </div>
                    <div className="bg-green-50 rounded-lg px-2 py-1.5 text-center">
                      <p className="text-xs text-green-500">Available</p>
                      <p className="text-sm font-bold text-green-600">₹{(available / 1000).toFixed(0)}K</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <TablePagination {...pagination} />
          </>
        )}
      </div>

      {/* Side drawer form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-end">
          <div className="bg-white h-full w-full max-w-md overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">
                {editing ? 'Edit Distributor' : 'Add Distributor'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {[
                ['name', 'Distributor Name *', 'text'],
                ['code', 'Distributor Code', 'text'],
                ['contact_name', 'Contact Person', 'text'],
                ['phone', 'Phone', 'text'],
                ['email', 'Email', 'email'],
                ['gstin', 'GSTIN', 'text'],
                ['pan', 'PAN', 'text'],
                ['region', 'Region', 'text'],
                ['credit_limit', 'Credit Limit (INR)', 'number'],
                ['payment_terms', 'Payment Terms', 'text'],
              ].map(([key, label, type]) => (
                <div key={key}>
                  <Label className="text-xs font-medium text-slate-700">{label}</Label>
                  <Input type={type} className="h-9 text-sm mt-1" value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <Label className="text-xs font-medium text-slate-700">Address</Label>
                <textarea
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-none"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Status</Label>
                <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
              <Button variant="outline" className="h-11 px-4" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button className="h-11 bg-slate-900 text-white" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                {editing ? 'Save Changes' : 'Add Distributor'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}