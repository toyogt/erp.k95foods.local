import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { Layers, Loader2, RefreshCw } from 'lucide-react';

function genPalletId() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `PLT-${d}-${rand}`;
}

export default function PalletIdStep({ user, onPalletOpened }) {
  const [palletInput, setPalletInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleConfirm() {
    const pid = palletInput.trim().toUpperCase();
    if (!pid) return;
    setLoading(true);
    setError('');
    // Check if pallet already exists
    const existing = await base44.entities.BoxPallet.filter({ pallet_id: pid }, '-created_date', 1);
    let pallet;
    if (existing.length > 0) {
      pallet = existing[0];
      if (pallet.status === 'SEALED' || pallet.status === 'HANDED_OVER') {
        setError(`Pallet ${pid} is already ${pallet.status}. Generate a new one.`);
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
            onChange={e => { setPalletInput(e.target.value.toUpperCase()); setError(''); }}
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
    </div>
  );
}