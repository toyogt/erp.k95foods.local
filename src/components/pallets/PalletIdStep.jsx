import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { Layers, Loader2, RefreshCw, AlertTriangle, RotateCcw } from 'lucide-react';

function genPalletId() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `PLT-${d}-${rand}`;
}

export default function PalletIdStep({ user, onPalletOpened }) {
  const [palletInput, setPalletInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sealedPallet, setSealedPallet] = useState(null); // pallet that is already sealed
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleConfirm() {
    const pid = palletInput.trim().toUpperCase();
    if (!pid) return;
    setLoading(true);
    setError('');
    setSealedPallet(null);
    const existing = await base44.entities.BoxPallet.filter({ pallet_id: pid }, '-created_date', 1);
    let pallet;
    if (existing.length > 0) {
      pallet = existing[0];
      if (pallet.status === 'HANDED_OVER') {
        setError(`Pallet ${pid} has already been handed over and is complete.`);
        setLoading(false);
        return;
      }
      if (pallet.status === 'SEALED') {
        // Show recovery options instead of blocking
        setSealedPallet(pallet);
        setLoading(false);
        return;
      }
    } else {
      pallet = await base44.entities.BoxPallet.create({
        pallet_id: pid,
        status: 'OPEN',
        created_by_user: user?.email || '',
        opened_at: new Date().toISOString(),
      });
    }
    setLoading(false);
    onPalletOpened(pallet);
  }

  // Reopen the pallet: unseal it, load already-scanned boxes, go to scan step
  async function handleReopen() {
    setLoading(true);
    // Unseal it
    const updated = await base44.entities.BoxPallet.update(sealedPallet.id, { status: 'OPEN' });
    // Load existing box links
    const links = await base44.entities.BoxPalletLink.filter({ pallet_id: sealedPallet.pallet_id }, '-created_date', 500);
    const preloadedBoxes = [];
    for (const link of links) {
      const labels = await base44.entities.BoxLabel.filter({ box_serial: link.box_serial }, '-created_date', 1);
      if (labels.length) preloadedBoxes.push({ ...labels[0], box_serial: link.box_serial });
    }
    setSealedPallet(null);
    setLoading(false);
    onPalletOpened({ ...updated, _preloadedBoxes: preloadedBoxes });
  }

  function handleGenerate() {
    setPalletInput(genPalletId());
  }

  function handleKey(e) {
    if (e.key === 'Enter') handleConfirm();
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
            onChange={e => { setPalletInput(e.target.value.toUpperCase()); setError(''); setSealedPallet(null); }}
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
      </div>

      {/* Recovery panel for already-sealed pallets */}
      {sealedPallet && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800">Pallet is already SEALED</p>
              <p className="text-sm text-amber-700 mt-1">
                <span className="font-mono font-semibold">{sealedPallet.pallet_id}</span> was sealed but not yet handed over.
                How would you like to proceed?
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleProceedToHandover}
              className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Proceed to Handover (skip scanning)
            </Button>
            <Button
              variant="outline"
              onClick={handleReopen}
              disabled={loading}
              className="w-full gap-2 border-amber-300 text-amber-800 hover:bg-amber-100"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Re-open Pallet (re-scan boxes)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}