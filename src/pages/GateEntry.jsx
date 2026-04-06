import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, Truck, Camera, FileText, Plus, Trash2, Search, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import PhotoUploader from '@/components/grn/PhotoUploader';
import ChecklistGate from '@/components/grn/ChecklistGate';
import { genId, logGrnAudit, getChecklistTemplate } from '@/components/grn/grnHelpers';
import { fireFMSEvent } from '@/lib/useFMSAutoComplete';
import ExportButton from '@/components/store/ExportButton';

// Searchable item name with UOM auto-fill
function ItemNameSelect({ value, onChangeName, onSelectItem }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    Promise.all([
      base44.entities.StoreOpeningStock.list('-created_date', 500),
      base44.entities.ItemMaster.list('-created_date', 500),
      base44.entities.StoreLot.list('-created_date', 500),
    ]).then(([os, im, lots]) => {
      const seen = new Set();
      const merged = [
        ...os.map(o => ({ item_name: o.item_name, item_code: o.item_code, uom: o.uom })),
        ...im.map(i => ({ item_name: i.item_name, item_code: i.item_code, uom: i.base_uom })),
        ...lots.map(l => ({ item_name: l.item_name, item_code: l.item_code, uom: l.uom })),
      ].filter(i => {
        const key = i.item_name?.trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setSuggestions(merged);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = query.trim()
    ? suggestions.filter(s => s.item_name?.toLowerCase().includes(query.toLowerCase()))
    : suggestions;

  function handleSelect(item) {
    setQuery(item.item_name);
    setOpen(false);
    onSelectItem(item);
  }

  function handleInput(e) {
    setQuery(e.target.value);
    onChangeName(e.target.value);
    setOpen(true);
  }

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          className="w-full h-9 pl-8 pr-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
          placeholder="Type to search or add new item..."
          value={query}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            query.trim() ? (
              <div
                className="px-4 py-2.5 text-sm text-blue-600 cursor-pointer hover:bg-blue-50 flex items-center gap-2"
                onClick={() => { setOpen(false); onChangeName(query); }}
              >
                <Plus className="w-3.5 h-3.5" /> Add "{query}" as new item
              </div>
            ) : <div className="px-4 py-3 text-sm text-slate-400">No items found. Start typing...</div>
          ) : (
            filtered.map((s, i) => (
              <div key={i} className="px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50" onClick={() => handleSelect(s)}>
                <p className="font-medium text-slate-800">{s.item_name}</p>
                {s.uom && <p className="text-xs text-slate-400">Unit: {s.uom}{s.item_code ? ` · ${s.item_code}` : ''}</p>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const STEPS = ['Capture Photos', 'Enter Details', 'Items Received', 'Review & Submit'];

function emptyItem() { return { item_name: '', item_code: '', quantity: '', uom: 'Nos', batch_lot: '', notes: '' }; }

export default function GateEntryPage() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    transport_type: 'vehicle',
    vehicle_number: '', invoice_number: '',
    driver_name: '', supplier_name_text: '', notes: '',
    invoice_photo: '', vehicle_photo: '', material_photo: '', weighbridge_slip_photo: ''
  });
  const [items, setItems] = useState([emptyItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [checklistTemplate, setChecklistTemplate] = useState(null);
  const [checklistDone, setChecklistDone] = useState(false);
  const [loadingCL, setLoadingCL] = useState(false);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  function setField(k, v) { setForm(prev => ({ ...prev, [k]: v })); }
  function setItem(idx, k, v) { setItems(prev => prev.map((it, i) => i === idx ? { ...it, [k]: v } : it)); }
  function addItem() { setItems(prev => [...prev, emptyItem()]); }
  function removeItem(idx) { setItems(prev => prev.filter((_, i) => i !== idx)); }

  function validateStep1() {
    if (!form.invoice_photo) { toast({ title: 'Invoice Photo is required *', variant: 'destructive' }); return false; }
    if (form.transport_type === 'vehicle' && !form.vehicle_photo) { toast({ title: 'Vehicle Photo is required *', variant: 'destructive' }); return false; }
    return true;
  }
  function validateStep2() {
    if (!form.invoice_number?.trim()) { toast({ title: 'Invoice Number is required *', variant: 'destructive' }); return false; }
    if (form.transport_type === 'vehicle' && !form.vehicle_number?.trim()) { toast({ title: 'Vehicle Number is required *', variant: 'destructive' }); return false; }
    if (!form.supplier_name_text?.trim()) { toast({ title: 'Supplier / Party Name is required *', variant: 'destructive' }); return false; }
    return true;
  }
  function canProceedStep1() { return form.invoice_photo && (form.transport_type === 'vehicle' ? form.vehicle_photo : true); }
  function canProceedStep2() {
    return form.invoice_number?.trim().length >= 1 && (form.transport_type === 'vehicle' ? form.vehicle_number?.trim().length >= 2 : true);
  }
  function canProceedStep3() {
    return items.some(it => it.item_name.trim() && parseFloat(it.quantity) > 0);
  }

  async function handleSubmit() {
    setSubmitting(true);
    const gate_id = genId('GE');
    const validItems = items.filter(it => it.item_name.trim() && parseFloat(it.quantity) > 0);

    // Create Gate Entry
    const gateEntry = await base44.entities.GateEntry.create({
      gate_id,
      arrived_at: new Date().toISOString(),
      vehicle_number: form.vehicle_number.trim(),
      driver_name: form.driver_name.trim() || undefined,
      supplier_name_text: form.supplier_name_text.trim() || undefined,
      notes: form.notes.trim() || undefined,
      invoice_photo: form.invoice_photo,
      vehicle_photo: form.vehicle_photo,
      weighbridge_slip_photo: form.weighbridge_slip_photo || undefined,
      status: 'OPEN',
    });

    // Create GRN Header directly
    const grn_id = genId('GRN');
    await base44.entities.GRNHeader.create({
      grn_id,
      gate_id,
      supplier_name: form.supplier_name_text.trim() || 'Unknown Supplier',
      status: 'DRAFT',
    });

    // Create GRN Items
    for (const it of validItems) {
      await base44.entities.GRNItem.create({
        grn_id,
        item_code: it.item_code || it.item_name,
        item_name: it.item_name,
        ordered_qty: parseFloat(it.quantity),
        received_qty: parseFloat(it.quantity),
        uom_code: it.uom || 'Nos',
        batch_or_lot_text: it.batch_lot || '',
        line_notes: it.notes || '',
      });
    }

    // Create Store Lots for each item
    for (const it of validItems) {
      const lotId = `LOT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const qty = parseFloat(it.quantity);
      await base44.entities.StoreLot.create({
        lot_id: lotId, qr_code: lotId,
        item_code: it.item_code || it.item_name,
        item_name: it.item_name,
        uom: it.uom || 'Nos',
        quantity: qty, remaining_quantity: qty,
        supplier_name: form.supplier_name_text.trim(),
        gate_entry_id: gate_id, grn_id,
        status: 'qc_pending',
      });
    }

    await logGrnAudit({ action: 'GATE_ENTRY_CREATED', entity_type: 'GateEntry', entity_id: gate_id, details: { vehicle: form.vehicle_number, items: validItems.length }, user });
    await fireFMSEvent('gate_entry_created', gateEntry.id);

    setLoadingCL(true);
    const tmpl = await getChecklistTemplate('GATE_ENTRY', 'CREATE');
    setLoadingCL(false);

    if (tmpl) {
      setChecklistTemplate({ tmpl, gate_id });
    } else {
      setDone({ gate_id, grn_id });
    }
    setSubmitting(false);
  }

  async function handleChecklistDone(runId) {
    const gate_id = checklistTemplate.gate_id;
    await base44.entities.GateEntryChecklistRun.create({ gate_id, checklist_run_id: runId, completed_by: user?.email, completed_at: new Date().toISOString() });
    await base44.entities.GateEntry.filter({ gate_id }).then(([ge]) => {
      if (ge) base44.entities.GateEntry.update(ge.id, { checklist_run_id: runId });
    });
    setChecklistDone(true);
    setDone({ gate_id });
  }

  function resetForm() {
    setDone(null); setStep(0);
    setForm({ transport_type: 'vehicle', vehicle_number: '', invoice_number: '', driver_name: '', supplier_name_text: '', notes: '', invoice_photo: '', vehicle_photo: '', material_photo: '', weighbridge_slip_photo: '' });
    setItems([emptyItem()]);
    setChecklistTemplate(null); setChecklistDone(false);
  }

  if (done) {
    return (
      <div className="max-w-2xl mx-auto pt-12 text-center space-y-4 px-4">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
        <h2 className="text-2xl font-bold text-slate-900">Gate Entry & GRN Created</h2>
        <p className="text-slate-500 font-mono text-lg">{done.gate_id}</p>
        {done.grn_id && <p className="text-sm text-slate-400">GRN: {done.grn_id} — Lots created and sent to QC</p>}
        <Button onClick={resetForm} className="w-full h-12 bg-slate-900">New Gate Entry</Button>
      </div>
    );
  }

  if (checklistTemplate) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-12 px-2 md:px-0">
        <h2 className="text-xl font-bold text-slate-900">Gate Entry Checklist</h2>
        {loadingCL ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /> : (
          <ChecklistGate template={checklistTemplate.tmpl} entityId={checklistTemplate.gate_id} entityType="GateEntry" user={user} onComplete={handleChecklistDone} onSkip={() => setDone({ gate_id: checklistTemplate.gate_id })} />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-12 px-2 md:px-0">
      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-1 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i < step ? 'bg-green-500 text-white' : i === step ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-slate-900' : 'text-slate-400'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? 'bg-green-400' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Photos */}
      {step === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
          <div className="flex items-center gap-2"><Camera className="w-5 h-5 text-slate-600" /><h2 className="font-bold text-slate-900">Capture Photos</h2></div>
          <p className="text-sm text-slate-600">Take clear photos of the vehicle and invoice</p>
          <div>
            <Label className="text-xs font-medium text-slate-700">Transport Type *</Label>
            <select value={form.transport_type} onChange={e => setField('transport_type', e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm mt-1">
              <option value="vehicle">Vehicle (Car, Truck, Bike)</option>
              <option value="bicycle">Bicycle / Cycle Rickshaw</option>
              <option value="manual">Manual (Foot/Hand Delivery)</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-4">
            {form.transport_type === 'vehicle' && <PhotoUploader label="Vehicle Photo" required value={form.vehicle_photo} onChange={v => setField('vehicle_photo', v)} />}
            <PhotoUploader label="Invoice Photo" required value={form.invoice_photo} onChange={v => setField('invoice_photo', v)} />
            <PhotoUploader label="Material/Goods Photo (optional)" value={form.material_photo} onChange={v => setField('material_photo', v)} />
            {form.transport_type === 'vehicle' && <PhotoUploader label="Weighbridge Slip (optional)" value={form.weighbridge_slip_photo} onChange={v => setField('weighbridge_slip_photo', v)} />}
          </div>
          {!canProceedStep1() && (
            <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="text-xs">Invoice photo is required. Vehicle photo required for vehicle transport.</p>
            </div>
          )}
          <Button onClick={() => { if (validateStep1()) setStep(1); }} className="w-full h-12 bg-slate-900">Continue to Details →</Button>
        </div>
      )}

      {/* Step 2: Details */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2"><Truck className="w-5 h-5 text-slate-600" /><h2 className="font-bold text-slate-900">Enter Details</h2></div>
          {form.transport_type === 'vehicle' && (
            <div>
              <Label className="text-xs font-medium text-slate-700">Vehicle Number *</Label>
              <Input className="h-11 text-base mt-1 font-mono uppercase" value={form.vehicle_number} onChange={e => setField('vehicle_number', e.target.value.toUpperCase())} placeholder="e.g. MH12AB1234" />
            </div>
          )}
          <div>
            <Label className="text-xs font-medium text-slate-700">Invoice Number *</Label>
            <Input className="h-11 text-base mt-1" value={form.invoice_number} onChange={e => setField('invoice_number', e.target.value)} placeholder="e.g. INV-2026-001234" />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Supplier / Party Name *</Label>
            <Input className="h-11 text-base mt-1" value={form.supplier_name_text} onChange={e => setField('supplier_name_text', e.target.value)} placeholder="As written on invoice" />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Driver Name (optional)</Label>
            <Input className="h-9 text-sm mt-1" value={form.driver_name} onChange={e => setField('driver_name', e.target.value)} placeholder="Driver name" />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Notes</Label>
            <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} rows={2} placeholder="Any remarks…" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none mt-1" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(0)} className="flex-1 h-11">← Back</Button>
            <Button onClick={() => { if (validateStep2()) setStep(2); }} className="flex-1 h-11 bg-slate-900">Items Received →</Button>
          </div>
        </div>
      )}

      {/* Step 3: Items Received */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2"><FileText className="w-5 h-5 text-slate-600" /><h2 className="font-bold text-slate-900">Items Received</h2></div>
          <p className="text-sm text-slate-500">Enter what you received in this delivery</p>
          <div className="space-y-3">
            {items.map((it, idx) => (
              <div key={idx} className="border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Item {idx + 1}</span>
                  {items.length > 1 && <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <Label className="text-xs font-medium text-slate-700">Item Name *</Label>
                    <div className="mt-1">
                      <ItemNameSelect
                        value={it.item_name}
                        onChangeName={v => setItem(idx, 'item_name', v)}
                        onSelectItem={item => {
                          setItem(idx, 'item_name', item.item_name);
                          if (item.item_code) setItem(idx, 'item_code', item.item_code);
                          if (item.uom) setItem(idx, 'uom', item.uom);
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Quantity *</Label>
                    <Input type="number" className="h-9 text-sm mt-1" value={it.quantity} onChange={e => setItem(idx, 'quantity', e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Unit</Label>
                    <select className="w-full h-9 border border-slate-200 rounded-md px-2 text-sm mt-1" value={it.uom} onChange={e => setItem(idx, 'uom', e.target.value)}>
                      <option value="Nos">Numbers</option>
                      <option value="Kg">Kilograms</option>
                      <option value="Ltr">Litres</option>
                      <option value="ML">Millilitres</option>
                      <option value="Pcs">Pieces</option>
                      <option value="Box">Boxes</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Item Code</Label>
                    <Input className="h-9 text-sm mt-1" value={it.item_code} onChange={e => setItem(idx, 'item_code', e.target.value)} placeholder="Optional" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Batch / Lot</Label>
                    <Input className="h-9 text-sm mt-1" value={it.batch_lot} onChange={e => setItem(idx, 'batch_lot', e.target.value)} placeholder="Optional" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full gap-2 h-11" onClick={addItem}><Plus className="w-4 h-4" /> Add Item</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-11">← Back</Button>
            <Button onClick={() => setStep(3)} disabled={!canProceedStep3()} className="flex-1 h-11 bg-slate-900">Review →</Button>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2"><FileText className="w-5 h-5 text-slate-600" /><h2 className="font-bold text-slate-900">Review & Submit</h2></div>
          <div className="space-y-2 text-sm">
            <Row label="Transport" value={form.transport_type} />
            {form.transport_type === 'vehicle' && <Row label="Vehicle Number" value={form.vehicle_number} />}
            <Row label="Invoice Number" value={form.invoice_number} />
            {form.supplier_name_text && <Row label="Supplier" value={form.supplier_name_text} />}
            {form.driver_name && <Row label="Driver" value={form.driver_name} />}
          </div>
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-500 mb-2">Items ({items.filter(it => it.item_name.trim()).length})</p>
            {items.filter(it => it.item_name.trim()).map((it, idx) => (
              <div key={idx} className="flex justify-between py-1.5 border-b border-slate-50 text-sm">
                <span className="text-slate-700">{it.item_name}</span>
                <span className="font-bold text-slate-900">{it.quantity} {it.uom}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3 flex-wrap">
            {form.vehicle_photo && <img src={form.vehicle_photo} alt="vehicle" className="w-20 h-16 object-cover rounded-lg border" />}
            {form.invoice_photo && <img src={form.invoice_photo} alt="invoice" className="w-20 h-16 object-cover rounded-lg border" />}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1 h-11">← Back</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1 h-11 bg-green-600 hover:bg-green-700">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Submit Entry + Create GRN
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-1 border-b border-slate-50">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}