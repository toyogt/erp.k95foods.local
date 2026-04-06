/**
 * Address & Contact panel — editable with searchable address dropdowns.
 * Editable when: order is draft OR status is logistics_review.
 * Editable by: any user (creator or logistics reviewer).
 */
import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Search, Edit2, CheckCircle2, Building2 } from 'lucide-react';

// Searchable address dropdown — searches Customer records
function AddressSearchDropdown({ label, value, onChange, placeholder }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-address-list'],
    queryFn: () => base44.entities.Customer.list('-created_date', 500),
    staleTime: 120000,
  });

  const { data: distributors = [] } = useQuery({
    queryKey: ['distributors-address-list'],
    queryFn: () => base44.entities.Distributor.list('-created_date', 500),
    staleTime: 120000,
  });

  // Build flat list of addresses
  const addressOptions = [];
  [...customers, ...distributors].forEach(c => {
    if (c.billing_address || c.address) {
      addressOptions.push({
        id: `${c.id}-billing`,
        name: c.customer_name || c.name || '',
        gstin: c.gstin || c.customer_gstin || '',
        address: c.billing_address || c.address || '',
        type: 'Billing',
      });
    }
    if (c.shipping_address && c.shipping_address !== c.billing_address) {
      addressOptions.push({
        id: `${c.id}-shipping`,
        name: c.customer_name || c.name || '',
        gstin: c.gstin || c.customer_gstin || '',
        address: c.shipping_address,
        type: 'Shipping',
      });
    }
  });

  const filtered = query.trim()
    ? addressOptions.filter(a =>
        a.name?.toLowerCase().includes(query.toLowerCase()) ||
        a.address?.toLowerCase().includes(query.toLowerCase()) ||
        a.gstin?.toLowerCase().includes(query.toLowerCase())
      )
    : addressOptions.slice(0, 20);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-slate-700">{label}</Label>
      <div className="relative" ref={ref}>
        <div
          className="w-full min-h-[2.75rem] border border-slate-300 rounded-lg px-3 py-2 text-sm cursor-pointer bg-white hover:border-slate-400 transition-colors"
          onClick={() => { setOpen(true); setQuery(''); }}
        >
          {value ? (
            <p className="text-slate-800 whitespace-pre-line text-xs leading-relaxed">{value}</p>
          ) : (
            <p className="text-slate-400">{placeholder || 'Select or type address…'}</p>
          )}
        </div>
        {open && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl">
            <div className="p-2 border-b flex items-center gap-2 px-3">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                autoFocus
                className="flex-1 text-sm outline-none"
                placeholder="Search by name, address, GSTIN…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No addresses found</p>
              ) : filtered.map(a => (
                <div
                  key={a.id}
                  className="px-4 py-2.5 cursor-pointer hover:bg-blue-50 border-b border-slate-50"
                  onClick={() => { onChange(a.address); setOpen(false); setQuery(''); }}
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-800 text-sm">{a.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{a.type}</span>
                  </div>
                  {a.gstin && <p className="text-xs text-slate-500 ml-5 mt-0.5">GSTIN: {a.gstin}</p>}
                  <p className="text-xs text-slate-600 ml-5 mt-0.5 line-clamp-2">{a.address}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="py-1.5 border-b border-slate-100 last:border-0 flex gap-2">
      <span className="text-xs text-slate-500 w-32 shrink-0">{label}</span>
      <span className="text-xs font-medium text-slate-900 flex-1">{value || '—'}</span>
    </div>
  );
}

