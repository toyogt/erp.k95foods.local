import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, PackageOpen } from 'lucide-react';

function genEventId() { return 'RLE-' + Date.now().toString(36).toUpperCase(); }

/**
 * Shown in LabellingLine RUNNING step.
 * Props: wo, machine, user, activeRoll, onRollChanged(roll|null)
 */
export default function RollInstallPanel({ wo, machine, user, activeRoll, onRollChanged }) {
  const [rollInput, setRollInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Setup waste
  const [wasteQty, setWasteQty] = useState('');
  const [wastePhoto, setWastePhoto] = useState('');
  const [wasteSaving, setWasteSaving] = useState(false);

  // Remove roll
  const [showRemove, setShowRemove] = useState(false);
  const [leftoverQty, setLeftoverQty] = useState('');
  const [removeSaving, setRemoveSaving] = useState(false);

  async function installRoll() {
    const rid = rollInput.trim();
    if (!rid) return;
    setLoading(true);
    setError('');
    try {
      const rolls = await base44.entities.LabelRoll.filter({ roll_id: rid });
      if (!rolls.length) { setError(`Roll ${rid} not found`); setLoading(false); return; }
      const roll = rolls[0];
      if (!['AVAILABLE', 'LEFTOVER'].includes(roll.status)) {
        setError(`Roll is ${roll.status} — cannot install`);
        setLoading(false);
        return;
      }
      await base44.entities.LabelRoll.update(roll.id, { status: 'ACTIVE' });
      await base44.entities.LabelRollEvent.create({
        event_id: genEventId(),
        roll_id: rid,
        wo_id: wo?.wo_id || '',
        line_machine_id: machine?.machine_id || '',
        event_type: 'INSTALLED',
        created_at: new Date().toISOString(),
        created_by: user?.email || '',
      });
      onRollChanged({ ...roll, status: 'ACTIVE' });
      setRollInput('');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function logWaste() {
    if (!activeRoll || !wasteQty) return;
    setWasteSaving(true);
    await base44.entities.LabelRollEvent.create({
      event_id: genEventId(),
      roll_id: activeRoll.roll_id,
      wo_id: wo?.wo_id || '',
      line_machine_id: machine?.machine_id || '',
      event_type: 'SETUP_WASTE',
      qty_labels: Number(wasteQty),
      photo: wastePhoto || undefined,
      created_at: new Date().toISOString(),
      created_by: user?.email || '',
    }).catch(() => {});
    setWasteQty('');
    setWastePhoto('');
    setWasteSaving(false);
  }

  async function removeRoll(finished) {
    if (!activeRoll) return;
    setRemoveSaving(true);
    const eventType = finished ? 'REMOVED_FINISHED' : 'REMOVED_LEFTOVER';
    const newStatus = finished ? 'FINISHED' : 'LEFTOVER';
    const rolls = await base44.entities.LabelRoll.filter({ roll_id: activeRoll.roll_id }).catch(() => []);
    if (rolls[0]) {
      await base44.entities.LabelRoll.update(rolls[0].id, { status: newStatus }).catch(() => {});
    }
    await base44.entities.LabelRollEvent.create({
      event_id: genEventId(),
      roll_id: activeRoll.roll_id,
      wo_id: wo?.wo_id || '',
      line_machine_id: machine?.machine_id || '',
      event_type: eventType,
      qty_labels: leftoverQty ? Number(leftoverQty) : undefined,
      created_at: new Date().toISOString(),
      created_by: user?.email || '',
    }).catch(() => {});
    onRollChanged(null);
    setShowRemove(false);
    setLeftoverQty('');
    setRemoveSaving(false);
  }

  if (activeRoll) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <p className="font-semibold text-slate-800 text-sm">Active Roll</p>
          </div>
          <span className="font-mono text-sm font-bold text-slate-700">{activeRoll.roll_id}</span>
        </div>
        {activeRoll.product_code && <p className="text-xs text-slate-500">Product: {activeRoll.product_code}</p>}

        {/* Setup waste */}
        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Setup Waste</p>
          <div className="flex gap-2">
            <input
              className="flex-1 h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
              placeholder="Labels wasted (qty)…"
              type="number"
              min="0"
              value={wasteQty}
              onChange={e => setWasteQty(e.target.value)}
            />
            <Button size="sm" onClick={logWaste} disabled={!wasteQty || wasteSaving}>
              {wasteSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log'}
            </Button>
          </div>
        </div>

        {/* Remove roll */}
        <div className="border-t border-slate-100 pt-3">
          {!showRemove ? (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setShowRemove(true)}>
              Remove Roll
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Remove Roll</p>
              <input
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                placeholder="Estimated labels remaining (optional)…"
                type="number"
                min="0"
                value={leftoverQty}
                onChange={e => setLeftoverQty(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => removeRoll(false)} disabled={removeSaving}>
                  {removeSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save (Leftover)'}
                </Button>
                <Button size="sm" className="flex-1 bg-slate-700 hover:bg-slate-800 text-white"
                  onClick={() => removeRoll(true)} disabled={removeSaving}>
                  {removeSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Finished'}
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="w-full text-slate-400" onClick={() => setShowRemove(false)}>Cancel</Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <PackageOpen className="w-4 h-4 text-slate-500" />
        <p className="font-semibold text-slate-800 text-sm">Install Label Roll</p>
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:border-blue-500"
          placeholder="Scan or enter Roll ID…"
          value={rollInput}
          onChange={e => setRollInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && installRoll()}
        />
        <Button onClick={installRoll} disabled={!rollInput.trim() || loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Install'}
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}