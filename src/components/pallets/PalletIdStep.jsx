import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { Layers, Loader2, RefreshCw, AlertTriangle, RotateCcw, Plus } from 'lucide-react';

function genPalletId() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `PLT-${d}-${rand}`;
}

export default function PalletIdStep({ user, onPalletOpened }) {
  const [palletInput, setPalletInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sealedPallet, setSealedPallet] = useState(null);
  const [handedOverPallet, setHandedOverPallet] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function loadBoxesForPallet(palletRec) {
    // Load links tied to this specific record
    let links = await base44.entities.BoxPalletLink.filter(
      { box_pallet_record_id: palletRec.id },
      '-created_date',
      500
    );
    // Fallback for old records
    if (!links.length) {
      links = await base44.entities.BoxPalletLink.filter(
        { pallet_id: palletRec.pallet_id },
        '-created_date',
        500
      );
    }
    const boxes = [];
    for (const link of links) {
      const labels = await base44.entities.BoxLabel.filter({ box_serial: link.box_serial }, '-created_date', 1);
      if (labels.length) boxes.push({ ...labels[0], box_serial: link.box_serial });
    }
    return boxes;
  }

  async function handleConfirm() {
    const pid = palletInput.trim().toUpperCase();
    if (!pid) return;
    setLoading(true);
    setError('');
    setSealedPallet(null);
    setHandedOverPallet(null);

    // Get most recent record for this pallet_id
    const existing = await base44.entities.BoxPallet.filter({ pallet_id: pid }, '-created_date', 1);

    if (existing.length > 0) {
      const pallet = existing[0];

      if (pallet.status === 'OPEN' || pallet.status === 'DRAFT') {
        // Resume draft — load existing boxes automatically
        const preloadedBoxes = await loadBoxesForPallet(pallet);
        setLoading(false);
        onPalletOpened({ ...pallet, _preloadedBoxes: preloadedBoxes });
        return;
      }

      if (pallet.status === 'SEALED') {
        setSealedPallet(pallet);
        setLoading(false);
        return;
      }

      if (pallet.status === 'HANDED_OVER' || pallet.status === 'RECEIVED') {
        setHandedOverPallet(pallet);
        setLoading(false);
        return;
      }
    }

    // New pallet
    const pallet = await base44.entities.BoxPallet.create({
      pallet_id: pid,
      status: 'OPEN',
      created_by_user: user?.email || '',
      opened_at: new Date().toISOString(),
    });
    setLoading(false);
    onPalletOpened(pallet);
  }

  async function handleReopen() {
    setLoading(true);
    await base44.entities.BoxPallet.update(sealedPallet.id, { status: 'OPEN' });
    const preloadedBoxes = await loadBoxesForPallet(sealedPallet);
    setSealedPallet(null);
    setLoading(false);
    onPalletOpened({ ...sealedPallet, status: 'OPEN', sealed_at: null, _preloadedBoxes: preloadedBoxes });
  }

  async function handleStartNewBuild() {
    setLoading(true);
    const newRecord = await base44.entities.BoxPallet.create({
      pallet_id: handedOverPallet.pallet_id,
      status: 'OPEN',
      created_by_user: user?.email || '',
      opened_at: new Date().toISOString(),
    });
    setHandedOverPallet(null);
    setLoading(false);
    onPalletOpened(newRecord);
  }

  function handleGenerate() {
    setPalletInput(genPalletId());
  }

  function handleKey(e) {
    if (e.key === 'Enter') handleConfirm();
  }

  function reset() {
    setPalletInput('');
    setError('');
    setSealedPallet(null);
    setHandedOverPallet(null);
  }

  return (
    <div className="max-w-md mx-auto mt-10 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
          <Layers className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-base">Step 1 — Pallet ID</h3>
          <p className="text-xs text-slate-500">Scan an existing pallet QR or generate a new ID.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Pallet ID</label>
          <input
            ref={inputRef}
            className="w-full h-11 px-4 text-sm rounded-xl border border-slate-300 focus:border-emerald-500 focus:outline-none font-mono tracking-wider"
            placeholder="Scan or type Pallet ID…"
            value={palletInput}
            onChange={e => { setPalletInput(e.target.value.toUpperCase()); setError(''); setSealedPallet(null); setHandedOverPallet(null); }}
            onKeyDown={handleKey}
          />
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleGenerate} className="gap-2 flex-1">
            <RefreshCw className="w-4 h-4" /> Generate New
          </Button>
          <Button onClick={handleConfirm} disabled={!palletInput.trim() || loading} className="gap-2 flex-1 bg-emerald-600 hover:bg-emerald-700">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Open Pallet →'}
          </Button>
        </div>
        {loading && (
          <p className="text-xs text-slate-400 text-center animate-pulse">Loading pallet data…</p>
        )}
      </div>

      {/* Recovery: SEALED pallet */}
      {sealedPallet && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800">Pallet is already SEALED</p>
              <p className="text-sm text-amber-700 mt-1">
                <span className="font-mono font-semibold">{sealedPallet.pallet_id}</span> was sealed but not yet handed over.
              </p>
            </div>
          </div>
          <Button onClick={handleReopen} disabled={loading} className="w-full gap-2 bg-amber-600 hover:bg-amber-700">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading existing boxes…</> : <><RotateCcw className="w-4 h-4" /> Re-open & Continue Scanning</>}
          </Button>
          <button onClick={reset} className="w-full text-xs text-slate-400 hover:text-slate-600 pt-1">Cancel</button>
        </div>
      )}

      {/* Reuse: HANDED_OVER or RECEIVED pallet */}
      {handedOverPallet && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-blue-800">Pallet Previously Used</p>
              <p className="text-sm text-blue-700 mt-1">
                <span className="font-mono font-semibold">{handedOverPallet.pallet_id}</span> was already handed over.
                Start a new build on this pallet?
              </p>
            </div>
          </div>
          <Button onClick={handleStartNewBuild} disabled={loading} className="w-full gap-2 bg-blue-600 hover:bg-blue-700">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating new build…</> : <><Plus className="w-4 h-4" /> Start New Build on This Pallet</>}
          </Button>
          <button onClick={reset} className="w-full text-xs text-slate-400 hover:text-slate-600 pt-1">Cancel — scan different pallet</button>
        </div>
      )}
    </div>
  );
}