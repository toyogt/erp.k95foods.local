import { base44 } from '@/api/base44Client';

/**
 * Runs a full trace investigation given one or more search params.
 * Returns a structured result object with data grouped by section.
 */
export async function runTraceInvestigation({ crateId, palletId, boxSerial, batchId, ryanCount }) {
  const result = {
    searchParams: { crateId, palletId, boxSerial, batchId, ryanCount },
    crate: null,
    pallet: null,
    filling: null,
    chamber: [],
    labelling: null,
    packaging: null,
    errors: [],
  };

  // ── 1. Resolve primary entity ─────────────────────────────────
  let resolvedCrateId = crateId;
  let resolvedPalletId = palletId;

  // If box_serial given, find pallet
  if (boxSerial && !resolvedPalletId) {
    try {
      const links = await base44.entities.BoxPalletLink.filter({ box_serial: boxSerial }, '-scanned_at', 5);
      if (links[0]?.pallet_id) resolvedPalletId = links[0].pallet_id;
      const box = await base44.entities.BoxLabel.filter({ box_serial: boxSerial });
      result.packaging = { ...result.packaging, box: box[0] || null };
    } catch (e) { result.errors.push('BoxLabel lookup: ' + e.message); }
  }

  // If pallet_id given (or resolved), find a crate via PalletCrateLink
  if (resolvedPalletId && !resolvedCrateId) {
    try {
      const pcLinks = await base44.entities.PalletCrateLink.filter({ pallet_id: resolvedPalletId });
      if (pcLinks[0]?.crate_id) resolvedCrateId = pcLinks[0].crate_id;
    } catch (e) { result.errors.push('PalletCrateLink: ' + e.message); }
  }

  // Load crate entity
  if (resolvedCrateId) {
    try {
      const crates = await base44.entities.Crate.filter({ crate_id: resolvedCrateId });
      result.crate = crates[0] || null;
    } catch (e) { result.errors.push('Crate: ' + e.message); }
  }

  // Load pallet entity
  if (resolvedPalletId) {
    try {
      const pallets = await base44.entities.Pallet.filter({ pallet_id: resolvedPalletId });
      result.pallet = pallets[0] || null;
    } catch (e) { result.errors.push('Pallet: ' + e.message); }
  }

  // ── 2. Filling section ────────────────────────────────────────
  if (resolvedCrateId) {
    try {
      const [crateLabels, printLogs] = await Promise.all([
        base44.entities.CrateLabelPrintLog.filter({ crate_id: resolvedCrateId }, '-printed_at', 10),
        base44.entities.BoxLabelPrintLog.filter({ wo_id: result.crate?.wo_id || 'NOPE' }, '-printed_at', 10).catch(() => []),
      ]);
      result.filling = {
        crate: result.crate,
        crateLabels,
        batch: result.crate?.batch_id
          ? await base44.entities.Batch.filter({ batch_id: result.crate.batch_id }).then(r => r[0]).catch(() => null)
          : null,
      };
    } catch (e) { result.errors.push('Filling: ' + e.message); }
  } else if (batchId) {
    try {
      const batch = await base44.entities.Batch.filter({ batch_id: batchId }).then(r => r[0]).catch(() => null);
      result.filling = { crate: null, crateLabels: [], batch };
    } catch (e) { result.errors.push('Batch: ' + e.message); }
  }

  // ── 3. Pallet links (get all crate IDs if pallet given) ───────
  let palletCrateIds = [];
  if (resolvedPalletId) {
    try {
      const links = await base44.entities.PalletCrateLink.filter({ pallet_id: resolvedPalletId });
      palletCrateIds = links.map(l => l.crate_id);
    } catch { /* ignore */ }
  } else if (resolvedCrateId) {
    palletCrateIds = [resolvedCrateId];
    // Find pallet containing this crate
    try {
      const links = await base44.entities.PalletCrateLink.filter({ crate_id: resolvedCrateId });
      if (links[0]?.pallet_id) {
        resolvedPalletId = links[0].pallet_id;
        const pallets = await base44.entities.Pallet.filter({ pallet_id: resolvedPalletId });
        result.pallet = pallets[0] || null;
      }
    } catch { /* ignore */ }
  }

  // ── 4. Chamber section ────────────────────────────────────────
  if (resolvedPalletId) {
    try {
      const cycles = await base44.entities.ChamberCycle.filter({ pallet_id: resolvedPalletId }, '-started_at', 20);
      const chamberData = await Promise.all(cycles.map(async (cycle) => {
        const [checks, downtimes] = await Promise.all([
          base44.entities.ChamberCycleCheck.filter({ cycle_id: cycle.cycle_id }, '-due_at', 20).catch(() => []),
          base44.entities.DowntimeEvent.filter({ cycle_id: cycle.cycle_id }, '-started_at', 10).catch(() => []),
        ]);
        return { cycle, checks, downtimes };
      }));
      result.chamber = chamberData;
    } catch (e) { result.errors.push('Chamber: ' + e.message); }
  }

  // ── 5. Labelling section ──────────────────────────────────────
  if (resolvedCrateId) {
    try {
      const [traceWindows, feederScans] = await Promise.all([
        base44.entities.CrateTraceWindow.filter({ crate_id: resolvedCrateId }, '-scanned_at', 20),
        base44.entities.FeederCrateScan.filter({ crate_id: resolvedCrateId }, '-scanned_at', 20),
      ]);

      // Find WO from trace or crate
      const woId = traceWindows[0]?.wo_id || result.crate?.wo_id || null;
      let wo = null, lineSession = null, rolls = [], rework = [];
      if (woId) {
        [wo, rolls, rework] = await Promise.all([
          base44.entities.PackingWO.filter({ wo_id: woId }).then(r => r[0]).catch(() => null),
          base44.entities.LabelRollEvent.filter({ wo_id: woId }, '-created_at', 20).catch(() => []),
          base44.entities.ReworkEvent.filter({ wo_id: woId }, '-created_at', 20).catch(() => []),
        ]);
        const sessions = await base44.entities.LineSession.filter({ wo_id: woId }, '-started_at', 3).catch(() => []);
        lineSession = sessions[0] || null;
      }

      // Ryan count snapshots near scan times (from LineMetricSample)
      let ryanSnapshots = [];
      const lineMachineId = traceWindows[0]?.line_machine_id || feederScans[0]?.line_machine_id || null;
      if (lineMachineId) {
        ryanSnapshots = await base44.entities.LineMetricSample.filter(
          { line_machine_id: lineMachineId }, '-captured_at', 10
        ).catch(() => []);
      }

      result.labelling = { traceWindows, feederScans, wo, lineSession, rolls, rework, ryanSnapshots };
    } catch (e) { result.errors.push('Labelling: ' + e.message); }
  } else if (ryanCount) {
    // Ryan count approximate search
    try {
      const samples = await base44.entities.LineMetricSample.filter({}, '-captured_at', 50);
      const near = samples.filter(s => s.ryan_count != null && Math.abs(s.ryan_count - Number(ryanCount)) < 500);
      result.labelling = { traceWindows: [], feederScans: [], wo: null, lineSession: null, rolls: [], rework: [], ryanSnapshots: near };
    } catch (e) { result.errors.push('Ryan: ' + e.message); }
  }

  // ── 6. Packaging section ──────────────────────────────────────
  if (resolvedPalletId || boxSerial) {
    try {
      const boxLinks = resolvedPalletId
        ? await base44.entities.BoxPalletLink.filter({ pallet_id: resolvedPalletId }, '-scanned_at', 20)
        : [];
      const boxSerials = boxLinks.map(l => l.box_serial);
      if (boxSerial && !boxSerials.includes(boxSerial)) boxSerials.push(boxSerial);

      let boxLabels = [];
      if (boxSerials.length) {
        boxLabels = await base44.entities.BoxLabel.filter({ box_serial: boxSerials[0] }).catch(() => []);
      }

      result.packaging = {
        ...result.packaging,
        boxLinks,
        boxLabels,
        pallet: result.pallet,
      };
    } catch (e) { result.errors.push('Packaging: ' + e.message); }
  }

  return result;
}