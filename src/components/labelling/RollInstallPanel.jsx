import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, PackageOpen, ShieldAlert } from 'lucide-react';
import { logAudit } from '@/components/AuditLogger';
import { raiseAlert } from '@/components/alerts/alertHelpers';

function genEventId() { return 'RLE-' + Date.now().toString(36).toUpperCase(); }

/**
 * Shown in LabellingLine RUNNING step.
 * Props: wo, machine, user, isSupervisor, activeRoll, expectedArtworkId, onRollChanged(roll|null)
 */
export default function RollInstallPanel({ wo, machine, user, isSupervisor, activeRoll, expectedArtworkId, onRollChanged }) {
  const [rollInput, setRollInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [blockData, setBlockData] = useState(null); // { roll, foundArtwork, expectedArtwork }

  // Override flow
  const [showOverride, setShowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideSaving, setOverrideSaving] = useState(false);

  // Setup waste
  const [wasteQty, setWasteQty] = useState('');
  const [wasteSaving, setWasteSaving] = useState(false);

  // Remove roll
  const [showRemove, setShowRemove] = useState(false);
  const [leftoverQty, setLeftoverQty] = useState('');
  const [removeSaving, setRemoveSaving] = useState(false);

  async function installRoll(overrideByAdmin = false, reason = '') {
    const rid = rollInput.trim();
    if (!rid) return;
    setLoading(true);
    setError('');
    setBlockData(null);

    try {
      const rolls = await base44.entities.LabelRoll.filter({ roll_id: rid });
      if (!rolls.length) { setError(`Roll ${rid} not found`); setLoading(false); return; }
      const roll = rolls[0];

      if (!['AVAILABLE', 'LEFTOVER'].includes(roll.status)) {
        setError(`Roll is ${roll.status} — cannot install`);
        setLoading(false);
        return;
      }

      // Artwork enforcement
      if (expectedArtworkId && roll.artwork_id !== expectedArtworkId && !overrideByAdmin) {
        // Load both artworks for display
        const [allArts] = await Promise.all([
          base44.entities.LabelArtwork.list('artwork_name', 200).catch(() => []),
        ]);
        const artMap = {};
        allArts.forEach(a => { artMap[a.artwork_id] = a; });
        setBlockData({
          roll,
          foundArtwork: artMap[roll.artwork_id],
          expectedArtwork: artMap[expectedArtworkId],
        });
        await raiseAlert({
          severity: 'CRITICAL',
          station_type: 'LABELLING',
          reference_type: 'LabelRoll',
          reference_id: rid,
          message: `Wrong label artwork roll installed on ${machine?.machine_id || 'line'}. Expected artwork ${expectedArtworkId}, got ${roll.artwork_id || 'none'}.`,
        });
        setLoading(false);
        return;
      }

      // If admin override, log it
      if (overrideByAdmin && reason) {
        await logAudit({
          action: `Admin override: installed roll ${rid} with artwork ${roll.artwork_id} (expected ${expectedArtworkId}). Reason: ${reason}`,
          entity_type: 'LabelRoll',
          entity_id: rid,
          user,
          station: machine?.machine_id || '',
        });
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
      setBlockData(null);
      setShowOverride(false);
      setOverrideReason('');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function doAdminOverride() {
    if (!overrideReason.trim()) return;
    setOverrideSaving(true);
    await installRoll(true, overrideReason.trim());
    setOverrideSaving(false);
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
      created_at: new Date().toISOString(),
      created_by: user?.email || '',
    }).catch(() => {});
    setWasteQty('');
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

  // ---- HARD BLOCK: wrong artwork ----
  if (blockData) {
    return (
      <div className="bg-red-700 text-white rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 shrink-0" />
          <p className="text-lg font-black">⛔ WRONG ARTWORK ROLL</p>
        </div>
        <div className="bg-red-800 rounded-xl p-3 text-sm space-y-1">
          <p>Roll: <span className="font-mono font-bold">{blockData.roll.roll_id}</span></p>
          <p>Roll artwork: <span className="font-bold">{blockData.foundArtwork?.artwork_name || blockData.roll.artwork_id || 'Unknown'}{blockData.foundArtwork?.artwork_version ? ` (${blockData.foundArtwork.artwork_version})` : ''}</span></p>
          <p>Expected: <span className="font-bold">{blockData.expectedArtwork?.artwork_name || expectedArtworkId}{blockData.expectedArtwork?.artwork_version ? ` (${blockData.expectedArtwork.artwork_version})` : ''}</span></p>
        </div>
        <p className="text-xs opacity-80 text-center">Remove this roll and install the correct one.</p>

        {isSupervisor && !showOverride && (
          <Button
            onClick={() => setShowOverride(true)}
            className="w-full bg-white text-red-700 hover:bg-red-50 font-bold"
          >
            Admin Override (with reason)
          </Button>
        )}

        {isSupervisor && showOverride && (
          <div className="space-y-2">
            <p className="text-xs font-semibold opacity-80">Override Reason *</p>
            <input
              className="w-full h-10 px-3 rounded-lg border border-red-400 text-sm text-slate-900"
              placeholder="Reason for override…"
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                onClick={doAdminOverride}
                disabled={!overrideReason.trim() || overrideSaving}
                className="flex-1 bg-white text-red-700 hover:bg-red-50 font-bold"
              >
                {overrideSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Override'}
              </Button>
              <Button variant="ghost" onClick={() => setShowOverride(false)} className="text-white hover:bg-red-600">Cancel</Button>
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          onClick={() => { setBlockData(null); setRollInput(''); setShowOverride(false); }}
          className="w-full text-white hover:bg-red-600 text-sm"
        >
          Dismiss
        </Button>
      </div>
    );
  }

  // ---- ACTIVE ROLL ----
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
        {activeRoll.sku_code && <p className="text-xs text-slate-500">SKU: {activeRoll.sku_code}</p>}

        {/* Setup waste */}
        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Setup Waste</p>
          <div className="flex gap-2">
            <input
              className="flex-1 h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
              placeholder="Labels wasted (qty)…"
              type="number" min="0"
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
                type="number" min="0"
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

  // ---- INSTALL FORM ----
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
        <Button onClick={() => installRoll()} disabled={!rollInput.trim() || loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Install'}
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}