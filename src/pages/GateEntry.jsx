import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Truck, Camera, FileText } from 'lucide-react';
import PhotoUploader from '@/components/grn/PhotoUploader';
import ChecklistGate from '@/components/grn/ChecklistGate';
import { genId, logGrnAudit, getChecklistTemplate } from '@/components/grn/grnHelpers';

const STEPS = ['Vehicle Details', 'Photos', 'Review & Submit'];

export default function GateEntryPage() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ vehicle_number: '', driver_name: '', supplier_name_text: '', notes: '', invoice_photo: '', vehicle_photo: '', weighbridge_slip_photo: '' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [checklistTemplate, setChecklistTemplate] = useState(null);
  const [checklistDone, setChecklistDone] = useState(false);
  const [loadingCL, setLoadingCL] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  function setField(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  function canProceedStep1() { return form.vehicle_number.trim().length >= 2; }
  function canProceedStep2() { return form.invoice_photo && form.vehicle_photo; }

  async function handleSubmit() {
    setSubmitting(true);
    const gate_id = genId('GE');
    await base44.entities.GateEntry.create({
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
    await logGrnAudit({ action: 'GATE_ENTRY_CREATED', entity_type: 'GateEntry', entity_id: gate_id, details: { vehicle: form.vehicle_number }, user });

    // Load checklist if configured
    setLoadingCL(true);
    const tmpl = await getChecklistTemplate('GATE_ENTRY', 'CREATE');
    setLoadingCL(false);

    if (tmpl) {
      setChecklistTemplate({ tmpl, gate_id });
    } else {
      setDone(gate_id);
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
    setDone(gate_id);
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto pt-12 text-center space-y-4">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
        <h2 className="text-2xl font-bold text-slate-900">Gate Entry Created</h2>
        <p className="text-slate-500 font-mono text-lg">{done}</p>
        <p className="text-sm text-slate-400">Receiver will be notified. Hand over to Store Receiver.</p>
        <Button onClick={() => { setDone(null); setStep(0); setForm({ vehicle_number: '', driver_name: '', supplier_name_text: '', notes: '', invoice_photo: '', vehicle_photo: '', weighbridge_slip_photo: '' }); setChecklistTemplate(null); setChecklistDone(false); }} className="w-full h-12 bg-slate-900">
          New Gate Entry
        </Button>
      </div>
    );
  }

  if (checklistTemplate) {
    return (
      <div className="max-w-lg mx-auto space-y-4 pb-12">
        <h2 className="text-xl font-bold text-slate-900">Gate Entry Checklist</h2>
        {loadingCL ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /> : (
          <ChecklistGate
            template={checklistTemplate.tmpl}
            entityId={checklistTemplate.gate_id}
            entityType="GateEntry"
            user={user}
            onComplete={handleChecklistDone}
            onSkip={() => setDone(checklistTemplate.gate_id)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-12">
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

      {/* Step 1 */}
      {step === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Truck className="w-5 h-5 text-slate-600" />
            <h2 className="font-bold text-slate-900">Vehicle Details</h2>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Vehicle Number <span className="text-red-500">*</span></label>
            <input type="text" value={form.vehicle_number} onChange={e => setField('vehicle_number', e.target.value.toUpperCase())}
              placeholder="e.g. MH12AB1234" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base font-mono uppercase" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Driver Name <span className="text-slate-400 font-normal">(optional)</span></label>
            <input type="text" value={form.driver_name} onChange={e => setField('driver_name', e.target.value)}
              placeholder="Driver name" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Supplier / Party Name <span className="text-slate-400 font-normal">(optional)</span></label>
            <input type="text" value={form.supplier_name_text} onChange={e => setField('supplier_name_text', e.target.value)}
              placeholder="As written on invoice" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} rows={2}
              placeholder="Any remarks…" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none" />
          </div>
          <Button onClick={() => setStep(1)} disabled={!canProceedStep1()} className="w-full h-12 bg-slate-900">Next →</Button>
        </div>
      )}

      {/* Step 2 */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Camera className="w-5 h-5 text-slate-600" />
            <h2 className="font-bold text-slate-900">Upload Photos</h2>
          </div>
          <div className="flex gap-4 flex-wrap">
            <PhotoUploader label="Invoice Photo" required value={form.invoice_photo} onChange={v => setField('invoice_photo', v)} />
            <PhotoUploader label="Vehicle Photo" required value={form.vehicle_photo} onChange={v => setField('vehicle_photo', v)} />
            <PhotoUploader label="Weighbridge Slip" value={form.weighbridge_slip_photo} onChange={v => setField('weighbridge_slip_photo', v)} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(0)} className="flex-1 h-12">← Back</Button>
            <Button onClick={() => setStep(2)} disabled={!canProceedStep2()} className="flex-1 h-12 bg-slate-900">Review →</Button>
          </div>
        </div>
      )}

      {/* Step 3 – review */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-5 h-5 text-slate-600" />
            <h2 className="font-bold text-slate-900">Review & Submit</h2>
          </div>
          <div className="space-y-2 text-sm">
            <Row label="Vehicle Number" value={form.vehicle_number} />
            {form.driver_name && <Row label="Driver" value={form.driver_name} />}
            {form.supplier_name_text && <Row label="Supplier (text)" value={form.supplier_name_text} />}
            {form.notes && <Row label="Notes" value={form.notes} />}
            <Row label="Arrived at" value={new Date().toLocaleString('en-IN')} />
          </div>
          <div className="flex gap-3">
            {form.invoice_photo && <img src={form.invoice_photo} alt="invoice" className="w-24 h-16 object-cover rounded-lg border border-slate-200" />}
            {form.vehicle_photo && <img src={form.vehicle_photo} alt="vehicle" className="w-24 h-16 object-cover rounded-lg border border-slate-200" />}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-12">← Back</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1 h-12 bg-green-600 hover:bg-green-700">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Submit Gate Entry
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