export default function SOAddressPanel({ order, onUpdated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    billing_address: order?.billing_address || '',
    shipping_address: order?.shipping_address || '',
    customer_gstin: order?.customer_gstin || '',
    place_of_supply: order?.place_of_supply || '',
    gst_category: order?.gst_category || '',
  });

  const isEditable = ['draft', 'logistics_review'].includes(order?.status);

  async function handleSave() {
    setSaving(true);
    await base44.entities.SalesOrder.update(order.id, { ...form });
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesOrder', entity_id: order.id,
      reference_number: order.so_number, action: 'address_updated',
      new_value: `Billing: ${form.billing_address?.slice(0, 60)}`,
      user_email: user?.email,
    });
    toast({ title: 'Address details saved' });
    setSaving(false);
    setEditing(false);
    if (onUpdated) onUpdated();
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  return (
    <div className="space-y-6">
      {/* Billing Address */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Billing Address</h3>
          {isEditable && !editing && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setEditing(true)}>
              <Edit2 className="w-3 h-3" /> Edit
            </Button>
          )}
        </div>

        {!editing ? (
          <div className="space-y-0">
            <InfoRow label="Customer" value={order.customer_name} />
            <InfoRow label="GSTIN" value={order.customer_gstin} />
            <InfoRow label="Status" value="Active" />
            <InfoRow label="GST Category" value={order.gst_category || 'Registered Regular'} />
            <InfoRow label="Place of Supply" value={order.place_of_supply} />
            <div className="py-2">
              <p className="text-xs text-slate-500 mb-1">Billing Address</p>
              <p className="text-xs text-slate-800 whitespace-pre-line bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 leading-relaxed">
                {order.billing_address || '—'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <AddressSearchDropdown
              label="Billing Address *"
              value={form.billing_address}
              onChange={v => set('billing_address', v)}
              placeholder="Search or type billing address…"
            />
            <div>
              <Label className="text-xs font-medium text-slate-700">GSTIN</Label>
              <Input className="h-9 text-sm mt-1" value={form.customer_gstin} onChange={e => set('customer_gstin', e.target.value)} placeholder="e.g. 06AAHCK7191E1ZF" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-700">Place of Supply</Label>
                <Input className="h-9 text-sm mt-1" value={form.place_of_supply} onChange={e => set('place_of_supply', e.target.value)} placeholder="State name" />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">GST Category</Label>
                <select className="w-full h-9 text-sm border border-slate-200 rounded-md px-2 mt-1" value={form.gst_category} onChange={e => set('gst_category', e.target.value)}>
                  <option value="">Select…</option>
                  <option value="Registered Regular">Registered Regular</option>
                  <option value="Unregistered">Unregistered</option>
                  <option value="SEZ">SEZ</option>
                  <option value="Overseas">Overseas</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Shipping Address */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Shipping Address</h3>
        {!editing ? (
          <div className="space-y-0">
            <InfoRow label="Shipping Address Name" value={order.customer_name} />
            <div className="py-2">
              <p className="text-xs text-slate-500 mb-1">Shipping Address</p>
              <p className="text-xs text-slate-800 whitespace-pre-line bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 leading-relaxed">
                {order.shipping_address || order.billing_address || '—'}
              </p>
            </div>
          </div>
        ) : (
          <AddressSearchDropdown
            label="Shipping Address"
            value={form.shipping_address}
            onChange={v => set('shipping_address', v)}
            placeholder="Same as billing or select different…"
          />
        )}
      </div>

      {/* Edit Actions */}
      {editing && (
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 h-11" onClick={() => { setEditing(false); setForm({ billing_address: order?.billing_address || '', shipping_address: order?.shipping_address || '', customer_gstin: order?.customer_gstin || '', place_of_supply: order?.place_of_supply || '', gst_category: order?.gst_category || '' }); }}>
            Cancel
          </Button>
          <Button className="flex-1 h-11 gap-2" onClick={handleSave} disabled={saving}>
            <CheckCircle2 className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save Address'}
          </Button>
        </div>
      )}

      {!isEditable && (
        <p className="text-xs text-slate-400 italic text-center">Address can only be edited when the order is in Draft or Logistics Review stage.</p>
      )}

      {/* Order Details */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Order Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          {[
            { label: 'Purchase Order Number', value: order.po_number },
            { label: 'Purchase Order Date', value: order.po_date },
            { label: 'Purchase Order Expiry', value: order.po_expiry_date },
            { label: 'Delivery Date', value: order.po_delivery_date },
            { label: 'Payment Terms', value: order.payment_terms },
            { label: 'Vendor Number', value: order.vendor_no },
            { label: 'Platform', value: order.platform },
            { label: 'Source', value: order.source },
          ].filter(f => f.value).map(f => <InfoRow key={f.label} label={f.label} value={f.value} />)}
        </div>
      </div>
    </div>
  );
}