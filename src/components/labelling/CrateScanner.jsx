import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { ScanLine, CheckCircle2, XCircle } from 'lucide-react';

const LOCK_DELAY_MS = 1500;

/**
 * CrateScanner
 * Props:
 *  lineZone         - expected current_location of crate
 *  wo               - PackingWO object (for product_code + bottle_type validation)
 *  bottleTypeMismatchHardStop - if true, bottle_type mismatch → HARD_STOP (default soft)
 *  onCrateLocked(crate)
 *  onError({ crate_id, reason, crate? })
 *    reasons: NOT_FOUND | WRONG_ZONE | WRONG_PRODUCT | WRONG_BOTTLE_TYPE | OFFLINE
 */
export default function CrateScanner({ lineZone, wo, bottleTypeMismatchHardStop, onCrateLocked, onError }) {
  const [rawValue, setRawValue] = useState('');
  const [status, setStatus] = useState(null); // null | 'ok' | 'error'
  const [lockedCrate, setLockedCrate] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorReason, setErrorReason] = useState('');
  const timerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!lockedCrate) inputRef.current?.focus();
    }, 2000);
    return () => clearInterval(interval);
  }, [lockedCrate]);

  function handleChange(e) {
    const val = e.target.value;
    setRawValue(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (val.trim()) {
      timerRef.current = setTimeout(() => lockCrate(val.trim()), LOCK_DELAY_MS);
    }
  }

  async function lockCrate(crateId) {
    setRawValue('');
    if (lockedCrate?.crate_id === crateId) return;

    try {
      const crates = await base44.entities.Crate.filter({ crate_id: crateId });
      if (crates.length === 0) {
        fireError(crateId, 'NOT_FOUND', null, `Crate ${crateId} not found`);
        return;
      }
      const crate = crates[0];

      // 1) Zone check
      if (lineZone && crate.current_location !== lineZone) {
        fireError(crateId, 'WRONG_ZONE', crate, `Wrong zone: ${crate.current_location || 'UNKNOWN'} (expected ${lineZone})`);
        return;
      }

      // 2) Product code check → immediate HARD STOP
      if (wo?.product_code && crate.product_code && crate.product_code !== wo.product_code) {
        fireError(crateId, 'WRONG_PRODUCT', crate, `Wrong product: ${crate.product_code} (WO expects ${wo.product_code})`);
        return;
      }

      // 3) Bottle type check → configurable hard/soft stop
      if (wo?.bottle_type && crate.bottle_type && crate.bottle_type !== wo.bottle_type) {
        const reason = bottleTypeMismatchHardStop ? 'WRONG_PRODUCT' : 'WRONG_BOTTLE_TYPE';
        fireError(crateId, reason, crate, `Wrong bottle type: ${crate.bottle_type} (WO expects ${wo.bottle_type})`);
        return;
      }

      setStatus('ok');
      setErrorMsg('');
      setErrorReason('');
      setLockedCrate(crate);
      onCrateLocked && onCrateLocked(crate);
    } catch {
      fireError(crateId, 'OFFLINE', null, 'Offline — crate lookup failed');
    }
  }

  function fireError(crateId, reason, crate, msg) {
    setStatus('error');
    setErrorMsg(msg);
    setErrorReason(reason);
    onError && onError({ crate_id: crateId, reason, crate });
  }

  function clearLock() {
    setLockedCrate(null);
    setStatus(null);
    setErrorMsg('');
    setErrorReason('');
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  const isHardStopError = errorReason === 'WRONG_PRODUCT';

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-600 uppercase tracking-widest">Crate Scanner</p>

      <input
        ref={inputRef}
        value={rawValue}
        onChange={handleChange}
        className="opacity-0 absolute w-px h-px"
        tabIndex={-1}
      />

      {status === null && (
        <div onClick={() => inputRef.current?.focus()}
          className="rounded-2xl border-2 border-dashed border-slate-300 p-8 flex flex-col items-center gap-2 cursor-pointer">
          <ScanLine className="w-10 h-10 text-slate-400" />
          <p className="text-slate-500 font-medium">Waiting for crate scan…</p>
          <p className="text-xs text-slate-400">Tap to focus scanner</p>
        </div>
      )}

      {status === 'ok' && lockedCrate && (
        <div className="rounded-2xl bg-emerald-500 text-white p-6 flex flex-col items-center gap-2 cursor-pointer" onClick={clearLock}>
          <CheckCircle2 className="w-14 h-14" />
          <p className="text-2xl font-black tracking-wide">CRATE OK</p>
          <p className="text-lg font-bold opacity-90">{lockedCrate.crate_id}</p>
          <p className="text-sm opacity-75">{lockedCrate.bottle_count} bottles · {lockedCrate.current_location}</p>
          {lockedCrate.product_code && <p className="text-xs opacity-60">{lockedCrate.product_code} · {lockedCrate.batch_id}</p>}
          <p className="text-xs opacity-60 mt-1">Tap to release</p>
        </div>
      )}

      {status === 'error' && (
        <div
          className={`rounded-2xl text-white p-6 flex flex-col items-center gap-2 ${isHardStopError ? 'bg-red-700' : 'bg-red-500'}`}
          onClick={isHardStopError ? undefined : clearLock}
        >
          <XCircle className="w-14 h-14" />
          <p className="text-2xl font-black tracking-wide">{isHardStopError ? '⛔ HARD STOP' : 'CRATE NOT OK'}</p>
          <p className="text-sm opacity-90 text-center">{errorMsg}</p>
          {isHardStopError && <p className="text-xs opacity-75 text-center mt-1">Supervisor restart required</p>}
          {!isHardStopError && <p className="text-xs opacity-60 mt-1">Tap to retry</p>}
        </div>
      )}
    </div>
  );
}