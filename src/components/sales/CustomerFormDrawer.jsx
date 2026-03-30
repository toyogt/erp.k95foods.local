import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { X, Check, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const TABS = ['Basic', 'Contact', 'Address', 'Finance', 'Sales', 'Tally & Flags'];

const GST_CATEGORIES = ['Registered Regular', 'Registered Composition', 'Unregistered', 'SEZ', 'Overseas', 'UIN Holders'];

function Field({ label, children, help }) {
  return (
    <div>
      <Label className="text-xs font-medium text-slate-700">{label}</Label>
      {children}
      {help && <p className="text-xs text-slate-400 mt-0.5">{help}</p>}
    </div>
  );
}

function TextInput({ field, form, setForm, type = 'text', placeholder }) {
  return (
    <Input type={type} className="h-9 text-sm mt-1" placeholder={placeholder}
      value={form[field] ?? ''}
      onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
  );
}

function Select({ field, form, setForm, options }) {
  return (
    <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm mt-1"
      value={form[field] ?? ''}
      onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}>
      <option value="">— Select —</option>
      {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
    </select>
  );
}

function Toggle({ field, label, form, setForm }) {
  return (
    <div className="flex items-center gap-2">
      <input type="checkbox" id={field} checked={!!form[field]}
        onChange={e => setForm(f => ({ ...f, [field]: e.target.checked }))} />
      <label htmlFor={field} className="text-sm text-slate-700">{label}</label>
    </div>
  );
}

export const BLANK_CUSTOMER = {
  name: '', code: '', series: '', customer_type: 'Company', customer_group: '', salutation: '',
  first_name: '', last_name: '', gender: '', contact_name: '', mobile_no: '', phone: '',
  email: '', website: '', gstin: '', pan: '', tax_id: '', gst_category: 'Registered Regular',
  tax_withholding_category: '', billing_address: '', shipping_address: '', primary_address: '',
  region: '', territory: '', outlet_id: '', customer_pos_id: '', place_of_supply: '',
  market_segment: '', industry: '', account_manager: '', sales_partner: '', commission_rate: 0,
  payment_terms: '', price_list: '', billing_currency: 'INR', default_bank_account: '',
  loyalty_program: '', loyalty_program_tier: '', print_language: '', customer_details: '',
  status: 'active', check_outstanding: false, outstanding_limit: 0, leverage_outstanding: 0,
  current_outstanding: 0, bypass_credit_limit_check: false, represents_company: false,
  is_internal_customer: false, allow_invoice_without_so: false,
  allow_invoice_without_dn: false, is_frozen: false, disabled: false,
  tally_synced: false, tally_sync_date: '', tally_sync_status: '', tally_parent_group: '', notes: '',
};

export default function CustomerFormDrawer({ editing, form, setForm, priceLists, onClose, onSaved }) {
  const { toast } = useToast();
  const [tab, setTab] = useState('Basic');
  const [saving, setSaving] = useState(false);

  function generateCode(existingCustomers, prefix = 'CUST') {
    const existing = existingCustomers
      .map(c => c.code)
      .filter(c => c?.startsWith(prefix + '-'))
      .map(c => parseInt(c.replace(prefix + '-', ''), 10))
      .filter(n => !isNaN(n));
    const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
    return `${prefix}-${String(next).padStart(3, '0')}`;
  }

  async function handleSave() {
    if (!form.name) { toast({ title: 'Customer name is required', variant: 'destructive' }); return; }
    setSaving(true);
    const data = {
      ...form,
      outstanding_limit: parseFloat(form.outstanding_limit) || 0,
      leverage_outstanding: parseFloat(form.leverage_outstanding) || 0,
      current_outstanding: parseFloat(form.current_outstanding) || 0,
      commission_rate: parseFloat(form.commission_rate) || 0,
    };
    if (editing) {
      await base44.entities.Customer.update(editing.id, data);
      toast({ title: 'Customer updated' });
    } else {
      await base44.entities.Customer.create(data);
      toast({ title: `Customer created` });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-end">
      <div className="bg-white h-full w-full max-w-lg overflow-y-auto shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-slate-900">{editing ? 'Edit Customer' : 'Add Customer'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 sticky top-[65px] bg-white z-10 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>{t}</button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-5 space-y-3 flex-1">
          {tab === 'Basic' && (
            <>
              <Field label="Customer Name *"><TextInput field="name" form={form} setForm={setForm} /></Field>
              <Field label="Customer Code" help="Leave blank to auto-assign (e.g. CUST-001)"><TextInput field="code" form={form} setForm={setForm} /></Field>
              <Field label="Series" help="e.g. CUST, DIST"><TextInput field="series" form={form} setForm={setForm} /></Field>
              <Field label="Customer Type"><Select field="customer_type" form={form} setForm={setForm} options={['Company', 'Individual']} /></Field>
              <Field label="Customer Group"><TextInput field="customer_group" form={form} setForm={setForm} /></Field>
              <Field label="Outlet ID"><TextInput field="outlet_id" form={form} setForm={setForm} /></Field>
              <Field label="Territory"><TextInput field="territory" form={form} setForm={setForm} /></Field>
              <Field label="Region"><TextInput field="region" form={form} setForm={setForm} /></Field>
              <Toggle field="represents_company" label="Represents Company" form={form} setForm={setForm} />
              <Field label="Market Segment"><TextInput field="market_segment" form={form} setForm={setForm} /></Field>
              <Field label="Industry"><TextInput field="industry" form={form} setForm={setForm} /></Field>
              <Field label="Account Manager"><TextInput field="account_manager" form={form} setForm={setForm} /></Field>
              <Field label="Customer POS ID"><TextInput field="customer_pos_id" form={form} setForm={setForm} /></Field>
              <Field label="Status">
                <Select field="status" form={form} setForm={setForm} options={['active', 'inactive', 'suspended']} />
              </Field>
              <Field label="Customer Details">
                <textarea className="w-full h-16 rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none"
                  value={form.customer_details ?? ''}
                  onChange={e => setForm(f => ({ ...f, customer_details: e.target.value }))} />
              </Field>
            </>
          )}

          {tab === 'Contact' && (
            <>
              <Field label="Salutation"><Select field="salutation" form={form} setForm={setForm} options={['Mr', 'Ms', 'Mrs', 'Dr', 'Prof']} /></Field>
              <Field label="First Name"><TextInput field="first_name" form={form} setForm={setForm} /></Field>
              <Field label="Last Name"><TextInput field="last_name" form={form} setForm={setForm} /></Field>
              <Field label="Contact Name"><TextInput field="contact_name" form={form} setForm={setForm} /></Field>
              <Field label="Gender"><Select field="gender" form={form} setForm={setForm} options={['Male', 'Female', 'Other']} /></Field>
              <Field label="Mobile Number"><TextInput field="mobile_no" form={form} setForm={setForm} type="tel" /></Field>
              <Field label="Phone"><TextInput field="phone" form={form} setForm={setForm} type="tel" /></Field>
              <Field label="Email ID"><TextInput field="email" form={form} setForm={setForm} type="email" /></Field>
              <Field label="Website"><TextInput field="website" form={form} setForm={setForm} /></Field>
              <Field label="Print Language"><TextInput field="print_language" form={form} setForm={setForm} /></Field>
            </>
          )}

          {tab === 'Address' && (
            <>
              <Field label="Billing Address">
                <textarea className="w-full h-16 rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none"
                  value={form.billing_address ?? ''}
                  onChange={e => setForm(f => ({ ...f, billing_address: e.target.value }))} />
              </Field>
              <Field label="Shipping Address">
                <textarea className="w-full h-16 rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none"
                  value={form.shipping_address ?? ''}
                  onChange={e => setForm(f => ({ ...f, shipping_address: e.target.value }))} />
              </Field>
              <Field label="Primary Address"><TextInput field="primary_address" form={form} setForm={setForm} /></Field>
              <Field label="Place of Supply (State Code)"><TextInput field="place_of_supply" form={form} setForm={setForm} /></Field>
              <Field label="GSTIN / UIN"><TextInput field="gstin" form={form} setForm={setForm} /></Field>
              <Field label="PAN"><TextInput field="pan" form={form} setForm={setForm} /></Field>
              <Field label="Tax ID"><TextInput field="tax_id" form={form} setForm={setForm} /></Field>
              <Field label="GST Category"><Select field="gst_category" form={form} setForm={setForm} options={GST_CATEGORIES} /></Field>
              <Field label="Tax Category" help="e.g. In-State, Out-of-State"><TextInput field="tax_category" form={form} setForm={setForm} /></Field>
              <Field label="Tax Withholding Category"><TextInput field="tax_withholding_category" form={form} setForm={setForm} /></Field>
            </>
          )}

          {tab === 'Finance' && (
            <>
              <Field label="Default Price List" help="Auto-applied when creating orders for this customer">
                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm mt-1"
                  value={form.price_list || ''} onChange={e => setForm(f => ({ ...f, price_list: e.target.value }))}>
                  <option value="">— None —</option>
                  {priceLists.map(pl => <option key={pl} value={pl}>{pl}</option>)}
                </select>
              </Field>
              <Field label="Default Payment Terms"><TextInput field="payment_terms" form={form} setForm={setForm} /></Field>
              <Field label="Billing Currency"><TextInput field="billing_currency" form={form} setForm={setForm} placeholder="INR" /></Field>
              <Field label="Default Company Bank Account"><TextInput field="default_bank_account" form={form} setForm={setForm} /></Field>
              <Toggle field="check_outstanding" label="Check Credit Outstanding" form={form} setForm={setForm} />
              <Field label="Credit Limit (INR)"><TextInput field="outstanding_limit" form={form} setForm={setForm} type="number" /></Field>
              <Toggle field="bypass_credit_limit_check" label="Bypass Credit Limit Check at Sales Order" form={form} setForm={setForm} />
              <Field label="Leverage on Credit Limit (INR)"><TextInput field="leverage_outstanding" form={form} setForm={setForm} type="number" /></Field>
              <Field label="Current Outstanding (INR)"><TextInput field="current_outstanding" form={form} setForm={setForm} type="number" /></Field>
              <Field label="Loyalty Program"><TextInput field="loyalty_program" form={form} setForm={setForm} /></Field>
              <Field label="Loyalty Program Tier"><TextInput field="loyalty_program_tier" form={form} setForm={setForm} /></Field>
            </>
          )}

          {tab === 'Sales' && (
            <>
              <Field label="Sales Partner"><TextInput field="sales_partner" form={form} setForm={setForm} /></Field>
              <Field label="Commission Rate (%)"><TextInput field="commission_rate" form={form} setForm={setForm} type="number" /></Field>
              <Toggle field="allow_invoice_without_so" label="Allow Invoice Creation Without Sales Order" form={form} setForm={setForm} />
              <Toggle field="allow_invoice_without_dn" label="Allow Invoice Creation Without Delivery Note" form={form} setForm={setForm} />
              <Toggle field="is_internal_customer" label="Is Internal Customer" form={form} setForm={setForm} />
              <Field label="Internal Notes">
                <textarea className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none"
                  value={form.notes ?? ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </Field>
            </>
          )}

          {tab === 'Tally & Flags' && (
            <>
              <Toggle field="tally_synced" label="Tally Synced" form={form} setForm={setForm} />
              <Field label="Tally Sync Date"><TextInput field="tally_sync_date" form={form} setForm={setForm} type="date" /></Field>
              <Field label="Tally Sync Status"><TextInput field="tally_sync_status" form={form} setForm={setForm} /></Field>
              <Field label="Tally Parent Group"><TextInput field="tally_parent_group" form={form} setForm={setForm} /></Field>
              <Toggle field="is_frozen" label="Is Frozen" form={form} setForm={setForm} />
              <Toggle field="disabled" label="Disabled" form={form} setForm={setForm} />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 border-t border-slate-100 sticky bottom-0 bg-white">
          <Button variant="outline" className="h-11 px-4" onClick={onClose}>Cancel</Button>
          <Button className="h-11 bg-slate-900 text-white" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
            Save Customer
          </Button>
        </div>
      </div>
    </div>
  );
}