import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Truck, ArrowRight } from 'lucide-react';
import { showErrorAlert, showSuccessToast } from '@/lib/toastHelpers';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ChecklistGate from '@/components/grn/ChecklistGate';
import { logGrnAudit, getChecklistTemplate } from '@/components/grn/grnHelpers';
import { fireFMSEvent } from '@/lib/useFMSAutoComplete';
import { nextSerial } from '@/lib/serialCounter';
import { useNavigate } from 'react-router-dom';
import useDraftSave from '@/hooks/useDraftSave';

import GateEntryHeader from '@/components/gate/GateEntryHeader';
import StepProgressBar from '@/components/gate/StepProgressBar';
import TransportTypePicker from '@/components/gate/TransportTypePicker';
import PhotoCaptureCard from '@/components/gate/PhotoCaptureCard';
import GateHistoryMobile from '@/components/gate/GateHistoryMobile';

// Hindi / English labels
const T = {
  en: {
    title: 'Gate Entry',
    steps: ['Capture Photos', 'Enter Details', 'Review & Submit'],
    photoSubtitle: 'Capture required photos for verification',
    transportLabels: { vehicle: 'Vehicle', courier: 'Courier', on_foot: 'On Foot' },
    vehiclePhoto: 'Vehicle Photo',
    invoicePhoto: 'Invoice / Document',
    materialPhoto: 'Goods / Material',
    vehiclePhotoHelp: 'Clear photo of vehicle from front or side',
    invoicePhotoHelp: 'Capture invoice or delivery document clearly',
    materialPhotoHelp: 'Photo of goods being received',
    vehicleNumber: 'Vehicle Number',
    driverName: 'Driver Name (optional)',
    driverNumber: 'Driver Mobile Number',
    driverNumberPlaceholder: 'e.g. 9876543210',
    driverNamePlaceholder: 'Driver name',
    phoneValidation: 'Enter a valid 10-digit mobile number starting with 6–9',
    notes: 'Notes',
    notesPlaceholder: 'Any remarks...',
    continue: 'Continue to Details',
    back: 'Back',
    next: 'Review',
    submit: 'Submit Gate Entry',
    submitting: 'Submitting...',
    checklistTitle: 'Gate Entry Checklist',
    guided: "You'll be guided through each photo in sequence",
    reviewLabels: { transport: 'Transport', vehicleNumber: 'Vehicle Number', driverName: 'Driver Name', driverNumber: 'Driver Number', notes: 'Notes' },
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
    steps: ['फ़ोटो लें', 'विवरण दर्ज करें', 'समीक्षा और सबमिट'],
    photoSubtitle: 'सत्यापन के लिए आवश्यक फ़ोटो लें',
    transportLabels: { vehicle: 'वाहन', courier: 'कूरियर', on_foot: 'पैदल' },
    vehiclePhoto: 'वाहन की फ़ोटो',
    invoicePhoto: 'इनवॉयस / दस्तावेज़',
    materialPhoto: 'सामान / माल',
    vehiclePhotoHelp: 'वाहन की सामने या बगल से स्पष्ट फ़ोटो',
    invoicePhotoHelp: 'इनवॉयस या डिलीवरी दस्तावेज़ की स्पष्ट फ़ोटो',
    materialPhotoHelp: 'प्राप्त हो रहे सामान की फ़ोटो',
    vehicleNumber: 'वाहन नंबर',
    driverName: 'चालक का नाम (वैकल्पिक)',
    driverNumber: 'चालक का मोबाइल नंबर',
    driverNumberPlaceholder: 'जैसे 9876543210',
    driverNamePlaceholder: 'चालक का नाम',
    phoneValidation: '6–9 से शुरू होने वाला 10 अंकों का मोबाइल नंबर दर्ज करें',
    notes: 'टिप्पणी',
    notesPlaceholder: 'कोई टिप्पणी...',
    continue: 'विवरण की ओर जाएं',
    back: 'वापस',
    next: 'समीक्षा',
    submit: 'गेट एंट्री सबमिट करें',
    submitting: 'सबमिट हो रहा है...',
    checklistTitle: 'गेट एंट्री चेकलिस्ट',
    guided: 'आपको क्रम में प्रत्येक फ़ोटो के लिए गाइड किया जाएगा',
    reviewLabels: { transport: 'परिवहन', vehicleNumber: 'वाहन नंबर', driverName: 'चालक का नाम', driverNumber: 'चालक का नंबर', notes: 'टिप्पणी' },
    validation: {
      vehiclePhoto: 'वाहन की फ़ोटो आवश्यक है।',
      invoicePhoto: 'इनवॉयस फ़ोटो आवश्यक है।',
      materialPhoto: 'सामान की फ़ोटो आवश्यक है।',
      driverNumber: 'चालक का मोबाइल नंबर आवश्यक है।',
      driverNumberFormat: 'सही 10 अंकों का मोबाइल नंबर दर्ज करें।',
      vehicleNumber: 'वाहन नंबर आवश्यक है।',
    },
  },
};

