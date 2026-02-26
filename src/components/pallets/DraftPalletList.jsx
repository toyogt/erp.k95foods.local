import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, RefreshCw, Trash2, ChevronRight, Package, Clock } from 'lucide-react';

export default function DraftPalletList({ user, onResume }) {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);
  const [resuming, setResuming] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const openPallets = await base44.entities.BoxPallet.filter({ status: 'OPEN' }, '-updated_date', 20);
    setDrafts(openPallets);
    setLoading(false);
  }

  async function handleResume(pallet) {
    setResuming(pallet.id);
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
    setResuming(null);
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
    <div className="flex justify-center py-6">
      <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
    </div>
  );

  if (drafts.length === 0) return null;

  return (
    <div className="rounded-2xl overflow-hidden border border-amber-200 shadow-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
            <Package className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-white">Open / Draft Pallets</span>
            <span className="ml-2 bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">{drafts.length}</span>
          </div>
        </div>
        <button onClick={load} className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
          <RefreshCw className="w-3.5 h-3.5 text-white" />
        </button>
      </div>

      {/* Pallets */}
      <div className="bg-amber-50 divide-y divide-amber-100">
        {drafts.map(p => (
          <div key={p.id} className="flex items-stretch gap-0">
            {/* Main card - resume */}
            <button
              onClick={() => handleResume(p)}
              disabled={!!cancelling || !!resuming}
              className="flex-1 min-w-0 px-4 py-3.5 flex items-center gap-3 hover:bg-amber-100/70 transition-colors text-left disabled:opacity-60"
            >
              {/* Pallet icon */}
              <div className="w-10 h-10 rounded-xl bg-amber-200/60 flex items-center justify-center shrink-0">
                {resuming === p.id
                  ? <Loader2 className="w-5 h-5 text-amber-700 animate-spin" />
                  : <span className="text-lg">🪵</span>
                }
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-mono font-bold text-slate-800 text-sm leading-tight">{p.pallet_id}</p>
                {p.product_name && (
                  <p className="text-xs text-slate-600 truncate mt-0.5">{p.product_name}</p>
                )}
                {p.batch_no && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="w-2.5 h-2.5 text-slate-400" />
                    <p className="text-xs text-slate-400 font-mono">Batch: {p.batch_no}</p>
                  </div>
                )}
              </div>
              {/* Box count + arrow */}
              <div className="flex items-center gap-2 shrink-0">
                {p.total_boxes > 0 && (
                  <div className="bg-amber-200 rounded-lg px-2.5 py-1 text-center">
                    <span className="text-base font-black text-amber-900 leading-none">{p.total_boxes}</span>
                    <p className="text-xs text-amber-700 leading-none mt-0.5">boxes</p>
                  </div>
                )}
                {p.total_boxes === 0 && (
                  <div className="bg-slate-100 rounded-lg px-2.5 py-1">
                    <p className="text-xs text-slate-400">empty</p>
                  </div>
                )}
                <ChevronRight className="w-4 h-4 text-amber-400" />
              </div>
            </button>

            {/* Delete button */}
            <button
              onClick={e => handleCancel(e, p)}
              disabled={cancelling === p.id || !!resuming}
              className="w-12 flex items-center justify-center bg-amber-50 hover:bg-red-50 border-l border-amber-100 transition-colors disabled:opacity-50"
            >
              {cancelling === p.id
                ? <Loader2 className="w-4 h-4 text-red-400 animate-spin" />
                : <Trash2 className="w-4 h-4 text-red-300 hover:text-red-500" />
              }
            </button>
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div className="bg-amber-50 border-t border-amber-100 px-4 py-2 text-center">
        <p className="text-xs text-amber-600">Tap a pallet to continue scanning</p>
      </div>
    </div>
  );
}