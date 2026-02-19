import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ScanLine, CheckCircle2, Loader2, PackageCheck, Plus, RefreshCw } from 'lucide-react';
import { logAudit } from '@/components/AuditLogger';
import ChecklistRunner from '@/components/checklist/ChecklistRunner';
import { callEdge } from '@/components/labelling/edgeClient';

const FG_LOC = 'FG-WH';
const STEP = { SCAN_PALLET: 0, SELECT_WO: 1, ENTER_CASES: 2, CHECKLIST: 3, CONFIRM: 4, DONE: 5 };

function genPalletId() { return 'FGP-' + Date.now().toString(36).toUpperCase(); }
function genLogId() { return 'LOG-' + Date.now().toString(36).toUpperCase(); }

export default function FGPalletizing() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(STEP.SCAN_PALLET);
  const [palletInput, setPalletInput] = useState('');
  const [pallet, setPallet] = useState(null); // existing or new
  const [wos, setWos] = useState([]);
  const [wo, setWo] = useState(null);
  const [casesInput, setCasesInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locationInput, setLocationInput] = useState(FG_LOC);
  const palletRef = useRef(null);
  const casesRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    loadWOs();
  }, []);

  async function loadWOs() {
    try {
      const data = await base44.entities.PackingWO.filter({ status: 'RUNNING' }, '-priority', 50);
      // Also include recently COMPLETED
      const comp = await base44.entities.PackingWO.filter({ status: 'COMPLETED' }, '-updated_date', 20).catch(() => []);
      setWos([...data, ...comp]);
    } catch { setWos([]); }
  }

  async function handlePalletScan() {
    const id = palletInput.trim();
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const existing = await base44.entities.FGPallet.filter({ fg_pallet_id: id });
      if (existing.length > 0) {
        setPallet(existing[0]);
        // Pre-select WO if set
        if (existing[0].wo_id) {
          const w = wos.find(x => x.wo_id === existing[0].wo_id);
          if (w) setWo(w);
        }
      } else {
        // Will create later
        setPallet({ fg_pallet_id: id, case_count: 0, bottle_count: 0, _isNew: true });
      }
    } catch {
      setPallet({ fg_pallet_id: id, case_count: 0, bottle_count: 0, _isNew: true });
    }
    setLoading(false);
    setStep(STEP.SELECT_WO);
  }

  function handleSelectWO(w) {
    setWo(w);
    setStep(STEP.ENTER_CASES);
    setTimeout(() => casesRef.current?.focus(), 100);
  }

  function handleCasesConfirm() {
    const n = parseInt(casesInput);
    if (!n || n <= 0) { setError('Enter a valid number of cases'); return; }
    setError('');
    setStep(STEP.CHECKLIST);
  }

  async function handleChecklistDone(status) {
    if (status !== 'COMPLETED') { setStep(STEP.ENTER_CASES); return; }
    setStep(STEP.CONFIRM);
  }

  async function handleConfirm() {
    setLoading(true);
    const n = parseInt(casesInput);
    const packQty = wo?.pack_type === 'CASE6' ? 6 : 12;
    const bottles = n * packQty;
    const now = new Date().toISOString();

    try {
      if (pallet._isNew) {
        // Create FGPallet
        const created = await base44.entities.FGPallet.create({
          fg_pallet_id: pallet.fg_pallet_id,
          wo_id: wo?.wo_id || '',
          pack_type: wo?.pack_type || 'CASE12',
          case_count: n,
          bottle_count: bottles,
          current_location: locationInput,
          status: 'OPEN',
          created_by: user?.email || '',
        });
        await base44.entities.FGPalletLog.create({ fg_pallet_id: pallet.fg_pallet_id, action: 'CREATE', qty_cases: n, location: locationInput, timestamp: now, user: user?.email || '', wo_id: wo?.wo_id || '' });
        setPallet(created);
      } else {
        // Update existing
        const newCases = (pallet.case_count || 0) + n;
        const newBottles = (pallet.bottle_count || 0) + bottles;
        await base44.entities.FGPallet.update(pallet.id, { case_count: newCases, bottle_count: newBottles, current_location: locationInput });
        await base44.entities.FGPalletLog.create({ fg_pallet_id: pallet.fg_pallet_id, action: 'ADD_CASES', qty_cases: n, location: locationInput, timestamp: now, user: user?.email || '', wo_id: wo?.wo_id || '' });
        setPallet(prev => ({ ...prev, case_count: newCases, bottle_count: newBottles }));
      }

      // Edge: box printer stub
      if (wo?.printer_template_id) {
        await callEdge('printer_select_box_message', { wo_id: wo.wo_id, template_id: wo.printer_template_id, variables: wo.print_variables || {}, cases: n });
      }

      await logAudit({ action: `FG Pallet ${pallet.fg_pallet_id} — ${n} cases added`, entity_type: 'FGPallet', entity_id: pallet.fg_pallet_id, user, details: { wo_id: wo?.wo_id, cases: n, bottles } });
      setStep(STEP.DONE);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  const bottles = parseInt(casesInput || 0) * (wo?.pack_type === 'CASE6' ? 6 : 12);

  // ── SCAN PALLET ──────────────────────────────────────────────────────────
  if (step === STEP.SCAN_PALLET) return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">FG Palletizing</h1>
        <p className="text-sm text-slate-500">Cases → FG Pallets</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Scan FG Pallet Barcode</p>
        <div className="relative">
          <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input ref={palletRef} autoFocus
            className="w-full pl-10 h-14 text-lg rounded-xl border-2 border-slate-300 focus:border-emerald-500 focus:outline-none font-mono"
            placeholder="Scan or type pallet ID…"
            value={palletInput} onChange={e => setPalletInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePalletScan()} />
        </div>
        <Button className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={handlePalletScan} disabled={!palletInput.trim() || loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Pallet'}
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => { setPalletInput(genPalletId()); }}>
          <Plus className="w-4 h-4 mr-1" /> Generate Pallet ID
        </Button>
      </div>
    </div>
  );

  // ── SELECT WO ─────────────────────────────────────────────────────────────
  if (step === STEP.SELECT_WO) return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">FG Palletizing</h1>
        <p className="text-sm text-slate-500">Pallet: <span className="font-mono font-bold">{pallet?.fg_pallet_id}</span>
          {!pallet?._isNew && <span className="ml-2 text-xs text-emerald-600 font-semibold">EXISTING · {pallet?.case_count} cases</span>}
          {pallet?._isNew && <span className="ml-2 text-xs text-blue-600 font-semibold">NEW</span>}
        </p>
      </div>
      <p className="text-sm font-semibold text-slate-600 uppercase tracking-widest">Select Work Order</p>
      <div className="space-y-2">
        {wos.map(w => (
          <button key={w.id} onClick={() => handleSelectWO(w)}
            className="w-full text-left bg-white rounded-2xl border border-slate-200 p-4 hover:border-emerald-400 transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-slate-900">{w.wo_id}</p>
                <p className="text-sm text-slate-600">{w.product}</p>
                <p className="text-xs text-slate-400">{w.pack_type} · {w.target_bottles} bottles</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${w.status === 'RUNNING' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{w.status}</span>
            </div>
          </button>
        ))}
        {wos.length === 0 && <p className="text-slate-400 text-sm text-center py-6">No active WOs found.</p>}
      </div>
      <Button variant="outline" className="w-full rounded-xl" onClick={() => setStep(STEP.SCAN_PALLET)}>← Back</Button>
    </div>
  );

  // ── ENTER CASES ───────────────────────────────────────────────────────────
  if (step === STEP.ENTER_CASES) return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <p className="text-xs text-slate-500">Pallet · WO</p>
        <p className="font-bold text-slate-900">{pallet?.fg_pallet_id} · {wo?.wo_id}</p>
        <p className="text-xs text-slate-500">{wo?.pack_type} · {wo?.product}</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Number of Cases</p>
        <input ref={casesRef} type="number" min="1" autoFocus
          className="w-full h-20 text-4xl font-black text-center rounded-xl border-2 border-slate-300 focus:border-emerald-500 focus:outline-none"
          value={casesInput} onChange={e => setCasesInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCasesConfirm()} />
        {casesInput && parseInt(casesInput) > 0 && (
          <p className="text-center text-slate-500 text-sm">= <strong>{bottles}</strong> bottles</p>
        )}
      </div>
      <div>
        <label className="text-xs text-slate-500 font-medium">Location</label>
        <input className="w-full mt-1 h-10 rounded-xl border border-slate-300 px-3 text-sm focus:outline-none"
          value={locationInput} onChange={e => setLocationInput(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={handleCasesConfirm} disabled={!casesInput}>
        Next
      </Button>
      <Button variant="outline" className="w-full rounded-xl" onClick={() => setStep(STEP.SELECT_WO)}>← Back</Button>
    </div>
  );

  // ── CHECKLIST ─────────────────────────────────────────────────────────────
  if (step === STEP.CHECKLIST) return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <p className="text-xs text-slate-500">FG Palletize Checklist</p>
        <p className="font-bold text-slate-900">{pallet?.fg_pallet_id} — {casesInput} cases</p>
      </div>
      <ChecklistRunner
        station_type="FG"
        stage="FG_PALLETIZE"
        reference_type="FGPallet"
        reference_id={pallet?.fg_pallet_id || ''}
        user={user}
        onComplete={handleChecklistDone}
        onCancel={() => setStep(STEP.ENTER_CASES)}
      />
    </div>
  );

  // ── CONFIRM ───────────────────────────────────────────────────────────────
  if (step === STEP.CONFIRM) return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Confirm</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-xs text-slate-400">Pallet</p><p className="font-bold font-mono">{pallet?.fg_pallet_id}</p></div>
          <div><p className="text-xs text-slate-400">WO</p><p className="font-bold">{wo?.wo_id}</p></div>
          <div><p className="text-xs text-slate-400">Cases</p><p className="font-bold text-emerald-700 text-2xl">{casesInput}</p></div>
          <div><p className="text-xs text-slate-400">Bottles</p><p className="font-bold text-2xl">{bottles}</p></div>
          <div><p className="text-xs text-slate-400">Pack Type</p><p className="font-bold">{wo?.pack_type}</p></div>
          <div><p className="text-xs text-slate-400">Location</p><p className="font-bold">{locationInput}</p></div>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button className="w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-lg font-bold" onClick={handleConfirm} disabled={loading}>
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><PackageCheck className="w-5 h-5 mr-2" />Confirm & Save</>}
      </Button>
      <Button variant="outline" className="w-full rounded-xl" onClick={() => setStep(STEP.ENTER_CASES)}>← Back</Button>
    </div>
  );

  // ── DONE ──────────────────────────────────────────────────────────────────
  if (step === STEP.DONE) return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-emerald-500 text-white p-8 flex flex-col items-center gap-3">
        <CheckCircle2 className="w-16 h-16" />
        <p className="text-2xl font-black">PALLET SAVED</p>
        <p className="text-lg font-bold opacity-90">{pallet?.fg_pallet_id}</p>
        <p className="opacity-80">{casesInput} cases · {bottles} bottles</p>
        <p className="text-sm opacity-70">{locationInput}</p>
      </div>
      <Button className="w-full h-12 rounded-xl" onClick={() => {
        setStep(STEP.SCAN_PALLET);
        setPallet(null);
        setPalletInput('');
        setWo(null);
        setCasesInput('');
        setError('');
      }}>
        <RefreshCw className="w-4 h-4 mr-2" /> Palletize Another
      </Button>
      <Button variant="outline" className="w-full rounded-xl" onClick={() => {
        // Continue with same pallet, new WO batch
        setStep(STEP.SELECT_WO);
        setWo(null);
        setCasesInput('');
      }}>
        Add More Cases to Same Pallet
      </Button>
    </div>
  );

  return null;
}