function isValidIndianPhone(num) {
  return /^[6-9]\d{9}$/.test(num.replace(/\s/g, ''));
}

const GATE_DRAFT_INITIAL = {
  transport_type: 'vehicle',
  vehicle_number: '',
  driver_name: '',
  driver_number: '',
  notes: '',
  vehicle_photo: '',
  material_photo: '',
  invoice_photo: '',
};

export default function GateEntryPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState('en');
  const t = T[lang];

  const [user, setUser] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm, clearDraft, hasDraft] = useDraftSave('gate_entry', GATE_DRAFT_INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [checklistTemplate, setChecklistTemplate] = useState(null);
  const [loadingCL, setLoadingCL] = useState(false);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  function setField(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  // Count completed photos
  const photosRequired = form.transport_type === 'vehicle' ? 3 : 2;
  const photosDone = [
    form.transport_type === 'vehicle' && form.vehicle_photo,
    form.invoice_photo,
    form.material_photo,
  ].filter(Boolean).length;

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
    clearDraft();
    setChecklistTemplate(null);
  }

  useEffect(() => {
    if (done) {
      const timer = setTimeout(() => resetForm(), 100);
      return () => clearTimeout(timer);
    }
  }, [done]);

  // Checklist screen
  if (checklistTemplate) {
    return (
      <div className="max-w-lg mx-auto px-3 py-4 space-y-4">
        <h2 className="text-xl font-bold text-slate-900">{t.checklistTitle}</h2>
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
    );
  }

  return (
    <motion.div className="max-w-6xl mx-auto pb-12" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <ToastContainer />
      <div className="px-1 md:px-0 space-y-4">

        {/* Header */}
        <GateEntryHeader
          title={t.title}
          lang={lang}
          onLangToggle={() => setLang(l => l === 'en' ? 'hi' : 'en')}
          onHistoryToggle={() => setShowHistory(h => !h)}
          showHistory={showHistory}
        />

        {/* History view */}
        {showHistory && <GateHistoryMobile />}

        {/* Form view */}
        {!showHistory && (
          <>
            {/* Step progress bar */}
            <StepProgressBar
              currentStep={step}
              totalSteps={3}
              stepLabel={t.steps[step]}
              completionText={step === 0 ? `${photosDone}/${photosRequired} done` : null}
            />

            {/* Draft banner */}
            {hasDraft && step === 0 && (
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <p className="text-xs text-amber-700 font-medium">You have an unsaved draft</p>
                <button onClick={resetForm} className="text-xs text-red-500 hover:text-red-700 font-medium">Clear</button>
              </div>
            )}

            {/* ── Step 0: Capture Photos ── */}
            {step === 0 && (
              <div className="space-y-4">
                {/* Transport type picker */}
                <TransportTypePicker
                  value={form.transport_type}
                  onChange={v => setField('transport_type', v)}
                  labels={t.transportLabels}
                />

                {/* Photo cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {form.transport_type === 'vehicle' && (
                    <PhotoCaptureCard
                      type="vehicle"
                      label={t.vehiclePhoto}
                      helpText={t.vehiclePhotoHelp}
                      value={form.vehicle_photo}
                      onChange={v => setField('vehicle_photo', v)}
                    />
                  )}
                  <PhotoCaptureCard
                    type="invoice"
                    label={t.invoicePhoto}
                    helpText={t.invoicePhotoHelp}
                    value={form.invoice_photo}
                    onChange={v => setField('invoice_photo', v)}
                  />
                  <PhotoCaptureCard
                    type="material"
                    label={t.materialPhoto}
                    helpText={t.materialPhotoHelp}
                    value={form.material_photo}
                    onChange={v => setField('material_photo', v)}
                  />
                </div>

                {/* Progress indicator for photos */}
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${(photosDone / photosRequired) * 100}%` }}
                  />
                </div>

                {/* CTA Button */}
                <Button
                  onClick={() => { if (validateStep0()) setStep(1); }}
                  className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-base font-medium rounded-xl gap-2"
                >
                  {t.continue} <ArrowRight className="w-4 h-4" />
                </Button>

                <p className="text-xs text-slate-400 text-center">{t.guided}</p>
              </div>
            )}

            {/* ── Step 1: Enter Details ── */}
            {step === 1 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-slate-600" />
                  <h2 className="font-bold text-slate-900">{t.steps[1]}</h2>
                </div>

                {form.transport_type === 'vehicle' && (
                  <div>
                    <Label className="text-xs font-medium text-slate-700">{t.vehicleNumber} *</Label>
                    <Input
                      className="h-11 text-base mt-1.5 font-mono uppercase rounded-xl"
                      value={form.vehicle_number}
                      onChange={e => setField('vehicle_number', e.target.value.toUpperCase())}
                      placeholder="e.g. MH12AB1234"
                    />
                  </div>
                )}

                <div>
                  <Label className="text-xs font-medium text-slate-700">{t.driverName}</Label>
                  <Input
                    className="h-11 text-base mt-1.5 rounded-xl"
                    value={form.driver_name}
                    onChange={e => setField('driver_name', e.target.value)}
                    placeholder={t.driverNamePlaceholder}
                  />
                </div>

                <div>
                  <Label className="text-xs font-medium text-slate-700">{t.driverNumber} *</Label>
                  <Input
                    className="h-11 text-base mt-1.5 rounded-xl"
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
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base resize-none mt-1.5"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setStep(0)} className="flex-1 h-12 text-sm rounded-xl">{t.back}</Button>
                  <Button onClick={() => { if (validateStep1()) setStep(2); }} className="flex-1 h-12 bg-slate-900 text-sm rounded-xl gap-2">
                    {t.next} <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ── Step 2: Review & Submit ── */}
            {step === 2 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 space-y-4">
                <h2 className="font-bold text-slate-900">{t.steps[2]}</h2>

                {/* Review details */}
                <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                  <ReviewRow label={t.reviewLabels.transport} value={t.transportLabels[form.transport_type] || form.transport_type} />
                  {form.transport_type === 'vehicle' && <ReviewRow label={t.reviewLabels.vehicleNumber} value={form.vehicle_number} />}
                  {form.driver_name && <ReviewRow label={t.reviewLabels.driverName} value={form.driver_name} />}
                  <ReviewRow label={t.reviewLabels.driverNumber} value={form.driver_number} />
                  {form.notes && <ReviewRow label={t.reviewLabels.notes} value={form.notes} />}
                </div>

                {/* Photo previews */}
                <div className="flex gap-2">
                  {form.vehicle_photo && <img src={form.vehicle_photo} alt="vehicle" className="flex-1 h-20 object-cover rounded-xl border border-slate-200" />}
                  {form.invoice_photo && <img src={form.invoice_photo} alt="invoice" className="flex-1 h-20 object-cover rounded-xl border border-slate-200" />}
                  {form.material_photo && <img src={form.material_photo} alt="material" className="flex-1 h-20 object-cover rounded-xl border border-slate-200" />}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-12 text-sm rounded-xl">{t.back}</Button>
                  <Button onClick={handleSubmit} disabled={submitting} className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-sm rounded-xl">
                    {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                    {submitting ? t.submitting : t.submit}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}