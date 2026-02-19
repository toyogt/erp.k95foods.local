import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { ScanLine, CheckCircle2, XCircle } from 'lucide-react';

const LOCK_DELAY_MS = 1500;

export default function CrateScanner({ lineZone, onCrateLocked, onError }) {
  const [rawValue, setRawValue] = useState('');
  const [status, setStatus] = useState(null); // null | 'ok' | 'error'
  const [lockedCrate, setLockedCrate] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const timerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Continuously focus scanner input
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
    if (lockedCrate?.crate_id === crateId) return; // same crate already locked

    try {
      const crates = await base44.entities.Crate.filter({ crate_id: crateId });
      if (crates.length === 0) {
        setStatus('error');
        setErrorMsg(`Crate ${crateId} not found`);
        onError && onError({ crate_id: crateId, reason: 'NOT_FOUND' });
        return;
      }
      const crate = crates[0];
      if (lineZone && crate.current_location !== lineZone) {
        setStatus('error');
        setErrorMsg(`Wrong zone: ${crate.current_location || 'UNKNOWN'} (expected ${lineZone})`);
        onError && onError({ crate_id: crateId, reason: 'WRONG_ZONE', crate });
        return;
      }
      setStatus('ok');
      setErrorMsg('');
      setLockedCrate(crate);
      onCrateLocked && onCrateLocked(crate);
    } catch {
      setStatus('error');
      setErrorMsg('Offline — crate lookup failed');
      onError && onError({ crate_id: crateId, reason: 'OFFLINE' });
    }
  }

  function clearLock() {
    setLockedCrate(null);
    setStatus(null);
    setErrorMsg('');
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-600 uppercase tracking-widest">Crate Scanner</p>

      {/* Hidden continuous scan input */}
      <input
        ref={inputRef}
        value={rawValue}
        onChange={handleChange}
        className="opacity-0 absolute w-px h-px"
        tabIndex={-1}
        readOnly={false}
      />

      {status === null && (
        <div
          onClick={() => inputRef.current?.focus()}
          className="rounded-2xl border-2 border-dashed border-slate-300 p-8 flex flex-col items-center gap-2 cursor-pointer"
        >
          <ScanLine className="w-10 h-10 text-slate-400" />
          <p className="text-slate-500 font-medium">Waiting for crate scan…</p>
          <p className="text-xs text-slate-400">Tap to focus scanner</p>
        </div>
      )}

      {status === 'ok' && lockedCrate && (
        <div
          className="rounded-2xl bg-emerald-500 text-white p-6 flex flex-col items-center gap-2 cursor-pointer"
          onClick={clearLock}
        >
          <CheckCircle2 className="w-14 h-14" />
          <p className="text-2xl font-black tracking-wide">CRATE OK</p>
          <p className="text-lg font-bold opacity-90">{lockedCrate.crate_id}</p>
          <p className="text-sm opacity-75">{lockedCrate.bottle_count} bottles · {lockedCrate.current_location}</p>
          <p className="text-xs opacity-60 mt-1">Tap to release</p>
        </div>
      )}

      {status === 'error' && (
        <div
          className="rounded-2xl bg-red-500 text-white p-6 flex flex-col items-center gap-2 cursor-pointer"
          onClick={clearLock}
        >
          <XCircle className="w-14 h-14" />
          <p className="text-2xl font-black tracking-wide">CRATE NOT OK</p>
          <p className="text-sm opacity-90 text-center">{errorMsg}</p>
          <p className="text-xs opacity-60 mt-1">Tap to retry</p>
        </div>
      )}
    </div>
  );
}