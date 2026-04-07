import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, Truck, Camera, FileText, Languages } from 'lucide-react';
import PhotoUploader from '@/components/grn/PhotoUploader';
import { showErrorAlert, showSuccessToast } from '@/lib/toastHelpers';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ChecklistGate from '@/components/grn/ChecklistGate';
import { genId, logGrnAudit, getChecklistTemplate } from '@/components/grn/grnHelpers';
import { fireFMSEvent } from '@/lib/useFMSAutoComplete';
import GateEntryInfoModal, { InfoButton } from '@/components/store/GateEntryInfoModal';
import { nextSerial } from '@/lib/serialCounter';
import { useNavigate } from 'react-router-dom';
import { History, Loader2 as LoaderIcon } from 'lucide-react';

function GateEntryHistory() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    base44.entities.GateEntry.list('-created_date', 100).then(d => { setEntries(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  if (loading) return <div className="py-8 text-center text-slate-400"><LoaderIcon className="w-5 h-5 animate-spin mx-auto" /></div>;
  if (entries.length === 0) return <div className="py-12 text-center text-slate-400">No Gate Entry records yet.</div>;
  return (
    <div className="space-y-3 max-w-4xl">
      {entries.map(e => (
        <div key={e.id} className="bg-white border border-slate-200 rounded-xl p-4 md:p-5 hover:shadow-sm transition-shadow">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
            <span className="font-bold font-mono text-slate-900 text-sm md:text-base">{e.gate_id}</span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${e.status === 'PROCESSED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{e.status}</span>
          </div>
          <div className="text-xs text-slate-500 grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            <span>Arrived: {e.arrived_at ? new Date(e.arrived_at).toLocaleString('en-IN') : '—'}</span>
            {e.vehicle_number && <span>Vehicle: {e.vehicle_number}</span>}
            {e.driver_number && <span>Driver Mobile: {e.driver_number}</span>}
            {e.driver_name && <span>Driver: {e.driver_name}</span>}
          </div>
          {e.vehicle_photo && <div className="flex gap-2 mt-3 flex-wrap">
            <img src={e.vehicle_photo} alt="vehicle" className="w-14 h-10 object-cover rounded border" />
            {e.invoice_photo && <img src={e.invoice_photo} alt="invoice" className="w-14 h-10 object-cover rounded border" />}
            {e.material_photo && <img src={e.material_photo} alt="material" className="w-14 h-10 object-cover rounded border" />}
          </div>}
        </div>
      ))}
    </div>
  );
}

// Hindi / English label maps
const T = {
  en: {
    title: 'Gate Entry',
    steps: ['Capture Photos', 'Enter Details', 'Review & Submit'],
    photoSubtitle: 'Capture required photos for verification',
    transportType: 'Transport Type',
    vehiclePhoto: 'Vehicle Photo',
    invoicePhoto: 'Invoice / Document Photo',
    materialPhoto: 'Material / Goods Photo',
    vehiclePhotoHelp: 'Clear photo of vehicle from front or side',
    invoicePhotoHelp: 'Capture invoice or delivery document clearly',
    materialPhotoHelp: 'Photo of goods being received',
    tapToUpload: 'Tap to upload',
    vehicleNumber: 'Vehicle Number',
    driverName: 'Driver Name (optional)',
    driverNumber: 'Driver Mobile Number',
    driverNumberPlaceholder: 'e.g. 9876543210',
    driverNamePlaceholder: 'Driver name',
    phoneValidation: 'Enter a valid 10-digit mobile number starting with 6–9',
    notes: 'Notes',
    notesPlaceholder: 'Any remarks...',
    continue: 'Continue to Details →',
    back: '← Back',
    next: 'Review →',
    submit: 'Submit Gate Entry',
    submitting: 'Submitting...',
    success: 'Gate Entry Created',
    proceedGRN: 'Proceed to Goods Receipt →',
    newEntry: 'New Gate Entry',
    checklistTitle: 'Gate Entry Checklist',
    tabs: { new: 'New Gate Entry', history: 'Documents / History' },
    reviewLabels: { transport: 'Transport', vehicleNumber: 'Vehicle Number', driverName: 'Driver Name', driverNumber: 'Driver Number', notes: 'Notes' },
    transport: {
      vehicle: 'Vehicle (Car, Truck, Bike)',
      bicycle: 'Bicycle / Cycle Rickshaw',
      manual: 'Manual (Foot / Hand Delivery)',
      other: 'Other',
    },
    validation: {
      vehiclePhoto: 'Vehicle photo is required.',
      invoicePhoto: 'Invoice photo is required.',
      materialPhoto: 'Material / Goods photo is required.',
      driverNumber: 'Driver mobile number is required.',
      driverNumberFormat: 'Enter a valid 10-digit Indian mobile number.',
      vehicleNumber: 'Vehicle number is required.',
    },
  },
  hi: {
    title: 'गेट एंट्री',
    steps: ['फ़ोटो लें', 'विवरण दर्ज करें', 'समीक्षा करें और सबमिट करें'],
    photoSubtitle: 'सत्यापन के लिए आवश्यक फ़ोटो लें',
    transportType: 'परिवहन का प्रकार',
    vehiclePhoto: 'वाहन की फ़ोटो',
    invoicePhoto: 'इनवॉयस / दस्तावेज़ फ़ोटो',
    materialPhoto: 'सामान / माल की फ़ोटो',
    vehiclePhotoHelp: 'वाहन की सामने या बगल से स्पष्ट फ़ोटो लें',
    invoicePhotoHelp: 'इनवॉयस या डिलीवरी दस्तावेज़ की स्पष्ट फ़ोटो लें',
    materialPhotoHelp: 'प्राप्त हो रहे सामान की फ़ोटो लें',
    tapToUpload: 'अपलोड करने के लिए टैप करें',
    vehicleNumber: 'वाहन नंबर',
    driverName: 'चालक का नाम (वैकल्पिक)',
    driverNumber: 'चालक का मोबाइल नंबर',
    driverNumberPlaceholder: 'जैसे 9876543210',
    driverNamePlaceholder: 'चालक का नाम',
    phoneValidation: '6–9 से शुरू होने वाला सही 10 अंकों का मोबाइल नंबर दर्ज करें',
    notes: 'टिप्पणी',
    notesPlaceholder: 'कोई टिप्पणी...',
    continue: 'विवरण की ओर जाएं →',
    back: '← वापस',
    next: 'समीक्षा करें →',
    submit: 'गेट एंट्री सबमिट करें',
    submitting: 'सबमिट हो रहा है...',
    success: 'गेट एंट्री बनाई गई',
    proceedGRN: 'माल रसीद की ओर जाएं →',
    newEntry: 'नई गेट एंट्री',
    checklistTitle: 'गेट एंट्री चेकलिस्ट',
    tabs: { new: 'नई गेट एंट्री', history: 'दस्तावेज़ / इतिहास' },
    reviewLabels: { transport: 'परिवहन', vehicleNumber: 'वाहन नंबर', driverName: 'चालक का नाम', driverNumber: 'चालक का नंबर', notes: 'टिप्पणी' },
    transport: {
      vehicle: 'वाहन (कार, ट्रक, बाइक)',
      bicycle: 'साइकिल / साइकिल रिक्शा',
      manual: 'पैदल / हाथ से डिलीवरी',
      other: 'अन्य',
    },
    validation: {
      vehiclePhoto: 'वाहन की फ़ोटो आवश्यक है।',
      invoicePhoto: 'इनवॉयस फ़ोटो आवश्यक है।',
      materialPhoto: 'सामान की फ़ोटो आवश्यक है।',
      driverNumber: 'चालक का मोबाइल नंबर आवश्यक है।',
      driverNumberFormat: 'सही 10 अंकों का भारतीय मोबाइल नंबर दर्ज करें।',
      vehicleNumber: 'वाहन नंबर आवश्यक है।',
    },
  },
};

function isValidIndianPhone(num) {
  return /^[6-9]\d{9}$/.test(num.replace(/\s/g, ''));
}

export default function GateEntryPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState('en');
  const t = T[lang];

  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('new');
  const [step, setStep] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [form, setForm] = useState({
    transport_type: 'vehicle',
    vehicle_number: '',
    driver_name: '',
    driver_number: '',
    notes: '',
    vehicle_photo: '',
    material_photo: '',
    invoice_photo: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [checklistTemplate, setChecklistTemplate] = useState(null);
  const [loadingCL, setLoadingCL] = useState(false);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  function setField(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  function validateStep0() {
    if (form.transport_type === 'vehicle' && !form.vehicle_photo) {
      showErrorAlert(lang === 'hi' ? 'सत्यापन त्रुटि' : 'Validation Error', t.validation.vehiclePhoto); return false;
    }
    if (!form.invoice_photo) {
      showErrorAlert(lang === 'hi' ? 'सत्यापन त्रुटि' : 'Validation Error', t.validation.invoicePhoto); return false;
    }
    if (!form.material_photo) {
      showErrorAlert(lang === 'hi' ? 'सत्यापन त्रुटि' : 'Validation Error', t.validation.materialPhoto); return false;
    }
    return true;
  }

  function validateStep1() {
    if (form.transport_type === 'vehicle' && !form.vehicle_number?.trim()) {
      showErrorAlert(lang === 'hi' ? 'सत्यापन त्रुटि' : 'Validation Error', t.validation.vehicleNumber); return false;
    }
    if (!form.driver_number?.trim()) {
      showErrorAlert(lang === 'hi' ? 'सत्यापन त्रुटि' : 'Validation Error', t.validation.driverNumber); return false;
    }
    if (!isValidIndianPhone(form.driver_number)) {
      showErrorAlert(lang === 'hi' ? 'सत्यापन त्रुटि' : 'Validation Error', t.validation.driverNumberFormat); return false;
    }
    return true;
  }

  async function handleSubmit() {
    setSubmitting(true);
    const gate_id = await nextSerial('GE');
    const gateEntry = await base44.entities.GateEntry.create({
      gate_id,
      arrived_at: new Date().toISOString(),
      vehicle_number: form.vehicle_number.trim() || undefined,
      driver_name: form.driver_name.trim() || undefined,
      driver_number: form.driver_number.trim(),
      notes: form.notes.trim() || undefined,
      vehicle_photo: form.vehicle_photo || undefined,
      material_photo: form.material_photo || undefined,
      invoice_photo: form.invoice_photo || undefined,
      status: 'OPEN',
    });

    await logGrnAudit({
      action: 'GATE_ENTRY_CREATED', entity_type: 'GateEntry',
      entity_id: gate_id, details: { vehicle: form.vehicle_number }, user,
    });
    await fireFMSEvent('gate_entry_created', gateEntry.id);
    showSuccessToast(lang === 'hi' ? 'गेट एंट्री बनाई गई' : 'Gate Entry created successfully!');

    setLoadingCL(true);
    const tmpl = await getChecklistTemplate('GATE_ENTRY', 'CREATE');
    setLoadingCL(false);

    if (tmpl) {
      setChecklistTemplate({ tmpl, gate_id, entry_id: gateEntry.id });
    } else {
      setDone({ gate_id });
    }
    setSubmitting(false);
  }

  async function handleChecklistDone(runId) {
    const { gate_id } = checklistTemplate;
    await base44.entities.GateEntryChecklistRun.create({
      gate_id, checklist_run_id: runId,
      completed_by: user?.email, completed_at: new Date().toISOString(),
    });
    await base44.entities.GateEntry.filter({ gate_id }).then(([ge]) => {
      if (ge) base44.entities.GateEntry.update(ge.id, { checklist_run_id: runId });
    });
    showSuccessToast(lang === 'hi' ? 'चेकलिस्ट पूरी हुई' : 'Checklist completed!');
    setDone({ gate_id });
  }

  function resetForm() {
    setDone(null); setStep(0);
    setForm({ transport_type: 'vehicle', vehicle_number: '', driver_name: '', driver_number: '', notes: '', vehicle_photo: '', material_photo: '', invoice_photo: '' });
    setChecklistTemplate(null);
  }

  // ── Success screen — just reset to new entry ─────────────────────────────────
  useEffect(() => {
    if (done) {
      // Auto-reset to new form after success
      const timer = setTimeout(() => resetForm(), 100);
      return () => clearTimeout(timer);
    }
  }, [done]);

  // ── Checklist screen ─────────────────────────────────────────────────────────
  if (checklistTemplate) {
    return (
      <div className="min-h-screen bg-slate-50 pb-12">
        <div className="max-w-4xl mx-auto px-3 md:px-4 lg:px-6 py-6 space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">{t.checklistTitle}</h2>
          {loadingCL ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /> : (
            <ChecklistGate
              template={checklistTemplate.tmpl}
              entityId={checklistTemplate.gate_id}
              entityType="GateEntry"
              user={user}
              onComplete={handleChecklistDone}
              onSkip={() => setDone({ gate_id: checklistTemplate.gate_id })}
            />
          )}
        </div>
      </div>
    );
  }

  // ── Main form ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <ToastContainer />
      <div className="max-w-4xl mx-auto px-3 md:px-4 lg:px-6 py-6 space-y-4">
        {showInfo && <GateEntryInfoModal onClose={() => setShowInfo(false)} />}

        {/* Header bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <h1 className="text-2xl font-bold text-slate-900">{t.title}</h1>
          <div className="flex items-center gap-2">
            <InfoButton onClick={() => setShowInfo(true)} />
            <button
              onClick={() => setLang(l => l === 'en' ? 'hi' : 'en')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
            >
              <Languages className="w-4 h-4" />
              {lang === 'en' ? 'हिंदी' : 'English'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex justify-center border-b border-slate-200 overflow-x-auto">
          {[{ id: 'new', labelKey: 'new', icon: FileText }, { id: 'history', labelKey: 'history', icon: History }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              <tab.icon className="w-4 h-4" />{t.tabs[tab.labelKey]}
            </button>
          ))}
        </div>

        {activeTab === 'history' && <GateEntryHistory />}

        {/* Step indicator */}
        {activeTab === 'new' && <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {t.steps.map((s, i) => (
            <div key={i} className="flex items-center gap-1 flex-1 min-w-max">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                i < step ? 'bg-green-500 text-white' : i === step ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-slate-900' : 'text-slate-400'}`}>{s}</span>
              {i < t.steps.length - 1 && <div className={`flex-1 h-0.5 hidden sm:block ${i < step ? 'bg-green-400' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>}

        {/* ── Step 0: Photos ── */}
        {activeTab === 'new' && step === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Camera className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-slate-900">{t.steps[0]}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{t.photoSubtitle}</p>
              </div>
            </div>
            
            <div>
              <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{t.transportType} *</Label>
              <select
                value={form.transport_type}
                onChange={e => setField('transport_type', e.target.value)}
                className="w-full h-11 md:h-10 border border-slate-200 rounded-xl px-4 py-2.5 text-base md:text-sm mt-2 bg-white font-medium"
              >
                <option value="vehicle">{t.transport.vehicle}</option>
                <option value="bicycle">{t.transport.bicycle}</option>
                <option value="manual">{t.transport.manual}</option>
                <option value="other">{t.transport.other}</option>
              </select>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {form.transport_type === 'vehicle' && (
                <div>
                  <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 block">{t.vehiclePhoto} <span className="text-red-500">*</span></Label>
                  <PhotoUploader required value={form.vehicle_photo} onChange={v => setField('vehicle_photo', v)} />
                  <p className="text-xs text-slate-500 mt-1.5">{t.vehiclePhotoHelp}</p>
                </div>
              )}
              <div>
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 block">{t.invoicePhoto} <span className="text-red-500">*</span></Label>
                <PhotoUploader required value={form.invoice_photo} onChange={v => setField('invoice_photo', v)} />
                <p className="text-xs text-slate-500 mt-1.5">{t.invoicePhotoHelp}</p>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 block">{t.materialPhoto} <span className="text-red-500">*</span></Label>
                <PhotoUploader required value={form.material_photo} onChange={v => setField('material_photo', v)} />
                <p className="text-xs text-slate-500 mt-1.5">{t.materialPhotoHelp}</p>
              </div>
            </div>
            
            <Button onClick={() => { if (validateStep0()) setStep(1); }} className="w-full h-12 md:h-11 bg-slate-900 hover:bg-slate-800 text-base md:text-sm font-medium rounded-xl">
              {t.continue}
            </Button>
          </div>
        )}

        {/* ── Step 1: Details ── */}
        {activeTab === 'new' && step === 1 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-slate-600" />
              <h2 className="font-bold text-slate-900">{t.steps[1]}</h2>
            </div>

            {form.transport_type === 'vehicle' && (
              <div>
                <Label className="text-xs font-medium text-slate-700">{t.vehicleNumber} *</Label>
                <Input
                  className="h-11 text-base md:text-sm mt-2 font-mono uppercase"
                  value={form.vehicle_number}
                  onChange={e => setField('vehicle_number', e.target.value.toUpperCase())}
                  placeholder="e.g. MH12AB1234"
                />
              </div>
            )}

            <div>
              <Label className="text-xs font-medium text-slate-700">{t.driverName}</Label>
              <Input
                className="h-11 md:h-9 text-base md:text-sm mt-2"
                value={form.driver_name}
                onChange={e => setField('driver_name', e.target.value)}
                placeholder={t.driverNamePlaceholder}
              />
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">{t.driverNumber} *</Label>
              <Input
                className="h-11 text-base mt-2"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={form.driver_number}
                onChange={e => setField('driver_number', e.target.value.replace(/\D/g, ''))}
                placeholder={t.driverNumberPlaceholder}
              />
              {form.driver_number && !isValidIndianPhone(form.driver_number) && (
                <p className="text-xs text-red-500 mt-1">{t.phoneValidation}</p>
              )}
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">{t.notes}</Label>
              <textarea
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                rows={2}
                placeholder={t.notesPlaceholder}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base md:text-sm resize-none mt-2"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)} className="flex-1 h-11 md:h-12 text-sm md:text-base">{t.back}</Button>
              <Button onClick={() => { if (validateStep1()) setStep(2); }} className="flex-1 h-11 md:h-12 bg-slate-900 text-sm md:text-base">{t.next}</Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Review ── */}
        {activeTab === 'new' && step === 2 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-600" />
              <h2 className="font-bold text-slate-900">{t.steps[2]}</h2>
            </div>
            <div className="space-y-2 text-sm">
              <Row label={t.reviewLabels.transport} value={form.transport_type} />
              {form.transport_type === 'vehicle' && <Row label={t.reviewLabels.vehicleNumber} value={form.vehicle_number} />}
              {form.driver_name && <Row label={t.reviewLabels.driverName} value={form.driver_name} />}
              <Row label={t.reviewLabels.driverNumber} value={form.driver_number} />
              {form.notes && <Row label={t.reviewLabels.notes} value={form.notes} />}
            </div>
            <div className="flex gap-3 flex-wrap">
              {form.vehicle_photo && <img src={form.vehicle_photo} alt="vehicle" className="w-20 h-16 object-cover rounded-lg border" />}
              {form.invoice_photo && <img src={form.invoice_photo} alt="invoice" className="w-20 h-16 object-cover rounded-lg border" />}
              {form.material_photo && <img src={form.material_photo} alt="material" className="w-20 h-16 object-cover rounded-lg border" />}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-11 md:h-12 text-sm md:text-base">{t.back}</Button>
              <Button onClick={handleSubmit} disabled={submitting} className="flex-1 h-11 md:h-12 bg-green-600 hover:bg-green-700 text-sm md:text-base">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                {submitting ? t.submitting : t.submit}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-100">
      <span className="text-slate-600 font-medium">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}