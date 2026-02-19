import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import MachineScanner from '@/components/wip/MachineScanner';
import ScanInput from '@/components/wip/ScanInput';
import CrateScanner from '@/components/labelling/CrateScanner';
import SessionStatus from '@/components/labelling/SessionStatus';
import ChecklistRunner from '@/components/checklist/ChecklistRunner';
import { callEdge } from '@/components/labelling/edgeClient';
import { logAudit } from '@/components/AuditLogger';
import { raiseAlert } from '@/components/alerts/alertHelpers';

const STEP = { MACHINE: 0, SELECT_WO: 1, SCAN_LABEL: 2, SCAN_CARTON: 3, CHECKLIST: 4, RUNNING: 5 };

function genSessionId() { return 'SES-' + Date.now().toString(36).toUpperCase(); }

export default function LabellingLine() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(STEP.MACHINE);
  const [machine, setMachine] = useState(null);
  const [wos, setWos] = useState([]);
  const [wo, setWo] = useState(null);
  const [labelScan, setLabelScan] = useState('');
  const [cartonScan, setCartonScan] = useState('');
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [edgeStatus, setEdgeStatus] = useState(null);
  const [bottleTypeMismatchHardStop, setBottleTypeMismatchHardStop] = useState(false);
  // Supervisor restart checklist gate
  const [showRestartChecklist, setShowRestartChecklist] = useState(false);

  const isSupervisor = user?.role === 'admin' || user?.role === 'labelling_supervisor' || user?.role === 'production_manager';

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    // Load bottle type mismatch behavior from settings
    base44.entities.AppSetting.filter({ key: 'BOTTLE_TYPE_MISMATCH_HARDSTOP' })
      .then(r => { if (r[0]?.value === 'true') setBottleTypeMismatchHardStop(true); })
      .catch(() => {});
  }, []);

  async function handleMachineConfirmed(m) {
    if (!m) return;
    setMachine(m);
    setLoading(true);
    setError('');
    const lineNum = m.machine_id.match(/(\d+)$/)?.[1];
    const lineMap = { '1': 'LABEL-LINE-1', '2': 'LABEL-LINE-2' };
    const assignedLine = lineNum ? lineMap[lineNum] : null;
    try {
      const filter = { status: 'RELEASED' };
      if (assignedLine) filter.assigned_line = assignedLine;
      setWos(await base44.entities.PackingWO.filter(filter, '-priority', 50));
    } catch { setWos([]); }
    setLoading(false);
    setStep(STEP.SELECT_WO);
  }

  function handleSelectWO(w) {
    setWo(w);
    setStep(STEP.SCAN_LABEL);
  }

  function handleLabelScan(val) {
    setError('');
    if (wo?.label_sku_code && val !== wo.label_sku_code) {
      setError(`Label SKU mismatch. Expected: ${wo.label_sku_code}`);
      setLabelScan('');
      return;
    }
    setLabelScan(val);
    if (!wo?.carton_code) { setStep(STEP.CHECKLIST); } else { setStep(STEP.SCAN_CARTON); }
  }

  function handleCartonScan(val) {
    setError('');
    if (wo?.carton_code && val !== wo.carton_code) {
      setError(`Carton code mismatch. Expected: ${wo.carton_code}`);
      setCartonScan('');
      return;
    }
    setCartonScan(val);
    setStep(STEP.CHECKLIST);
  }

  async function handleChecklistDone(status, runId) {
    setLoading(true);
    const sessionId = genSessionId();
    const now = new Date().toISOString();
    let newSession = null;
    try {
      newSession = await base44.entities.LineSession.create({
        session_id: sessionId, wo_id: wo.wo_id, line_machine_id: machine.machine_id,
        started_at: now, state: 'READY', crates_used: 0, bottles_counted: 0, cases_counted: 0,
      });
      const r = await base44.entities.PackingWO.filter({ wo_id: wo.wo_id });
      if (r[0]) await base44.entities.PackingWO.update(r[0].id, { status: 'RUNNING' });
    } catch {
      newSession = { session_id: sessionId, wo_id: wo.wo_id, line_machine_id: machine.machine_id, started_at: now, state: 'READY', crates_used: 0, bottles_counted: 0, cases_counted: 0, id: '_local_' + sessionId };
    }
    const edgeRes = await callEdge('start_job', { wo_id: wo.wo_id, line_machine_id: machine.machine_id, mrp: wo.mrp, pack_type: wo.pack_type, target_bottles: wo.target_bottles, label_sku_code: wo.label_sku_code });
    setEdgeStatus(edgeRes.edge_offline ? 'offline' : 'ok');
    if (!edgeRes.edge_offline && wo.printer_template_id) {
      await callEdge('printer_select_message', { wo_id: wo.wo_id, template_id: wo.printer_template_id, variables: wo.print_variables || {} });
    }
    if (newSession?.id) {
      try { await base44.entities.LineSession.update(newSession.id, { state: 'RUNNING' }); } catch { /* offline */ }
      newSession = { ...newSession, state: 'RUNNING' };
    }
    await callEdge('set_run_enable', { wo_id: wo.wo_id, enable: true });
    await logAudit({ action: `LineSession STARTED for WO ${wo.wo_id}`, entity_type: 'LineSession', entity_id: sessionId, user, station: machine.machine_id });
    setSession(newSession);
    setLoading(false);
    setStep(STEP.RUNNING);
  }

  async function handleCrateLocked(crate) {
    const newBottles = (session.bottles_counted || 0) + (crate.bottle_count || 0);
    const caseDivisor = wo?.pack_type === 'CASE6' ? 6 : 12;
    const newCases = Math.floor(newBottles / caseDivisor);
    const newCrates = (session.crates_used || 0) + 1;
    let newState = session.state;
    let reason = '';
    if (newBottles >= (wo?.target_bottles || Infinity)) {
      newState = 'SOFT_STOP';
      reason = 'Target reached — stop and close WO';
      await callEdge('soft_stop', { wo_id: wo.wo_id, reason });
    }
    const updated = { ...session, bottles_counted: newBottles, crates_used: newCrates, cases_counted: newCases, current_crate_id: crate.crate_id, state: newState, reason };
    setSession(updated);
    if (session.id && !session.id.startsWith('_local_')) {
      try { await base44.entities.LineSession.update(session.id, { bottles_counted: newBottles, crates_used: newCrates, cases_counted: newCases, current_crate_id: crate.crate_id, state: newState, reason }); } catch { /* offline */ }
    }
  }

  async function handleCrateError({ reason, crate_id }) {
    let newState = null;
    let msg = '';
    if (reason === 'WRONG_PRODUCT') {
      // Immediate HARD STOP
      newState = 'HARD_STOP';
      msg = `Wrong product crate: ${crate_id}. HARD STOP — supervisor restart required.`;
    } else if (reason === 'WRONG_ZONE') {
      newState = session?.state === 'SOFT_STOP' ? 'HARD_STOP' : 'SOFT_STOP';
      msg = `Crate ${crate_id} from wrong zone — ${newState}`;
    } else if (reason === 'WRONG_BOTTLE_TYPE') {
      newState = 'SOFT_STOP';
      msg = `Wrong bottle type on crate ${crate_id}`;
    }
    if (!newState) return;
    const updated = { ...session, state: newState, reason: msg };
    setSession(updated);
    if (session?.id && !session.id.startsWith('_local_')) {
      try { await base44.entities.LineSession.update(session.id, { state: newState, reason: msg }); } catch { /* offline */ }
    }
    await callEdge(newState === 'HARD_STOP' ? 'hard_stop' : 'soft_stop', { wo_id: wo?.wo_id, reason: msg });
    await logAudit({ action: `Line ${newState}: ${msg}`, entity_type: 'LineSession', entity_id: session?.session_id, user, station: machine?.machine_id });
    if (newState === 'HARD_STOP') {
      await raiseAlert({ severity: 'CRITICAL', station_type: 'LABELLING', reference_type: 'LineSession', reference_id: session?.session_id || wo?.wo_id || '', message: msg });
    }
  }

  async function handleResume() {
    if (!isSupervisor) return;
    const updated = { ...session, state: 'RUNNING', reason: '' };
    setSession(updated);
    if (session?.id && !session.id.startsWith('_local_')) {
      try { await base44.entities.LineSession.update(session.id, { state: 'RUNNING', reason: '' }); } catch { /* offline */ }
    }
    await callEdge('set_run_enable', { wo_id: wo?.wo_id, enable: true });
  }

  // Called when supervisor completes RESTART_AFTER_HARD_STOP checklist
  async function handleRestartChecklistDone(status) {
    setShowRestartChecklist(false);
    if (status === 'COMPLETED') {
      await handleResume();
    }
  }

  async function handleCompleteWO() {
    if (!isSupervisor) return;
    setLoading(true);
    const now = new Date().toISOString();
    if (session?.id && !session.id.startsWith('_local_')) {
      try { await base44.entities.LineSession.update(session.id, { state: 'COMPLETED', ended_at: now }); } catch { /* offline */ }
    }
    try {
      const r = await base44.entities.PackingWO.filter({ wo_id: wo.wo_id });
      if (r[0]) await base44.entities.PackingWO.update(r[0].id, { status: 'COMPLETED' });
    } catch { /* offline */ }
    await callEdge('set_run_enable', { wo_id: wo?.wo_id, enable: false });
    await logAudit({ action: `WO ${wo.wo_id} COMPLETED by supervisor`, entity_type: 'PackingWO', entity_id: wo.wo_id, user, station: machine?.machine_id });
    setSession(prev => ({ ...prev, state: 'COMPLETED', ended_at: now }));
    setLoading(false);
  }

  const lineZone = machine?.machine_id?.match(/(\d+)$/)?.[1] === '2' ? 'ZONE-LABEL-LINE-2' : 'ZONE-LABEL-LINE-1';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Labelling Line</h1>
        <p className="text-sm text-slate-500">WO-driven line run</p>
      </div>

      {edgeStatus === 'offline' && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Edge offline — app-only control active
        </div>
      )}

      {/* STEP 0: Machine */}
      {step === STEP.MACHINE && <MachineScanner stationType="LABEL-LINE" onConfirmed={handleMachineConfirmed} />}

      {/* STEP 1: Select WO */}
      {step === STEP.SELECT_WO && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-600 uppercase tracking-widest">Select Packing WO</p>
          {loading && <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}
          {!loading && wos.length === 0 && <p className="text-slate-500 text-sm text-center py-6">No RELEASED work orders for this line.</p>}
          <div className="space-y-2">
            {wos.map(w => (
              <button key={w.id} onClick={() => handleSelectWO(w)}
                className="w-full text-left bg-white rounded-2xl border border-slate-200 p-4 hover:border-blue-400 transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-slate-900">{w.wo_id}</p>
                    <p className="text-sm text-slate-600">{w.product}</p>
                    <p className="text-xs text-slate-400 mt-1">{w.pack_type} · {w.target_bottles} bottles · Prio {w.priority}</p>
                    {w.product_code && <p className="text-xs text-slate-400 font-mono">{w.product_code}</p>}
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-1 rounded-full">{w.assigned_line}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2: Label SKU */}
      {step === STEP.SCAN_LABEL && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">WO</p>
            <p className="font-bold text-slate-900">{wo?.wo_id} — {wo?.product}</p>
          </div>
          <p className="text-sm font-semibold text-slate-600 uppercase tracking-widest">Scan Label SKU</p>
          <ScanInput placeholder="Scan label roll barcode…" value={labelScan} onChange={setLabelScan} onScan={handleLabelScan} />
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          {wo?.label_sku_code && <p className="text-xs text-slate-400">Expected: <code className="bg-slate-100 px-1 rounded">{wo.label_sku_code}</code></p>}
        </div>
      )}

      {/* STEP 3: Carton */}
      {step === STEP.SCAN_CARTON && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">WO · {wo?.pack_type}</p>
            <p className="font-bold text-slate-900">{wo?.wo_id}</p>
          </div>
          <p className="text-sm font-semibold text-slate-600 uppercase tracking-widest">Scan Carton Barcode</p>
          <ScanInput placeholder="Scan carton barcode…" value={cartonScan} onChange={setCartonScan} onScan={handleCartonScan} />
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          {wo?.carton_code && <p className="text-xs text-slate-400">Expected: <code className="bg-slate-100 px-1 rounded">{wo.carton_code}</code></p>}
          <Button variant="ghost" className="w-full" onClick={() => setStep(STEP.CHECKLIST)}>Skip carton check</Button>
        </div>
      )}

      {/* STEP 4: Startup Checklist via ChecklistRunner */}
      {step === STEP.CHECKLIST && (
        <div className="space-y-4">
          {loading && <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}
          {!loading && (
            <ChecklistRunner
              station_type="LABELLING"
              stage="STARTUP"
              reference_type="PackingWO"
              reference_id={wo?.wo_id || ''}
              user={user}
              onComplete={handleChecklistDone}
              onCancel={() => setStep(STEP.SCAN_LABEL)}
            />
          )}
        </div>
      )}

      {/* STEP 5: Running */}
      {step === STEP.RUNNING && session && (
        <div className="space-y-4">
          {/* WO header */}
          <div className="bg-slate-900 text-white rounded-2xl p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-widest">Active WO</p>
                <p className="font-bold text-lg">{wo?.wo_id}</p>
                <p className="text-sm text-slate-300">{wo?.product}</p>
                {wo?.product_code && <p className="text-xs text-slate-400 font-mono">{wo?.product_code}</p>}
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                session.state === 'RUNNING' ? 'bg-emerald-500/30 text-emerald-300' :
                session.state === 'SOFT_STOP' ? 'bg-amber-500/30 text-amber-300' :
                session.state === 'HARD_STOP' ? 'bg-red-500/30 text-red-300' :
                session.state === 'COMPLETED' ? 'bg-purple-500/30 text-purple-300' :
                'bg-slate-700 text-slate-300'
              }`}>{session.state}</span>
            </div>
          </div>

          <SessionStatus session={session} wo={wo} />

          {/* HARD STOP banner — supervisor restart checklist gated */}
          {session.state === 'HARD_STOP' && (
            <div className="bg-red-700 text-white rounded-2xl p-5 flex flex-col items-center gap-3">
              <ShieldAlert className="w-12 h-12" />
              <p className="text-2xl font-black">⛔ HARD STOP</p>
              <p className="text-sm opacity-90 text-center font-medium">{session.reason}</p>
              {isSupervisor && !showRestartChecklist && (
                <Button onClick={() => setShowRestartChecklist(true)} className="mt-1 bg-white text-red-700 hover:bg-red-50 font-bold w-full">
                  Supervisor — Start Restart Procedure
                </Button>
              )}
              {!isSupervisor && <p className="text-xs opacity-70 text-center">Supervisor must complete restart checklist before resuming</p>}
            </div>
          )}

          {/* Supervisor restart checklist (shown inline) */}
          {session.state === 'HARD_STOP' && showRestartChecklist && isSupervisor && (
            <div className="bg-white rounded-2xl border-2 border-red-300 p-4">
              <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-3">Restart Procedure — Supervisor Only</p>
              <ChecklistRunner
                station_type="LABELLING"
                stage="RESTART_AFTER_HARD_STOP"
                reference_type="LineSession"
                reference_id={session.session_id || ''}
                user={user}
                onComplete={handleRestartChecklistDone}
                onCancel={() => setShowRestartChecklist(false)}
              />
            </div>
          )}

          {/* SOFT STOP banner */}
          {session.state === 'SOFT_STOP' && (
            <div className="bg-amber-500 text-white rounded-2xl p-5 flex flex-col items-center gap-2">
              <AlertTriangle className="w-10 h-10" />
              <p className="text-xl font-black">SOFT STOP</p>
              <p className="text-sm opacity-90 text-center">{session.reason}</p>
              {isSupervisor && (
                <div className="flex gap-2 mt-2 w-full">
                  <Button onClick={handleResume} className="flex-1 bg-white text-amber-700 hover:bg-amber-50 font-bold">Resume Line</Button>
                  <Button onClick={handleCompleteWO} disabled={loading} className="flex-1 bg-amber-900 hover:bg-amber-800 text-white font-bold">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Complete WO'}
                  </Button>
                </div>
              )}
              {!isSupervisor && <p className="text-xs opacity-70">Awaiting supervisor action</p>}
            </div>
          )}

          {/* Completed */}
          {session.state === 'COMPLETED' && (
            <div className="bg-purple-600 text-white rounded-2xl p-5 flex flex-col items-center gap-3">
              <CheckCircle2 className="w-12 h-12" />
              <p className="text-xl font-black">WO COMPLETED</p>
              <p className="text-sm opacity-80">{session.bottles_counted} bottles · {session.cases_counted} cases</p>
              <Button onClick={() => { setStep(STEP.MACHINE); setMachine(null); setWo(null); setSession(null); setLabelScan(''); setCartonScan(''); }}
                className="mt-1 bg-white text-purple-700 hover:bg-purple-50 font-bold">
                Start New WO
              </Button>
            </div>
          )}

          {/* Active crate scanner — RUNNING only */}
          {session.state === 'RUNNING' && (
            <CrateScanner
              lineZone={lineZone}
              wo={wo}
              bottleTypeMismatchHardStop={bottleTypeMismatchHardStop}
              onCrateLocked={handleCrateLocked}
              onError={handleCrateError}
            />
          )}

          {/* Supervisor complete early */}
          {session.state === 'RUNNING' && isSupervisor && (
            <Button variant="outline" onClick={handleCompleteWO} disabled={loading} className="w-full h-12 rounded-xl border-purple-300 text-purple-700">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Supervisor — Complete WO early'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}