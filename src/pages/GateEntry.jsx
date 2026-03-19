import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Truck, Camera, FileText, Zap, AlertCircle, Check, X } from 'lucide-react';
import PhotoUploader from '@/components/grn/PhotoUploader';
import ChecklistGate from '@/components/grn/ChecklistGate';
import { genId, logGrnAudit, getChecklistTemplate } from '@/components/grn/grnHelpers';
import { fireFMSEvent } from '@/lib/useFMSAutoComplete';

const STEPS = ['Capture Photos', 'Confirm Details', 'Review & Submit'];

export default function GateEntryPage() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ 
    transport_type: 'vehicle', // vehicle, bicycle, manual, other
    vehicle_number: '', 
    invoice_number: '',
    driver_name: '', 
    supplier_name_text: '', 
    notes: '', 
    invoice_photo: '', 
    vehicle_photo: '', 
    material_photo: '',
    weighbridge_slip_photo: '' 
  });
  const [extracting, setExtracting] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [checklistTemplate, setChecklistTemplate] = useState(null);
  const [checklistDone, setChecklistDone] = useState(false);
  const [loadingCL, setLoadingCL] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  function setField(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  function canProceedStep1() { return form.invoice_photo && (form.transport_type === 'vehicle' ? form.vehicle_photo : true); }
  
  function canProceedStep2() { 
    const hasInvoice = form.invoice_number?.trim().length >= 1;
    const hasVehicleNum = form.transport_type === 'vehicle' ? form.vehicle_number?.trim().length >= 2 : true;
    return hasInvoice && hasVehicleNum;
  }

  const handleAIExtract = async () => {
    if (!form.invoice_photo) {
      alert('Upload invoice photo first');
      return;
    }
    if (form.transport_type === 'vehicle' && !form.vehicle_photo) {
      alert('Upload vehicle photo first');
      return;
    }

    setExtracting(true);
    try {
      const res = await base44.functions.invoke('extractGateEntryData', {
        vehicle_photo: form.transport_type === 'vehicle' ? form.vehicle_photo : null,
        invoice_photo: form.invoice_photo,
        transport_type: form.transport_type,
      });
      
      setAiResult(res.data);
    } catch (err) {
      alert(`AI extraction failed: ${err.message}`);
    } finally {
      setExtracting(false);
    }
  };

  const applyAIExtraction = () => {
    if (!aiResult) return;
    
    // If invoice number not detected, ask to retake photo
    if (!aiResult.invoice_number) {
      const shouldRetake = confirm('Invoice number not detected clearly. Would you like to retake the invoice photo? Click OK to retake, Cancel to enter manually.');
      if (shouldRetake) {
        setAiResult(null);
        setField('invoice_photo', '');
        setStep(0);
        return;
      }
    }
    
    if (form.transport_type === 'vehicle') {
      setField('vehicle_number', aiResult.vehicle_number || '');
    }
    setField('invoice_number', aiResult.invoice_number || '');
    if (aiResult.supplier_name) setField('supplier_name_text', aiResult.supplier_name);
    setAiResult(null);
    setStep(2);
  };

  const rejectExtraction = () => {
    setAiResult(null);
  };

  async function handleSubmit() {
    setSubmitting(true);
    const gate_id = genId('GE');
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
    await logGrnAudit({ action: 'GATE_ENTRY_CREATED', entity_type: 'GateEntry', entity_id: gate_id, details: { vehicle: form.vehicle_number }, user });
    await fireFMSEvent('gate_entry_created', gateEntry.id);

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
        <Button onClick={() => { 
          setDone(null); 
          setStep(0); 
          setForm({ transport_type: 'vehicle', vehicle_number: '', invoice_number: '', driver_name: '', supplier_name_text: '', notes: '', invoice_photo: '', vehicle_photo: '', material_photo: '', weighbridge_slip_photo: '' }); 
          setChecklistTemplate(null); 
          setChecklistDone(false);
          setAiResult(null);
        }} className="w-full h-12 bg-slate-900">
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

      {/* Step 1: Capture Photos */}
      {step === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Camera className="w-5 h-5 text-slate-600" />
            <h2 className="font-bold text-slate-900">Capture Photos</h2>
          </div>
          
          <p className="text-sm text-slate-600">Take clear photos for AI to extract vehicle number and invoice details</p>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Transport Type *</label>
            <select
              value={form.transport_type}
              onChange={e => setField('transport_type', e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm"
            >
              <option value="vehicle">Vehicle (Car, Truck, Bike)</option>
              <option value="bicycle">Bicycle / Cycle Rickshaw</option>
              <option value="manual">Manual (Foot/Hand Delivery)</option>
              <option value="other">Other</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">Select the type of transport used for delivery</p>
          </div>

          <div className="space-y-4">
            {form.transport_type === 'vehicle' && (
              <PhotoUploader label="Vehicle Photo" required value={form.vehicle_photo} onChange={v => setField('vehicle_photo', v)} />
            )}
            <PhotoUploader label="Invoice Photo" required value={form.invoice_photo} onChange={v => setField('invoice_photo', v)} />
            <PhotoUploader label="Material/Goods Photo (optional)" value={form.material_photo} onChange={v => setField('material_photo', v)} />
            {form.transport_type === 'vehicle' && (
              <PhotoUploader label="Weighbridge Slip (optional)" value={form.weighbridge_slip_photo} onChange={v => setField('weighbridge_slip_photo', v)} />
            )}
          </div>

          <Button 
            onClick={handleAIExtract} 
            disabled={!canProceedStep1() || extracting}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 gap-2"
          >
            {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {extracting ? 'Extracting...' : 'Use AI to Extract Details'}
          </Button>

          {/* AI Result Display */}
          {aiResult && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900">AI Extracted Data</h3>
                  <p className="text-xs text-blue-700 mt-1">Please confirm the extracted information below</p>
                </div>
              </div>

              <div className="space-y-2 bg-white rounded-lg p-3">
                {form.transport_type === 'vehicle' && (
                  <div>
                    <label className="text-xs font-medium text-slate-600">Vehicle Number</label>
                    <div className="text-base font-mono font-semibold text-slate-900">{aiResult.vehicle_number || 'Not detected'}</div>
                  </div>
                )}
                <div className={aiResult.invoice_number ? '' : 'border-2 border-red-300 bg-red-50 rounded p-2'}>
                  <label className="text-xs font-medium text-slate-600">Invoice Number</label>
                  <div className="text-base font-mono font-semibold text-slate-900">{aiResult.invoice_number || '❌ Not detected - Please retake'}</div>
                  {!aiResult.invoice_number && (
                    <p className="text-xs text-red-600 mt-1">Invoice number is crucial. Click "Reject" to retake the photo for better clarity.</p>
                  )}
                </div>
                {aiResult.supplier_name && (
                  <div>
                    <label className="text-xs font-medium text-slate-600">Supplier Name</label>
                    <div className="text-base font-semibold text-slate-900">{aiResult.supplier_name}</div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={rejectExtraction}
                  variant="outline"
                  className="flex-1 gap-2"
                >
                  <X className="w-4 h-4" />
                  Reject
                </Button>
                <Button 
                  onClick={applyAIExtraction}
                  className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                >
                  <Check className="w-4 h-4" />
                  Confirm & Continue
                </Button>
              </div>
            </div>
          )}

          {/* Manual Entry Option */}
          {!aiResult && canProceedStep1() && (
            <Button 
              onClick={() => setStep(1)}
              variant="outline"
              className="w-full h-12"
            >
              Skip AI & Enter Manually →
            </Button>
          )}
        </div>
      )}

      {/* Step 2: Confirm Details */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Truck className="w-5 h-5 text-slate-600" />
            <h2 className="font-bold text-slate-900">Confirm Details</h2>
          </div>

          {form.transport_type === 'vehicle' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Vehicle Number <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                value={form.vehicle_number} 
                onChange={e => setField('vehicle_number', e.target.value.toUpperCase())}
                placeholder="e.g. MH12AB1234" 
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base font-mono uppercase" 
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Invoice Number <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              value={form.invoice_number} 
              onChange={e => setField('invoice_number', e.target.value)}
              placeholder="e.g. INV-2026-001234" 
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base" 
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Driver Name <span className="text-slate-400 font-normal">(optional)</span></label>
            <input 
              type="text" 
              value={form.driver_name} 
              onChange={e => setField('driver_name', e.target.value)}
              placeholder="Driver name" 
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base" 
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Supplier / Party Name <span className="text-slate-400 font-normal">(optional)</span></label>
            <input 
              type="text" 
              value={form.supplier_name_text} 
              onChange={e => setField('supplier_name_text', e.target.value)}
              placeholder="As written on invoice" 
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base" 
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Notes</label>
            <textarea 
              value={form.notes} 
              onChange={e => setField('notes', e.target.value)} 
              rows={2}
              placeholder="Any remarks…" 
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none" 
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(0)} className="flex-1 h-12">← Back</Button>
            <Button 
              onClick={() => setStep(2)} 
              disabled={!canProceedStep2()} 
              className="flex-1 h-12 bg-slate-900"
            >
              Review →
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Submit */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-5 h-5 text-slate-600" />
            <h2 className="font-bold text-slate-900">Review & Submit</h2>
          </div>

          <div className="space-y-2 text-sm">
            <Row label="Transport Type" value={form.transport_type.charAt(0).toUpperCase() + form.transport_type.slice(1)} />
            {form.transport_type === 'vehicle' && <Row label="Vehicle Number" value={form.vehicle_number} />}
            <Row label="Invoice Number" value={form.invoice_number} />
            {form.driver_name && <Row label="Driver" value={form.driver_name} />}
            {form.supplier_name_text && <Row label="Supplier (text)" value={form.supplier_name_text} />}
            {form.notes && <Row label="Notes" value={form.notes} />}
            <Row label="Arrived at" value={new Date().toLocaleString('en-IN')} />
          </div>

          <div className="flex gap-3 flex-wrap">
            {form.vehicle_photo && <img src={form.vehicle_photo} alt="vehicle" className="w-24 h-20 object-cover rounded-lg border border-slate-200" />}
            {form.invoice_photo && <img src={form.invoice_photo} alt="invoice" className="w-24 h-20 object-cover rounded-lg border border-slate-200" />}
            {form.material_photo && <img src={form.material_photo} alt="material" className="w-24 h-20 object-cover rounded-lg border border-slate-200" />}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-12">← Back</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={submitting} 
              className="flex-1 h-12 bg-green-600 hover:bg-green-700"
            >
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