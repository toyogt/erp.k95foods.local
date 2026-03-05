import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, CheckCircle2, ShieldAlert, Lock } from 'lucide-react';
import { logAudit } from '@/components/AuditLogger';
import MachineScanner from '@/components/wip/MachineScanner';
import ScanInput from '@/components/wip/ScanInput';
import CrateScanner from '@/components/labelling/CrateScanner';
import SessionStatus from '@/components/labelling/SessionStatus';
import ChecklistRunner from '@/components/checklist/ChecklistRunner';
import { callEdge } from '@/components/labelling/edgeClient';
import { raiseAlert } from '@/components/alerts/alertHelpers';
import CrateTraceWindowPanel from '@/components/labelling/CrateTraceWindowPanel';
import TraceSearchPanel from '@/components/labelling/TraceSearchPanel';
import RollInstallPanel from '@/components/labelling/RollInstallPanel';
import ReworkPanel from '@/components/labelling/ReworkPanel';
import SKUMappingBadge from '@/components/labelling/SKUMappingBadge';
import ShiftSessionBar from '@/components/shift/ShiftSessionBar';
import DowntimeBar from '@/components/downtime/DowntimeBar';
import { useDowntime } from '@/components/downtime/useDowntime';
import { useMetricSampler } from '@/components/labelling/useMetricSampler';

const STEP = { MACHINE: 0, SELECT_WO: 1, SCAN_LABEL: 2, SCAN_CARTON: 3, CHECKLIST: 4, RUNNING: 5 };

function genSessionId() { return 'SES-' + Date.now().toString(36).toUpperCase(); }

