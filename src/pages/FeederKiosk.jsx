import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { ScanLine, CheckCircle2, XCircle, ShieldAlert, Unlock, Thermometer } from 'lucide-react';
import { callEdge } from '@/components/labelling/edgeClient';

const ACCEPT_FLASH_MS = 1500;

function genId(prefix) { return prefix + '-' + Date.now().toString(36).toUpperCase(); }

export default function FeederKiosk() {
  const [user, setUser] = useState(null);
  const [machine, setMachine] = useState(null);
  const [machineInput, setMachineInput] = useState('');
  const [machineError, setMachineError] = useState('');

  // Runtime state
  const [wo, setWo] = useState(null);
  const [ryanCount, setRyanCount] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const [blockPin, setBlockPin] = useState('');
  const [showUnblock, setShowUnblock] = useState(false);

  // Scan state
  const [scanValue, setScanValue] = useState('');
  const [scanStatus, setScanStatus] = useState(null); // null | 'ok' | 'error' | 'hard_stop'
  const [scanMsg, setScanMsg] = useState('');
  const [lastCrate, setLastCrate] = useState(null);
  const [traceHistory, setTraceHistory] = useState([]); // last 3 traces (newest first)

  // Buffer estimate + settings
  const [bufferEstimate, setBufferEstimate] = useState(null);
  const [bottleTypeMismatchHardStop, setBottleTypeMismatchHardStop] = useState(false);

  const inputRef = useRef(null);
  const flashTimerRef = useRef(null);

  const isSupervisor = user?.role === 'admin' || user?.role === 'labelling_supervisor' || user?.role === 'production_manager';

  // ── On mount: load user & settings ───────────────────────────
  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    base44.entities.AppSetting.filter({ key: 'BOTTLE_TYPE_MISMATCH_HARDSTOP' })
      .then(r => { if (r[0]?.value === 'true') setBottleTypeMismatchHardStop(true); })
      .catch(() => {});
    base44.entities.AppSetting.filter({ key: 'LABEL_FEEDER_BUFFER_ESTIMATE_BOTTLES' })
      .then(r => { if (r[0]?.value) setBufferEstimate(Number(r[0].value)); })
      .catch(() => {});
  }, []);

  // ── After machine set: load WO + Ryan ────────────────────────
  useEffect(() => {
    if (!machine) return;
    loadWO();
    const interval = setInterval(refreshRyan, 30000);
    return () => clearInterval(interval);
  }, [machine]);

  async function loadWO() {
    if (!machine) return;
    const lineNum = machine.machine_id.match(/(\d+)$/)?.[1];
    const lineMap = { '1': 'LABEL-LINE-1', '2': 'LABEL-LINE-2' };
    const assignedLine = lineNum ? lineMap[lineNum] : null;
    try {
      const filter = { status: 'RUNNING' };
      if (assignedLine) filter.assigned_line = assignedLine;
      const wos = await base44.entities.PackingWO.filter(filter, '-priority', 1);
      setWo(wos[0] || null);
    } catch { setWo(null); }
    refreshRyan();
  }

  async function refreshRyan() {
    try {
      const res = await callEdge('ryan_get_count', {});
      if (res?.count != null) setRyanCount(res.count);
    } catch { /* non-blocking */ }
  }

  // ── Always keep scan input focused ───────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (!blocked && scanStatus === null) inputRef.current?.focus();
    }, 800);
    return () => clearInterval(interval);
  }, [blocked, scanStatus]);

  // ── Machine setup submit ─────────────────────────────────────
  async function confirmMachine() {
    setMachineError('');
    if (!machineInput.trim()) return;
    try {
      const machines = await base44.entities.Machine.filter({ machine_id: machineInput.trim() });
      const m = machines[0];
      if (!m) { setMachineError('Machine not found'); return; }
      setMachine(m);
    } catch {
      // Offline fallback — accept as typed
      setMachine({ machine_id: machineInput.trim(), display_name: machineInput.trim() });
    }
  }

  // ── Scan handling ─────────────────────────────────────────────
  function handleScanKey(e) {
    if (e.key === 'Enter') {
      const val = scanValue.trim();
      setScanValue('');
      if (val) processScan(val);
    }
  }

  async function processScan(crateId) {
    if (blocked) return;
    clearFlash();

    // Lookup crate
    let crate = null;
    try {
      const crates = await base44.entities.Crate.filter({ crate_id: crateId });
      if (crates.length === 0) { showError(`Crate ${crateId} not found`, false); return; }
      crate = crates[0];
    } catch {
      showError('Offline — crate lookup failed', false);
      return;
    }

    // Validations
    if (crate.status === 'CONSUMED') {
      showError(`Crate ${crateId} already consumed`, false);
      return;
    }

    const lineZone = machine.machine_id.match(/(\d+)$/)?.[1] === '2' ? 'ZONE-LABEL-LINE-2' : 'ZONE-LABEL-LINE-1';
    if (crate.current_location !== lineZone) {
      showError(`Wrong zone: ${crate.current_location || 'UNKNOWN'} (expected ${lineZone})`, false);
      return;
    }

    if (wo?.product_code && crate.product_code && crate.product_code !== wo.product_code) {
      showError(`Wrong product: ${crate.product_code}`, true);
      return;
    }

    if (wo?.bottle_type && crate.bottle_type && crate.bottle_type !== wo.bottle_type) {
      showError(`Wrong bottle type: ${crate.bottle_type}`, bottleTypeMismatchHardStop);
      return;
    }

    // Accepted — log records
    await acceptCrate(crate, crateId);
  }

  async function acceptCrate(crate, crateId) {
    const now = new Date().toISOString();
    let ryanCountNow = ryanCount;
    try {
      const res = await callEdge('ryan_get_count', {});
      if (res?.count != null) { ryanCountNow = res.count; setRyanCount(res.count); }
    } catch { /* best effort */ }

    // Build trace entry
    const prevTrace = traceHistory[0] || null;
    const traceId = genId('TW');
    let newTrace = null;
    try {
      newTrace = await base44.entities.CrateTraceWindow.create({
        trace_id: traceId,
        wo_id: wo?.wo_id || '',
        line_machine_id: machine.machine_id,
        crate_id: crateId,
        scanned_at: now,
        ryan_count_at_scan: ryanCountNow,
        buffer_estimate_bottles: bufferEstimate,
        window_prev_crate_id: prevTrace?.crate_id || null,
      });
      // Update previous trace's next pointer
      if (prevTrace?.id) {
        base44.entities.CrateTraceWindow.update(prevTrace.id, { window_next_crate_id: crateId }).catch(() => {});
      }
    } catch { newTrace = { trace_id: traceId, crate_id: crateId, scanned_at: now, ryan_count_at_scan: ryanCountNow }; }

    // FeederCrateScan record
    try {
      const sessions = await base44.entities.LineSession.filter({ line_machine_id: machine.machine_id, state: 'RUNNING' }, '-started_at', 1);
      const session = sessions[0];
      await base44.entities.FeederCrateScan.create({
        scan_id: genId('FS'),
        session_id: session?.session_id || '',
        wo_id: wo?.wo_id || '',
        line_machine_id: machine.machine_id,
        crate_id: crateId,
        scanned_at: now,
        ryan_count_at_scan: ryanCountNow,
        buffer_estimate_bottles: bufferEstimate,
      });
    } catch { /* non-blocking */ }

    // Update trace history (newest first, keep 3)
    const updatedTrace = { ...newTrace, crate_id: crateId };
    setTraceHistory(prev => {
      const next = [updatedTrace, ...prev].slice(0, 3);
      return next;
    });
    setLastCrate(crate);
    setScanStatus('ok');
    setScanMsg('');

    // Auto-clear after flash duration
    flashTimerRef.current = setTimeout(() => {
      setScanStatus(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }, ACCEPT_FLASH_MS);
  }

  function showError(msg, isHardStop) {
    setScanStatus(isHardStop ? 'hard_stop' : 'error');
    setScanMsg(msg);
    if (!isHardStop) {
      flashTimerRef.current = setTimeout(() => {
        setScanStatus(null);
        setTimeout(() => inputRef.current?.focus(), 50);
      }, 3000);
    }
  }

  function clearFlash() {
    if (flashTimerRef.current) { clearTimeout(flashTimerRef.current); flashTimerRef.current = null; }
    setScanStatus(null);
    setScanMsg('');
  }

  // ── BLOCK / UNBLOCK ───────────────────────────────────────────
  function handleBlock() {
    setBlocked(true);
    setScanStatus(null);
  }

  function handleUnblock() {
    // Simple 4-digit PIN — the supervisor's decision; no server PIN storage
    setBlocked(false);
    setShowUnblock(false);
    setBlockPin('');
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  const lineNum = machine?.machine_id?.match(/(\d+)$/)?.[1] || '?';
  const lineLabel = `LINE ${lineNum}`;

  const woReady = !!wo;
  const readyStatus = !blocked && woReady;

  // ── MACHINE SETUP SCREEN ─────────────────────────────────────
  if (!machine) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 gap-6">
      <div className="flex flex-col items-center gap-2">
        <ScanLine className="w-12 h-12 text-slate-400" />
        <p className="text-white text-2xl font-black tracking-widest">FEEDER KIOSK</p>
        <p className="text-slate-400 text-sm">Scan or type the machine ID to begin</p>
      </div>
      <div className="w-full max-w-sm space-y-3">
        <input
          autoFocus
          className="w-full h-14 rounded-2xl bg-slate-800 border border-slate-600 text-white text-lg px-4 focus:outline-none focus:border-blue-400 placeholder:text-slate-500"
          placeholder="Machine ID (e.g. LABEL-LINE-1)"
          value={machineInput}
          onChange={e => setMachineInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && confirmMachine()}
        />
        {machineError && <p className="text-red-400 text-sm text-center">{machineError}</p>}
        <button
          onClick={confirmMachine}
          className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg transition-colors"
        >
          Confirm Machine
        </button>
      </div>
    </div>
  );

  // ── MAIN KIOSK SCREEN ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col select-none overflow-hidden">

      {/* Hidden USB-HID keyboard wedge input — always absorbing keystrokes */}
      <input
        ref={inputRef}
        value={scanValue}
        onChange={e => setScanValue(e.target.value)}
        onKeyDown={handleScanKey}
        className="opacity-0 fixed top-0 left-0 w-px h-px"
        tabIndex={0}
        aria-hidden="true"
      />

      {/* ── HEADER ────────────────────────────────────────────────── */}
      <div className={`px-6 pt-5 pb-4 border-b ${readyStatus ? 'border-emerald-800 bg-emerald-950/60' : 'border-red-900 bg-red-950/40'}`}>
        <div className="flex items-start justify-between gap-4">
          {/* Left: line identity */}
          <div>
            <p className="text-4xl font-black tracking-widest text-white">{lineLabel}</p>
            {wo ? (
              <div className="mt-1 space-y-0.5">
                <p className="text-emerald-300 font-bold text-lg">{wo.wo_id} — {wo.product}</p>
                {wo.product_code && <p className="text-emerald-400/70 text-sm font-mono">{wo.product_code}</p>}
              </div>
            ) : (
              <p className="text-slate-400 mt-1 text-sm">No active WO on this line</p>
            )}
          </div>

          {/* Right: status pill + Ryan */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className={`text-sm font-black px-4 py-1.5 rounded-full ${
              blocked ? 'bg-red-600 text-white' :
              readyStatus ? 'bg-emerald-500 text-emerald-950' :
              'bg-amber-500 text-amber-950'
            }`}>
              {blocked ? '⛔ BLOCKED' : readyStatus ? '✓ READY' : '⚠ NO WO'}
            </span>
            {ryanCount != null && (
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase tracking-widest">Ryan</p>
                <p className="text-2xl font-black text-blue-300">{ryanCount.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SCAN AREA ─────────────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-6 cursor-pointer"
        onClick={() => { if (!blocked) { clearFlash(); inputRef.current?.focus(); } }}
      >
        {blocked ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <ShieldAlert className="w-24 h-24 text-red-400" />
            <p className="text-4xl font-black text-red-400">LINE BLOCKED</p>
            <p className="text-slate-400">Supervisor action required to unblock</p>
            {isSupervisor && (
              <button
                onClick={e => { e.stopPropagation(); setShowUnblock(true); }}
                className="mt-2 flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded-2xl font-bold text-white transition-colors"
              >
                <Unlock className="w-5 h-5" /> Supervisor Unblock
              </button>
            )}
          </div>
        ) : scanStatus === 'ok' ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="w-28 h-28 text-emerald-400" />
            <p className="text-5xl font-black text-emerald-400 tracking-wide">CRATE ACCEPTED</p>
            {lastCrate && (
              <p className="text-xl text-emerald-300/80 font-mono font-bold">{lastCrate.crate_id}</p>
            )}
          </div>
        ) : scanStatus === 'error' ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <XCircle className="w-24 h-24 text-red-400" />
            <p className="text-4xl font-black text-red-400">CRATE REJECTED</p>
            <p className="text-xl text-red-300/80 text-center">{scanMsg}</p>
            <p className="text-sm text-slate-500 mt-2">Tap anywhere to retry</p>
          </div>
        ) : scanStatus === 'hard_stop' ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <ShieldAlert className="w-28 h-28 text-red-400" />
            <p className="text-5xl font-black text-red-300">⛔ HARD STOP</p>
            <p className="text-xl text-red-300/80 text-center">{scanMsg}</p>
            <p className="text-sm text-slate-500 mt-2">Supervisor restart required</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            <ScanLine className="w-20 h-20 text-slate-500 animate-pulse" />
            <p className="text-3xl font-black text-slate-400 tracking-widest">SCAN CRATE</p>
            <p className="text-slate-600 text-sm">USB scanner ready — or tap to focus</p>
          </div>
        )}
      </div>

      {/* ── TRACE WINDOW ──────────────────────────────────────────── */}
      {traceHistory.length > 0 && (
        <div className="px-6 pb-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-1">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-2">Last Crates</p>
            {traceHistory.map((t, i) => (
              <div key={t.trace_id || i} className={`flex justify-between items-center rounded-xl px-3 py-2 ${i === 0 ? 'bg-emerald-900/50 border border-emerald-700' : 'bg-slate-800'}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${i === 0 ? 'text-emerald-400' : 'text-slate-500'}`}>{i === 0 ? 'CURR' : i === 1 ? 'PREV' : 'PREV-2'}</span>
                  <span className="font-mono text-sm font-bold text-white">{t.crate_id}</span>
                </div>
                <div className="text-right">
                  {t.scanned_at && <p className="text-xs text-slate-400">{new Date(t.scanned_at).toLocaleTimeString()}</p>}
                  {t.ryan_count_at_scan != null && <p className="text-xs text-blue-400">Ryan: {t.ryan_count_at_scan.toLocaleString()}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FOOTER: block button ─────────────────────────────────── */}
      <div className="px-6 pb-6 flex justify-between items-center">
        <button
          onClick={() => setMachine(null)}
          className="text-xs text-slate-600 underline"
        >
          Change Machine
        </button>
        {isSupervisor && !blocked && (
          <button
            onClick={handleBlock}
            className="flex items-center gap-2 bg-red-900 hover:bg-red-800 border border-red-700 text-red-200 font-bold px-5 py-3 rounded-2xl transition-colors"
          >
            <ShieldAlert className="w-5 h-5" /> BLOCK LINE
          </button>
        )}
      </div>

      {/* ── UNBLOCK MODAL ─────────────────────────────────────────── */}
      {showUnblock && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div className="bg-slate-900 border border-slate-600 rounded-3xl p-8 w-full max-w-sm space-y-5 text-center">
            <Unlock className="w-12 h-12 text-emerald-400 mx-auto" />
            <p className="text-xl font-black text-white">Supervisor Unblock</p>
            <p className="text-slate-400 text-sm">Confirm you are a supervisor to unblock the line.</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowUnblock(false); setBlockPin(''); }}
                className="flex-1 h-12 rounded-2xl bg-slate-700 text-slate-300 font-bold hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUnblock}
                className="flex-1 h-12 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-colors"
              >
                Confirm Unblock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}