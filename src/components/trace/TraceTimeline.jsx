import { CheckCircle2, Circle, AlertTriangle, ChevronRight } from 'lucide-react';

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function Section({ title, icon, color, children }) {
  return (
    <div className="space-y-2 print:break-inside-avoid">
      <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${color}`}>
        <span className="text-lg">{icon}</span>
        <p className="font-bold text-sm tracking-wide">{title}</p>
      </div>
      <div className="pl-2 space-y-2">{children}</div>
    </div>
  );
}

function KV({ label, value, mono }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-slate-400 min-w-[120px] shrink-0">{label}</span>
      <span className={`text-slate-900 font-medium ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-4 space-y-2 ${className}`}>
      {children}
    </div>
  );
}

// ── FILLING ────────────────────────────────────────────────────
function FillingSection({ filling }) {
  if (!filling) return <Card><p className="text-slate-400 text-sm">No filling data found.</p></Card>;
  const { crate, crateLabels, batch } = filling;
  return (
    <Section title="FILLING" icon="🫙" color="bg-blue-50 text-blue-800">
      {crate ? (
        <Card>
          <p className="font-bold text-slate-800 text-sm">Crate: {crate.crate_id}</p>
          <KV label="Machine" value={crate.filler_machine_id || crate.current_location} />
          <KV label="Product" value={crate.product_code} mono />
          <KV label="Batch" value={crate.batch_id} mono />
          <KV label="Bottle Type" value={crate.bottle_type} />
          <KV label="Bottle Count" value={crate.bottle_count} />
          <KV label="Status" value={crate.status} />
          <KV label="Created" value={fmt(crate.created_date)} />
          <KV label="Created By" value={crate.created_by} />
        </Card>
      ) : <Card><p className="text-slate-400 text-sm">No crate record found.</p></Card>}
      {batch && (
        <Card>
          <p className="font-bold text-slate-700 text-sm">Batch: {batch.batch_id}</p>
          <KV label="Product" value={batch.product_code} mono />
          <KV label="MFG Date" value={batch.mfg_date} />
          <KV label="EXP Date" value={batch.exp_date} />
        </Card>
      )}
      {crateLabels?.map((l, i) => (
        <Card key={i}>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Crate Label Print</p>
          <KV label="Printed At" value={fmt(l.printed_at)} />
          <KV label="By" value={l.printed_by} />
          <KV label="Type" value={l.print_type} />
        </Card>
      ))}
    </Section>
  );
}

// ── CHAMBER ────────────────────────────────────────────────────
function ChamberSection({ chamber, pallet }) {
  if (!chamber?.length && !pallet) return (
    <Section title="CHAMBER" icon="🌡️" color="bg-orange-50 text-orange-800">
      <Card><p className="text-slate-400 text-sm">No chamber data found.</p></Card>
    </Section>
  );
  return (
    <Section title="CHAMBER" icon="🌡️" color="bg-orange-50 text-orange-800">
      {pallet && (
        <Card>
          <p className="font-bold text-slate-800 text-sm">Pallet: {pallet.pallet_id}</p>
          <KV label="Batch" value={pallet.batch_id} mono />
          <KV label="Status" value={pallet.status} />
          <KV label="Location" value={pallet.current_location} />
        </Card>
      )}
      {chamber.map(({ cycle, checks, downtimes }, i) => (
        <Card key={i}>
          <div className="flex items-start justify-between">
            <p className="font-bold text-slate-800 text-sm">Cycle: {cycle.cycle_id}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              cycle.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
              cycle.status === 'ABORTED'   ? 'bg-red-100 text-red-700' :
              'bg-blue-100 text-blue-700'
            }`}>{cycle.status}</span>
          </div>
          <KV label="Chamber" value={cycle.chamber_machine_id} />
          <KV label="Started" value={fmt(cycle.started_at)} />
          <KV label="Ended" value={fmt(cycle.ended_at)} />
          <KV label="Operator" value={cycle.started_by} />
          <KV label="Stage" value={cycle.current_stage} />
          {cycle.notes && <KV label="Notes" value={cycle.notes} />}
          {checks.length > 0 && (
            <div className="border-t border-slate-100 pt-2 mt-1">
              <p className="text-xs font-bold text-slate-500 mb-1">Checks ({checks.length})</p>
              {checks.map((ch, j) => {
                const late = ch.due_at && ch.completed_at
                  ? (new Date(ch.completed_at) - new Date(ch.due_at)) / 60000
                  : null;
                return (
                  <div key={j} className="flex justify-between text-xs text-slate-600 py-0.5 border-b border-slate-50 last:border-0">
                    <span>{ch.check_type}{ch.stage_name ? ` · ${ch.stage_name}` : ''}</span>
                    <div className="text-right">
                      {ch.completed_at
                        ? <span className={late > 5 ? 'text-amber-600 font-bold' : 'text-emerald-600'}>{late != null ? `${Math.round(late)}m late` : '✓'}</span>
                        : <span className="text-red-500 font-bold">MISSED</span>}
                      {ch.checklist_run_id && <span className="text-blue-500 ml-1">📋</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {downtimes.length > 0 && (
            <div className="border-t border-slate-100 pt-2 mt-1">
              <p className="text-xs font-bold text-slate-500 mb-1">Downtime Events</p>
              {downtimes.map((d, j) => (
                <div key={j} className="text-xs text-slate-600 py-0.5">
                  <span className="font-bold text-red-600">{d.duration_minutes?.toFixed(1)}m</span> · {d.reason_code || '—'} · {fmt(d.started_at)}
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </Section>
  );
}

// ── LABELLING ──────────────────────────────────────────────────
function LabellingSection({ labelling }) {
  if (!labelling) return (
    <Section title="LABELLING" icon="🏷️" color="bg-purple-50 text-purple-800">
      <Card><p className="text-slate-400 text-sm">No labelling data found.</p></Card>
    </Section>
  );
  const { traceWindows, feederScans, wo, lineSession, rolls, rework, ryanSnapshots } = labelling;
  return (
    <Section title="LABELLING" icon="🏷️" color="bg-purple-50 text-purple-800">
      {wo && (
        <Card>
          <p className="font-bold text-slate-800 text-sm">WO: {wo.wo_id}</p>
          <KV label="Product" value={wo.product} />
          <KV label="Line" value={wo.assigned_line} />
          <KV label="Status" value={wo.status} />
          <KV label="Target" value={wo.target_bottles ? `${wo.target_bottles} bottles` : null} />
        </Card>
      )}
      {lineSession && (
        <Card>
          <p className="text-xs font-bold text-slate-500">Line Session: {lineSession.session_id}</p>
          <KV label="Machine" value={lineSession.line_machine_id} />
          <KV label="Started" value={fmt(lineSession.started_at)} />
          <KV label="Ended" value={fmt(lineSession.ended_at)} />
          <KV label="State" value={lineSession.state} />
          <KV label="Bottles" value={lineSession.bottles_counted} />
        </Card>
      )}
      {traceWindows.length > 0 && (
        <Card>
          <p className="text-xs font-bold text-slate-500 mb-1">Crate Trace Windows ({traceWindows.length})</p>
          {traceWindows.map((t, i) => (
            <div key={i} className="text-xs flex justify-between py-0.5 border-b border-slate-50 last:border-0">
              <span className="font-mono">{t.crate_id}</span>
              <span className="text-slate-400">{fmt(t.scanned_at)}</span>
              {t.ryan_count_at_scan != null && <span className="text-blue-600">Ryan: {t.ryan_count_at_scan.toLocaleString()}</span>}
            </div>
          ))}
        </Card>
      )}
      {feederScans.length > 0 && (
        <Card>
          <p className="text-xs font-bold text-slate-500 mb-1">Feeder Scans ({feederScans.length})</p>
          {feederScans.map((s, i) => (
            <div key={i} className="text-xs flex justify-between py-0.5 border-b border-slate-50 last:border-0">
              <span className="font-mono">{s.line_machine_id}</span>
              <span className="text-slate-400">{fmt(s.scanned_at)}</span>
              {s.ryan_count_at_scan != null && <span className="text-blue-600">Ryan: {s.ryan_count_at_scan.toLocaleString()}</span>}
            </div>
          ))}
        </Card>
      )}
      {ryanSnapshots.length > 0 && (
        <Card>
          <p className="text-xs font-bold text-slate-500 mb-1">Ryan Count Snapshots</p>
          {ryanSnapshots.map((s, i) => (
            <div key={i} className="text-xs flex justify-between py-0.5 border-b border-slate-50 last:border-0">
              <span className="text-blue-600 font-bold">{s.ryan_count?.toLocaleString()}</span>
              <span className="text-slate-400">{s.bottles_per_hour ? `${Math.round(s.bottles_per_hour)} bph` : ''}</span>
              <span className="text-slate-400">{fmt(s.captured_at)}</span>
            </div>
          ))}
        </Card>
      )}
      {rolls.length > 0 && (
        <Card>
          <p className="text-xs font-bold text-slate-500 mb-1">Roll Events ({rolls.length})</p>
          {rolls.map((r, i) => (
            <div key={i} className="text-xs flex justify-between py-0.5 border-b border-slate-50 last:border-0">
              <span className="font-mono">{r.roll_id}</span>
              <span className={`font-bold ${r.event_type?.includes('WASTE') ? 'text-amber-600' : 'text-slate-600'}`}>{r.event_type}</span>
              <span className="text-slate-400">{r.qty_labels != null ? `${r.qty_labels} labels` : ''}</span>
              <span className="text-slate-400">{fmt(r.created_at)}</span>
            </div>
          ))}
        </Card>
      )}
      {rework.length > 0 && (
        <Card>
          <p className="text-xs font-bold text-red-500 mb-1">Rework Events ({rework.length})</p>
          {rework.map((r, i) => (
            <div key={i} className="text-xs flex justify-between py-0.5 border-b border-slate-50 last:border-0">
              <span className="font-bold text-red-600">{r.qty_bottles} btl</span>
              <span>{r.reason_code}</span>
              <span className="text-slate-400">{fmt(r.created_at)}</span>
            </div>
          ))}
        </Card>
      )}
      {!wo && !traceWindows.length && !feederScans.length && !ryanSnapshots.length && (
        <Card><p className="text-slate-400 text-sm">No labelling data found for this crate.</p></Card>
      )}
    </Section>
  );
}

// ── PACKAGING ──────────────────────────────────────────────────
function PackagingSection({ packaging }) {
  if (!packaging) return null;
  const { boxLinks, boxLabels, pallet, box } = packaging;
  if (!boxLinks?.length && !boxLabels?.length && !box) return (
    <Section title="PACKAGING / DISPATCH" icon="📦" color="bg-slate-100 text-slate-700">
      <Card><p className="text-slate-400 text-sm">No packaging data found.</p></Card>
    </Section>
  );
  return (
    <Section title="PACKAGING / DISPATCH" icon="📦" color="bg-slate-100 text-slate-700">
      {(box || boxLabels?.[0]) && (
        <Card>
          <p className="font-bold text-slate-800 text-sm">Box: {(box || boxLabels[0])?.box_serial}</p>
          <KV label="Product" value={(box || boxLabels[0])?.product_name} />
          <KV label="Batch" value={(box || boxLabels[0])?.batch_no} mono />
          <KV label="Status" value={(box || boxLabels[0])?.status} />
          <KV label="MFG" value={(box || boxLabels[0])?.mfg_date} />
          <KV label="EXP" value={(box || boxLabels[0])?.exp_date} />
          <KV label="Location" value={(box || boxLabels[0])?.current_location} />
        </Card>
      )}
      {boxLinks?.length > 0 && (
        <Card>
          <p className="text-xs font-bold text-slate-500 mb-1">Pallet Links ({boxLinks.length})</p>
          {boxLinks.map((l, i) => (
            <div key={i} className="text-xs flex justify-between py-0.5">
              <span className="font-mono">{l.box_serial}</span>
              <span className="text-slate-400">{fmt(l.scanned_at)}</span>
              <span className="text-slate-500">{l.scanned_by}</span>
            </div>
          ))}
        </Card>
      )}
    </Section>
  );
}

// ── MAIN EXPORT ────────────────────────────────────────────────
export default function TraceTimeline({ data }) {
  if (!data) return null;
  return (
    <div className="space-y-6" id="trace-timeline-content">
      <FillingSection filling={data.filling} />
      <ChamberSection chamber={data.chamber} pallet={data.pallet} />
      <LabellingSection labelling={data.labelling} />
      <PackagingSection packaging={data.packaging} />
      {data.errors?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
          <p className="text-xs font-bold text-amber-700">Lookup Warnings</p>
          {data.errors.map((e, i) => <p key={i} className="text-xs text-amber-600">{e}</p>)}
        </div>
      )}
    </div>
  );
}