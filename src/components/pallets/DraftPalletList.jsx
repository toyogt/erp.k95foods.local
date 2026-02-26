import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Layers, ChevronRight, RefreshCw } from 'lucide-react';

export default function DraftPalletList({ user, onResume }) {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    // Get OPEN pallets (current user or all if admin)
    const openPallets = await base44.entities.BoxPallet.filter(
      { status: 'OPEN' }, '-updated_date', 20
    );
    setDrafts(openPallets);
    setLoading(false);
  }

  async function handleResume(pallet) {
    // Load boxes for this pallet
    let links = await base44.entities.BoxPalletLink.filter(
      { box_pallet_record_id: pallet.id }, '-created_date', 500
    );
    if (!links.length) {
      links = await base44.entities.BoxPalletLink.filter(
        { pallet_id: pallet.pallet_id }, '-created_date', 500
      );
    }
    const boxes = [];
    for (const link of links) {
      const labels = await base44.entities.BoxLabel.filter({ box_serial: link.box_serial }, '-created_date', 1);
      if (labels.length) boxes.push({ ...labels[0], box_serial: link.box_serial });
    }
    onResume({ ...pallet, _preloadedBoxes: boxes });
  }

  if (loading) return (
    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
  );

  if (drafts.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-bold text-amber-800">Open / Draft Pallets</span>
          <span className="bg-amber-200 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">{drafts.length}</span>
        </div>
        <button onClick={load} className="text-amber-400 hover:text-amber-600">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="space-y-2">
        {drafts.map(p => (
          <button
            key={p.id}
            onClick={() => handleResume(p)}
            className="w-full bg-white border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-amber-50 transition-colors text-left"
          >
            <div className="flex-1 min-w-0">
              <p className="font-mono font-bold text-slate-800 text-sm">{p.pallet_id}</p>
              {p.product_name && <p className="text-xs text-slate-500 truncate">{p.product_name}</p>}
              {p.batch_no && <p className="text-xs text-slate-400">Batch: {p.batch_no}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {p.total_boxes > 0 && (
                <div className="text-right">
                  <span className="text-lg font-black text-slate-800">{p.total_boxes}</span>
                  <p className="text-xs text-slate-400">boxes</p>
                </div>
              )}
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </button>
        ))}
      </div>
      <p className="text-xs text-amber-600 text-center">Tap a pallet to continue scanning</p>
    </div>
  );
}