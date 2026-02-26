import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Layers, ChevronRight, RefreshCw, Trash2 } from 'lucide-react';

export default function DraftPalletList({ user, onResume }) {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const openPallets = await base44.entities.BoxPallet.filter({ status: 'OPEN' }, '-updated_date', 20);
    setDrafts(openPallets);
    setLoading(false);
  }

  async function handleResume(pallet) {
    let links = await base44.entities.BoxPalletLink.filter({ box_pallet_record_id: pallet.id }, '-created_date', 500);
    if (!links.length) {
      links = await base44.entities.BoxPalletLink.filter({ pallet_id: pallet.pallet_id }, '-created_date', 500);
    }
    const boxes = [];
    for (const link of links) {
      const labels = await base44.entities.BoxLabel.filter({ box_serial: link.box_serial }, '-created_date', 1);
      if (labels.length) boxes.push({ ...labels[0], box_serial: link.box_serial });
    }
    onResume({ ...pallet, _preloadedBoxes: boxes });
  }

  async function handleCancel(e, pallet) {
    e.stopPropagation();
    if (!window.confirm(`Cancel and delete draft pallet "${pallet.pallet_id}"? All scanned boxes will be unlinked.`)) return;
    setCancelling(pallet.id);
    const links = await base44.entities.BoxPalletLink.filter({ box_pallet_record_id: pallet.id }, '-created_date', 500);
    for (const link of links) {
      const labels = await base44.entities.BoxLabel.filter({ box_serial: link.box_serial }, '-created_date', 1);
      if (labels.length) {
        await base44.entities.BoxLabel.update(labels[0].id, { status: 'PRINTED_UNREGISTERED', current_location: 'LABEL-STATION' });
      }
      await base44.entities.BoxPalletLink.delete(link.id);
    }
    await base44.entities.BoxPallet.delete(pallet.id);
    setCancelling(null);
    load();
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
          <div key={p.id} className="flex items-center gap-2">
            <button
              onClick={() => handleResume(p)}
              disabled={cancelling === p.id}
              className="flex-1 bg-white border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-amber-50 transition-colors text-left disabled:opacity-50"
            >
              <div className="flex-1 min-w-0 overflow-hidden">
                <p className="font-mono font-bold text-slate-800 text-sm truncate">{p.pallet_id}</p>
                {p.product_name && <p className="text-xs text-slate-500 truncate max-w-[180px]">{p.product_name}</p>}
                {p.batch_no && <p className="text-xs text-slate-400 truncate">Batch: {p.batch_no}</p>}
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
            <button
              onClick={e => handleCancel(e, p)}
              disabled={cancelling === p.id}
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-red-200 bg-white text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              title="Cancel draft"
            >
              {cancelling === p.id
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Trash2 className="w-4 h-4" />
              }
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-amber-600 text-center">Tap a pallet to continue scanning · Trash to cancel</p>
    </div>
  );
}