export default function LabellingLine() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(STEP.MACHINE);
  const [machine, setMachine] = useState(null);
  const [wos, setWos] = useState([]);
  const [wo, setWo] = useState(null);
  const [remainderBlockWo, setRemainderBlockWo] = useState(null); // WO blocked pending override
  const [remainderOverrideReason, setRemainderOverrideReason] = useState('');
  const [labelScan, setLabelScan] = useState('');
  const [cartonScan, setCartonScan] = useState('');
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [edgeStatus, setEdgeStatus] = useState(null);
  const [hardwareEnabled, setHardwareEnabled] = useState(false);
  const [bottleTypeMismatchHardStop, setBottleTypeMismatchHardStop] = useState(false);
  // Supervisor restart checklist gate
  const [showRestartChecklist, setShowRestartChecklist] = useState(false);
  // Traceability
  const [latestTrace, setLatestTrace] = useState(null);
  const [bufferEstimate, setBufferEstimate] = useState(null);
  // Roll tracking
  const [activeRoll, setActiveRoll] = useState(null);
  // SKU mapping
  const [skuMapping, setSkuMapping] = useState(null);
  // Expected artwork for the current WO
  const [expectedArtwork, setExpectedArtwork] = useState(null);

  const { activeEvent: downtimeEvent, downtimeMinutesToday, startDowntime, endDowntime } = useDowntime({
    stationType: 'LABELLING',
    machineId: machine?.machine_id,
    user,
  });

  // Metric sampling — active only when line is truly RUNNING
  useMetricSampler({
    isRunning: step === STEP.RUNNING && session?.state === 'RUNNING' && !downtimeEvent,
    machineId: machine?.machine_id,
    woId: wo?.wo_id,
    sessionId: session?.session_id,
  });

  const isSupervisor = user?.role === 'admin' || user?.role === 'labelling_supervisor' || user?.role === 'production_manager';

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    // Load bottle type mismatch behavior from settings
    base44.entities.AppSetting.filter({ key: 'BOTTLE_TYPE_MISMATCH_HARDSTOP' })
      .then(r => { if (r[0]?.value === 'true') setBottleTypeMismatchHardStop(true); })
      .catch(() => {});
    base44.entities.AppSetting.filter({ key: 'HARDWARE_ENABLED' })
      .then(r => { setHardwareEnabled(r[0]?.value === 'true'); })
      .catch(() => {});
    base44.entities.AppSetting.filter({ key: 'LABEL_FEEDER_BUFFER_ESTIMATE_BOTTLES' })
      .then(r => { if (r[0]?.value) setBufferEstimate(Number(r[0].value)); })
      .catch(() => {});
  }, []);

  async function handleMachineConfirmed(m) {
    if (!m) return;
    setMachine(m);
    setLoading(true);
    setError('');
    const lineNum = m.machine_id.match(/(\d+)$/)?.[1];
    const lineMap = { '1': 'LABEL-LINE-1', '2': 'LABEL-LINE-2' };
    const thisLine = lineNum ? lineMap[lineNum] : null;
    try {
      // Load WOs that are RELEASED and either unassigned (blank) or assigned to this line
      const allReleased = await base44.entities.PackingWO.filter({ status: 'RELEASED' }, 'priority', 100);
      const visible = allReleased.filter(w =>
        !w.assigned_line || w.assigned_line === '' || w.assigned_line === thisLine
      );
      setWos(visible);
    } catch { setWos([]); }
    setLoading(false);
    setStep(STEP.SELECT_WO);
  }

  async function handleSelectWO(w) {
    setSkuMapping(null);
    setExpectedArtwork(null);
    setRemainderBlockWo(null);
    setRemainderOverrideReason('');

    const lineNum = machine?.machine_id?.match(/(\d+)$/)?.[1];
    const lineMap = { '1': 'LABEL-LINE-1', '2': 'LABEL-LINE-2' };
    const thisLine = lineNum ? lineMap[lineNum] : null;

    // Claim line if not yet assigned
    if ((!w.assigned_line || w.assigned_line === '') && thisLine) {
      try {
        await base44.entities.PackingWO.update(w.id, { assigned_line: thisLine });
        w = { ...w, assigned_line: thisLine };
        await logAudit({ action: `WO ${w.wo_id} claimed for ${thisLine}`, entity_type: 'PackingWO', entity_id: w.wo_id, user, station: machine?.machine_id });
      } catch { /* non-blocking */ }
    }

    // REMAINDER enforcement: check if any sibling allocation in same plan is not DONE
    if (w.plan_id && w.allocation_id) {
      try {
        const [siblingAllocs] = await Promise.all([
          base44.entities.SKUAllocation.filter({ plan_id: w.plan_id }),
        ]);
        const thisAlloc = siblingAllocs.find(a => a.allocation_id === w.allocation_id);
        if (thisAlloc?.allocation_type === 'REMAINDER') {
          const blockers = siblingAllocs.filter(a =>
            a.allocation_id !== w.allocation_id && a.status !== 'DONE'
          );
          if (blockers.length > 0) {
            setRemainderBlockWo(w);
            return; // Hold — show blocker UI instead of proceeding
          }
        }
      } catch { /* non-blocking */ }
    }

    proceedWithWO(w);
  }

  function proceedWithWO(w) {
    setWo(w);
    setStep(STEP.SCAN_LABEL);
    // Load expected artwork from SKU's default_artwork_id
    if (w?.product_code) {
      base44.entities.ProductMaster.filter({ item_code: w.product_code }).then(async skus => {
        const sku = skus[0];
        if (sku?.default_artwork_id) {
          const arts = await base44.entities.LabelArtwork.filter({ artwork_id: sku.default_artwork_id }).catch(() => []);
          if (arts[0]) setExpectedArtwork(arts[0]);
        }
      }).catch(() => {});
    }
  }

  async function handleRemainderOverride() {
    if (!remainderOverrideReason.trim() || !isSupervisor) return;
    await logAudit({
      action: `REMAINDER override for WO ${remainderBlockWo?.wo_id} — reason: ${remainderOverrideReason}`,
      entity_type: 'PackingWO',
      entity_id: remainderBlockWo?.wo_id,
      user,
      station: machine?.machine_id,
    }).catch(() => {});
    proceedWithWO(remainderBlockWo);
    setRemainderBlockWo(null);
    setRemainderOverrideReason('');
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

  // Generate batch ID for LABEL_START SKUs when line is approved/started
  async function generateLabelStartBatchId() {
    if (!wo?.product_code) return;
    try {
      const [mappings, rules, products] = await Promise.all([
        base44.entities.SKUPrintMapping.filter({ product_code: wo.product_code }),
        base44.entities.BatchFormatRule.list('-created_date', 500),
        base44.entities.ProductMaster.filter({ item_code: wo.product_code }),
      ]);
      const mapping = mappings[0];
      if (!mapping || mapping.batch_date_source !== 'LABEL_START' || !mapping.batch_format_rule_id) return;
      const rule = rules.find(r => r.rule_id === mapping.batch_format_rule_id);
      if (!rule) return;
      const sku = products[0];
      const labelDate = new Date();
      const resetScope = mapping.sequence_reset_scope || 'DAILY';

      function getPeriodKey(date, scope) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        if (scope === 'DAILY') return `${y}${m}${d}`;
        if (scope === 'MONTHLY') return `${y}${m}`;
        if (scope === 'YEARLY') return `${y}`;
        return 'NEVER';
      }
      const periodKey = getPeriodKey(labelDate, resetScope);

      const existing = await base44.entities.BatchSeqCounter.filter({
        rule_id: mapping.batch_format_rule_id,
        sku_code: wo.product_code,
        period_key: periodKey,
      });
      let seq;
      if (existing.length > 0) {
        seq = existing[0].next_seq;
        await base44.entities.BatchSeqCounter.update(existing[0].id, { next_seq: seq + 1 });
      } else {
        seq = 1;
        await base44.entities.BatchSeqCounter.create({
          rule_id: mapping.batch_format_rule_id,
          sku_code: wo.product_code,
          period_key: periodKey,
          next_seq: 2,
        });
      }

      // renderBatchId inline
      const { renderBatchId } = await import('@/components/batch/batchIdEngine');
      let parsedRule = rule;
      if (typeof rule.format_json === 'string') {
        parsedRule = { ...rule, format_json: JSON.parse(rule.format_json) };
      }
      const batchId = renderBatchId({ rule: parsedRule, sku, date: labelDate, seq });

      // Write to PackingWO and find allocation to update
      const wos = await base44.entities.PackingWO.filter({ wo_id: wo.wo_id });
      if (wos[0]) await base44.entities.PackingWO.update(wos[0].id, { batch_id: batchId });

      // Find allocation via wo allocation_id link
      if (wo.allocation_id) {
        const allocs = await base44.entities.SKUAllocation.filter({ allocation_id: wo.allocation_id });
        if (allocs[0]) await base44.entities.SKUAllocation.update(allocs[0].id, { sku_batch_id: batchId });
      }

      // Record SKUBatch
      await base44.entities.SKUBatch.create({
        sku_batch_id: batchId,
        plan_id: wo.plan_id || '',
        allocation_id: wo.allocation_id || '',
        wo_id: wo.wo_id,
        sku_code: wo.product_code,
        date_used: labelDate.toISOString().split('T')[0],
        date_source: 'LABEL_START',
        rule_id: mapping.batch_format_rule_id,
        seq_used: seq,
        period_key: periodKey,
        generated_at: labelDate.toISOString(),
        generated_by: user?.email || '',
      }).catch(() => {});

      // Push BATCH to Ryan via edge
      await callEdge('ryan_set_variable', { variable: 'BATCH', value: batchId }).catch(() => {});
    } catch (e) {
      console.error('LABEL_START batch gen failed:', e);
    }
  }

  async function handleChecklistDone(status, runId) {
    setLoading(true);
    // Generate LABEL_START batch ID before starting session
    await generateLabelStartBatchId();
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
    // Use SKU mapping template if available, fall back to WO printer_template_id
    const labelTemplateName = skuMapping?.label_variant_id
      ? (await base44.entities.LabelVariant.filter({ label_variant_id: skuMapping.label_variant_id }).catch(() => []))[0]?.label_template_name
      : null;
    const templateId = labelTemplateName || wo.printer_template_id;
    if (!edgeRes.edge_offline && templateId) {
      await callEdge('printer_select_message', { wo_id: wo.wo_id, template_id: templateId, variables: wo.print_variables || {} });
    }
    // Lock Ryan to correct template
    if (!edgeRes.edge_offline && skuMapping?.ryan_template_id) {
      await callEdge('ryan_select_template', { wo_id: wo.wo_id, template_id: skuMapping.ryan_template_id });
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

  async function recordTraceWindow(crate) {
    const now = new Date().toISOString();
    // Try to get Ryan count
    let ryanCount = null;
    try {
      const ryanRes = await callEdge('ryan_get_count', {});
      if (ryanRes?.count != null) ryanCount = ryanRes.count;
    } catch { /* non-blocking */ }

    const traceId = 'TW-' + Date.now().toString(36).toUpperCase();
    let newTrace = null;
    try {
      newTrace = await base44.entities.CrateTraceWindow.create({
        trace_id: traceId,
        wo_id: wo?.wo_id || '',
        line_machine_id: machine?.machine_id || '',
        crate_id: crate.crate_id,
        scanned_at: now,
        ryan_count_at_scan: ryanCount,
        buffer_estimate_bottles: bufferEstimate,
        window_prev_crate_id: latestTrace?.crate_id || null,
      });
    } catch { return; }

    // Link: update previous record's window_next_crate_id
    if (latestTrace?.id) {
      try {
        await base44.entities.CrateTraceWindow.update(latestTrace.id, {
          window_next_crate_id: crate.crate_id,
        });
      } catch { /* non-blocking */ }
    }

    setLatestTrace({ ...newTrace, window_prev_crate_id: latestTrace?.crate_id || null });
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
    // Record trace window (non-blocking, fire and update state)
    recordTraceWindow(crate);

    // Mark crate as CONSUMED and check if pallet becomes empty
    try {
      const crates = await base44.entities.Crate.filter({ crate_id: crate.crate_id });
      if (crates.length > 0) {
        await base44.entities.Crate.update(crates[0].id, {
          status: 'CONSUMED',
          consumed_at: new Date().toISOString(),
          consumed_by: user?.email || '',
        });
      }
      // Find pallet this crate belongs to and check if all its crates are consumed
      const links = await base44.entities.PalletCrateLink.filter({ crate_id: crate.crate_id });
      for (const link of links) {
        const allLinks = await base44.entities.PalletCrateLink.filter({ pallet_id: link.pallet_id });
        const crateStatuses = await Promise.all(allLinks.map(async l => {
          const cs = await base44.entities.Crate.filter({ crate_id: l.crate_id });
          return cs[0]?.status;
        }));
        const allConsumed = crateStatuses.every(s => s === 'CONSUMED' || s === 'EMPTY_RETURNED');
        if (allConsumed) {
          const pallets = await base44.entities.Pallet.filter({ pallet_id: link.pallet_id });
          if (pallets.length > 0) {
            await base44.entities.Pallet.update(pallets[0].id, { status: 'EMPTY' });
          }
        }
      }
    } catch { /* non-blocking */ }
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

      {hardwareEnabled && edgeStatus === 'offline' && (
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

          {/* REMAINDER blocker modal */}
          {remainderBlockWo && (
            <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-800 font-bold">
                <Lock className="w-5 h-5" />
                REMAINDER WO — Blocked
              </div>
              <p className="text-sm text-amber-700">
                <span className="font-semibold">{remainderBlockWo.wo_id}</span> is a REMAINDER allocation.
                Other allocations in this plan must be DONE before starting it.
              </p>
              {isSupervisor ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Supervisor Override — Enter reason:</p>
                  <input
                    className="w-full border border-amber-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="Reason for override…"
                    value={remainderOverrideReason}
                    onChange={e => setRemainderOverrideReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleRemainderOverride} disabled={!remainderOverrideReason.trim()} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold">Override & Proceed</Button>
                    <Button variant="outline" onClick={() => setRemainderBlockWo(null)} className="flex-1">Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-amber-700">Supervisor must approve override.</p>
                  <Button variant="outline" onClick={() => setRemainderBlockWo(null)} className="ml-auto">Back</Button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            {wos.map(w => (
              <button key={w.id} onClick={() => handleSelectWO(w)}
                className="w-full text-left bg-white rounded-2xl border border-slate-200 p-4 hover:border-blue-400 transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-slate-900">{w.wo_id}</p>
                    <p className="text-sm text-slate-600">{w.product}</p>
                    <p className="text-xs text-slate-400 mt-1">{w.pack_type ? `${w.pack_type} · ` : ''}{(w.required_bottles || w.target_bottles)} bottles · Prio {w.priority}</p>
                    {w.product_code && <p className="text-xs text-slate-400 font-mono">{w.product_code}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {w.assigned_line
                      ? <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-1 rounded-full">{w.assigned_line}</span>
                      : <span className="text-xs bg-slate-100 text-slate-500 font-semibold px-2 py-1 rounded-full">Unassigned</span>
                    }
                    {w.sku_batch_id && <span className="text-xs bg-green-100 text-green-700 font-mono px-2 py-0.5 rounded-full">{w.sku_batch_id || w.batch_id}</span>}
                  </div>
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
            {wo?.product_code && <p className="text-xs text-slate-400 font-mono">{wo.product_code}</p>}
          </div>
          {/* SKU → Template mapping */}
          {wo?.product_code && (
            <SKUMappingBadge productCode={wo.product_code} onMappingLoaded={setSkuMapping} />
          )}
          {/* Missing mapping validation */}
          {wo?.product_code && skuMapping && !skuMapping.is_active && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 font-semibold text-center">
              ⚠️ Mapping exists but is inactive
            </div>
          )}
          {wo?.product_code && skuMapping && skuMapping.is_active && (!skuMapping.ryan_template_id || !skuMapping.batch_format_rule_id || !skuMapping.label_variant_id) && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 font-semibold text-center">
              ⛔ Missing mapping — ryan_template_id, batch_format_rule_id, or label_variant_id not configured
            </div>
          )}
          <p className="text-sm font-semibold text-slate-600 uppercase tracking-widest">Scan Label SKU</p>
          <ScanInput placeholder="Scan label roll barcode…" value={labelScan} onChange={setLabelScan} onScan={handleLabelScan} />
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          {wo?.label_sku_code && <p className="text-xs text-slate-400">Expected: <code className="bg-slate-100 px-1 rounded">{wo.label_sku_code}</code></p>}
          {/* Block proceed if incomplete active mapping or no mapping */}
          {wo?.product_code && (
            skuMapping === null || (skuMapping.is_active && (!skuMapping.ryan_template_id || !skuMapping.batch_format_rule_id || !skuMapping.label_variant_id))
          ) && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 font-semibold text-center">
              ⛔ Cannot proceed — SKU mapping incomplete
            </div>
          )}
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
          {/* Shift session bar */}
          <ShiftSessionBar stationType="LABELLING" machineId={machine?.machine_id} user={user} />

          {/* Downtime bar */}
          <DowntimeBar
            stationType="LABELLING"
            activeEvent={downtimeEvent}
            downtimeMinutesToday={downtimeMinutesToday}
            onPause={() => startDowntime({ woId: wo?.wo_id })}
            onResume={(reasonCode, notes, photo) => endDowntime({ reasonCode, notes, photoUrl: photo })}
            disabled={session.state !== 'RUNNING'}
          />

          {/* WO header */}
          <div className="bg-slate-900 text-white rounded-2xl p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-widest">Active WO</p>
                <p className="font-bold text-lg">{wo?.wo_id}</p>
                <p className="text-sm text-slate-300">{wo?.product}</p>
                {wo?.product_code && <p className="text-xs text-slate-400 font-mono">{wo?.product_code}</p>}
                {expectedArtwork && (
                  <p className="text-xs mt-1">
                    <span className="text-slate-400">Expected artwork: </span>
                    <span className="text-blue-300 font-semibold">{expectedArtwork.artwork_name}</span>
                    {expectedArtwork.artwork_version && (
                      <span className="ml-1 bg-blue-600/40 text-blue-200 font-bold px-1.5 py-0.5 rounded text-xs">{expectedArtwork.artwork_version}</span>
                    )}
                  </p>
                )}
                {activeRoll && (
                  <p className="text-xs mt-0.5 text-emerald-300 font-mono">Roll: {activeRoll.roll_id}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  session.state === 'RUNNING' ? 'bg-emerald-500/30 text-emerald-300' :
                  session.state === 'SOFT_STOP' ? 'bg-amber-500/30 text-amber-300' :
                  session.state === 'HARD_STOP' ? 'bg-red-500/30 text-red-300' :
                  session.state === 'COMPLETED' ? 'bg-purple-500/30 text-purple-300' :
                  'bg-slate-700 text-slate-300'
                }`}>{session.state}</span>
                {downtimeMinutesToday > 0 && (
                  <span className="text-xs text-red-300 font-medium">⏱ {downtimeMinutesToday.toFixed(0)}m DT</span>
                )}
              </div>
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

          {/* Roll install panel — always shown while running */}
          <RollInstallPanel
            wo={wo}
            machine={machine}
            user={user}
            isSupervisor={isSupervisor}
            activeRoll={activeRoll}
            expectedArtworkId={expectedArtwork?.artwork_id}
            onRollChanged={setActiveRoll}
          />

          {/* Rework panel — always shown while session active */}
          <ReworkPanel
            wo={wo}
            machine={machine}
            user={user}
            activeRoll={activeRoll}
            isSupervisor={isSupervisor}
          />

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

          {/* Trace window — always visible while session active */}
          <CrateTraceWindowPanel
            session={session}
            wo_id={wo?.wo_id}
            line_machine_id={machine?.machine_id}
            latestTrace={latestTrace}
          />

          {/* Trace search — supervisor/admin only */}
          {isSupervisor && <TraceSearchPanel />}

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