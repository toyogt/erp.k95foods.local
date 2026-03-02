import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw, Plus, ChevronDown, X } from 'lucide-react';
import { printReactComponent } from '@/components/printing/printLabel';
import RollBarcodeLabel from '@/components/labelling/RollBarcodeLabel';

const REASON_CODES = [
  { value: 'SKEWED_LABEL', label: 'Skewed Label' },
  { value: 'WRONG_LABEL',  label: 'Wrong Label'  },
  { value: 'BAD_PRINT',    label: 'Bad Print'    },
  { value: 'DAMAGE',       label: 'Damage'       },
  { value: 'OTHER',        label: 'Other'        },
];

function genId(prefix) { return `${prefix}-${Date.now().toString(36).toUpperCase()}`; }

/**
 * ReworkPanel — shown in LabellingLine RUNNING step.
 * Props: wo, machine, user, activeRoll, isSupervisor
 */
export default function ReworkPanel({ wo, machine, user, activeRoll, isSupervisor }) {
  const [tote, setTote]           = useState(null);   // active ReworkTote record
  const [toteInput, setToteInput] = useState('');
  const [toteBusy, setToteBusy]   = useState(false);
  const [toteError, setToteError] = useState('');

  const [reason, setReason]       = useState('SKEWED_LABEL');
  const [showReason, setShowReason] = useState(false);
  const [eventBusy, setEventBusy] = useState(false);
  const [toteTotal, setToteTotal] = useState(0);      // running bottle count this session

  const [closeBusy, setCloseBusy] = useState(false);
  const [closed, setClosed]       = useState(false);

  // Supervisor: label-waste link
  const [labelWasteQty, setLabelWasteQty] = useState('');
  const [linkBusy, setLinkBusy]   = useState(false);
  const [linkDone, setLinkDone]   = useState(false);

  // Load total from existing events for this tote whenever tote changes
  useEffect(() => {
    if (!tote) { setToteTotal(0); return; }
    base44.entities.ReworkEvent.filter({ tote_id: tote.tote_id })
      .then(evts => setToteTotal(evts.reduce((s, e) => s + (e.qty_bottles || 0), 0)))
      .catch(() => {});
  }, [tote?.tote_id]);

  async function loadOrCreateTote(toteId) {
    setToteBusy(true);
    setToteError('');
    try {
      const existing = await base44.entities.ReworkTote.filter({ tote_id: toteId });
      if (existing.length) {
        if (existing[0].status === 'CLOSED') {
          setToteError(`Tote ${toteId} is already CLOSED. Use a new tote.`);
          setToteBusy(false);
          return;
        }
        setTote(existing[0]);
        setClosed(false);
        setLinkDone(false);
      } else {
        const now = new Date().toISOString();
        const rec = await base44.entities.ReworkTote.create({
          tote_id: toteId,
          status: 'OPEN',
          wo_id: wo?.wo_id || '',
          line_machine_id: machine?.machine_id || '',
          opened_at: now,
          opened_by: user?.email || '',
        });
        setTote(rec);
        setClosed(false);
        setLinkDone(false);
        // Print tote QR label (reuse RollBarcodeLabel with roll_id = tote_id)
        printReactComponent(RollBarcodeLabel, {
          roll_id: toteId,
          label_variant_id: '',
          product_code: wo?.product_code || wo?.product || '',
          declared_qty_labels: null,
        });
      }
    } catch (e) {
      setToteError(e.message || 'Failed to load tote');
    }
    setToteInput('');
    setToteBusy(false);
  }

  async function addBottles(qty) {
    if (!tote || eventBusy) return;
    setEventBusy(true);
    const now = new Date().toISOString();
    await base44.entities.ReworkEvent.create({
      event_id: genId('RWK'),
      tote_id: tote.tote_id,
      wo_id: wo?.wo_id || '',
      line_machine_id: machine?.machine_id || '',
      reason_code: reason,
      qty_bottles: qty,
      created_at: now,
      created_by: user?.email || '',
    }).catch(() => {});
    setToteTotal(prev => prev + qty);
    setEventBusy(false);
  }

  async function closeTote() {
    if (!tote || closeBusy) return;
    setCloseBusy(true);
    const now = new Date().toISOString();
    await base44.entities.ReworkTote.update(tote.id, {
      status: 'CLOSED',
      closed_at: now,
      closed_by: user?.email || '',
    }).catch(() => {});
    setTote(prev => ({ ...prev, status: 'CLOSED' }));
    setClosed(true);
    setCloseBusy(false);
  }

  async function linkLabelWaste() {
    if (!labelWasteQty || !activeRoll) return;
    setLinkBusy(true);
    await base44.entities.LabelRollEvent.create({
      event_id: genId('RLE'),
      roll_id: activeRoll.roll_id,
      wo_id: wo?.wo_id || '',
      line_machine_id: machine?.machine_id || '',
      event_type: 'RUN_WASTE',
      qty_labels: Number(labelWasteQty),
      reason: `REWORK — tote ${tote?.tote_id}`,
      created_at: new Date().toISOString(),
      created_by: user?.email || '',
    }).catch(() => {});
    // Save on tote too
    if (tote?.id) {
      await base44.entities.ReworkTote.update(tote.id, {
        estimated_labels_used_for_rework: Number(labelWasteQty),
      }).catch(() => {});
    }
    setLabelWasteQty('');
    setLinkDone(true);
    setLinkBusy(false);
  }

  const reasonLabel = REASON_CODES.find(r => r.value === reason)?.label || reason;

  return (
    <div className="bg-white rounded-2xl border border-amber-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <RotateCcw className="w-4 h-4 text-amber-600" />
        <p className="font-semibold text-slate-800 text-sm">Rework</p>
        {tote && !closed && (
          <span className="ml-auto text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            {tote.tote_id} · {toteTotal} btl
          </span>
        )}
        {closed && (
          <span className="ml-auto text-xs font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
            CLOSED · {toteTotal} btl
          </span>
        )}
      </div>

      {/* No tote selected */}
      {!tote && (
        <div className="flex gap-2">
          <input
            className="flex-1 h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:border-amber-400"
            placeholder="Scan or type Tote ID (or new ID to create)…"
            value={toteInput}
            onChange={e => setToteInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && toteInput.trim() && loadOrCreateTote(toteInput.trim())}
          />
          <Button
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-white"
            onClick={() => toteInput.trim() && loadOrCreateTote(toteInput.trim())}
            disabled={!toteInput.trim() || toteBusy}
          >
            {toteBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Open'}
          </Button>
        </div>
      )}
      {toteError && <p className="text-xs text-red-600">{toteError}</p>}

      {/* Active tote */}
      {tote && !closed && (
        <>
          {/* Reason selector */}
          <div className="relative">
            <button
              className="flex items-center gap-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 w-full"
              onClick={() => setShowReason(v => !v)}
            >
              <span>Reason: {reasonLabel}</span>
              <ChevronDown className="w-3 h-3 ml-auto" />
            </button>
            {showReason && (
              <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                {REASON_CODES.map(rc => (
                  <button
                    key={rc.value}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 ${reason === rc.value ? 'font-bold text-amber-700 bg-amber-50' : 'text-slate-700'}`}
                    onClick={() => { setReason(rc.value); setShowReason(false); }}
                  >
                    {rc.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick-add buttons */}
          <div className="flex gap-2">
            {[1, 5, 10].map(qty => (
              <button
                key={qty}
                onClick={() => addBottles(qty)}
                disabled={eventBusy}
                className="flex-1 h-12 rounded-xl border-2 border-amber-300 bg-amber-50 hover:bg-amber-100 active:scale-95 transition-all font-bold text-amber-800 text-lg disabled:opacity-50"
              >
                {eventBusy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `+${qty}`}
              </button>
            ))}
          </div>

          {/* Close tote */}
          <div className="border-t border-slate-100 pt-2 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
              onClick={closeTote}
              disabled={closeBusy}
            >
              {closeBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Close Tote'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400"
              onClick={() => { setTote(null); setToteTotal(0); setLinkDone(false); }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </>
      )}

      {/* Closed tote summary + label waste link */}
      {tote && closed && (
        <div className="space-y-3">
          <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600">
            <p className="font-bold text-slate-800">Tote {tote.tote_id} closed</p>
            <p>{toteTotal} bottles reworked</p>
          </div>

          {isSupervisor && activeRoll && !linkDone && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Link Label Waste (optional)</p>
              <div className="flex gap-2">
                <input
                  className="flex-1 h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="Labels consumed for rework…"
                  type="number"
                  min="0"
                  value={labelWasteQty}
                  onChange={e => setLabelWasteQty(e.target.value)}
                />
                <Button size="sm" onClick={linkLabelWaste} disabled={!labelWasteQty || linkBusy}>
                  {linkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log'}
                </Button>
              </div>
              <p className="text-xs text-slate-400">Creates RUN_WASTE against roll {activeRoll.roll_id}</p>
            </div>
          )}
          {linkDone && <p className="text-xs text-emerald-600 font-semibold">✓ Label waste logged against roll</p>}

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => { setTote(null); setToteTotal(0); setClosed(false); setLinkDone(false); }}
          >
            Open New Tote
          </Button>
        </div>
      )}
    </div>
  );
}