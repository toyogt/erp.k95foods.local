import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';

/**
 * BUILT-IN widget resolvers keyed by widget_key.
 * Each resolver receives (data) = pre-fetched data blob and returns { value, label, sub, list }
 */
const BUILT_IN_WIDGETS = {
  // Chamber operator
  chamber_waiting_crates:     d => ({ value: d.crates.filter(c => c.current_location === 'WIP-CHAMBER-WAIT').length,         label: 'Crates waiting for chamber' }),
  chamber_pallets_in:         d => ({ value: d.pallets.filter(p => p.status === 'IN_CHAMBER').length,                        label: 'Pallets in chamber'         }),
  chamber_post_nochamber:     d => ({ value: d.crates.filter(c => c.current_location === 'WIP-POST-CHAMBER').length,          label: 'Post-chamber putaway'       }),
  // Filling operator
  filling_crates_today:       d => ({ value: d.crates.filter(c => c.filler_machine_id && isToday(c.filled_time)).length,     label: 'Crates filled today'        }),
  filling_unpalletized:       d => ({ value: d.unpalletizedCount,                                                             label: 'Crates not palletized'      }),
  filling_active_batch:       d => ({ value: d.activeBatchId || '—',                                                          label: 'Active batch', sub: d.activeBatchProduct }),
  // Receiving
  receiving_pallets_transit:  d => ({ value: d.pallets.filter(p => p.status === 'IN_TRANSIT').length,                        label: 'Pallets in transit'         }),
  receiving_crates_putaway:   d => ({ value: d.crates.filter(c => c.status === 'RECEIVED').length,                           label: 'Crates awaiting putaway'    }),
  receiving_zone_line1:       d => ({ value: d.crates.filter(c => c.current_location === 'ZONE-LABEL-LINE-1').length,        label: 'Zone Line 1 crates'         }),
  receiving_zone_line2:       d => ({ value: d.crates.filter(c => c.current_location === 'ZONE-LABEL-LINE-2').length,        label: 'Zone Line 2 crates'         }),
  // Labelling
  labelling_active_wo:        d => ({ value: d.activeSessions[0]?.wo_id || '—',                                               label: 'Active WO',                  sub: d.activeSessions[0] ? `${d.activeSessions[0].bottles_counted} bottles` : '' }),
  labelling_hardstops_today:  d => ({ value: d.alertsToday.filter(a => a.severity === 'CRITICAL').length,                    label: 'Hard stops today'           }),
  labelling_zone_crates:      d => ({ value: d.crates.filter(c => ['ZONE-LABEL-LINE-1','ZONE-LABEL-LINE-2'].includes(c.current_location)).length, label: 'Crates in label zones' }),
  labelling_offline_queue:    d => ({ value: d.offlineQueue,                                                                  label: 'Offline queue pending'      }),
  // Stores
  stores_released_requests:   d => ({ value: d.materialRequests.filter(r => r.status === 'RELEASED').length,                 label: 'Released requests'          }),
  stores_pending_sync:        d => ({ value: d.offlineQueue,                                                                  label: 'Issues pending sync'        }),
  // Manager
  manager_total_crates:       d => ({ value: d.crates.filter(c => c.status !== 'STORED').length,                             label: 'Active crates'              }),
  manager_open_alerts:        d => ({ value: d.openAlerts.length,                                                             label: 'Open alerts',                sub: d.openAlerts.filter(a=>a.severity==='CRITICAL').length + ' critical' }),
  manager_active_batches:     d => ({ value: d.batches.filter(b => b.status === 'IN_PROGRESS').length,                       label: 'Active batches'             }),
  manager_pallets_transit:    d => ({ value: d.pallets.filter(p => p.status === 'IN_TRANSIT').length,                        label: 'Pallets in transit'         }),
};

function isToday(isoStr) {
  if (!isoStr) return false;
  const d = new Date(isoStr);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

export default function WidgetRenderer({ widgetKey, title, display_type, sharedData, loading: parentLoading }) {
  const resolver = BUILT_IN_WIDGETS[widgetKey];
  if (!resolver) return null;
  if (parentLoading || !sharedData) return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4 flex items-center justify-center h-20">
      <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
    </div>
  );
  const { value, label, sub } = resolver(sharedData);
  const isBig = display_type === 'BIG_NUMBER';
  return (
    <div className={`rounded-2xl bg-white border border-slate-200 p-4 ${isBig ? '' : ''}`}>
      <p className={`font-black ${isBig ? 'text-4xl' : 'text-2xl'} text-slate-900`}>{value}</p>
      <p className="text-xs font-semibold text-slate-500 mt-0.5 uppercase tracking-wide">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

/**
 * Fetch all shared dashboard data once per render cycle.
 */
export async function fetchSharedDashboardData(userId, machineId) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const [crates, pallets, batches, sessions, materialRequests, alertsToday, openAlerts, activeBatches] = await Promise.all([
    base44.entities.Crate.list('-created_date', 500).catch(() => []),
    base44.entities.Pallet.list('-created_date', 200).catch(() => []),
    base44.entities.Batch.list('-created_date', 50).catch(() => []),
    base44.entities.LineSession.list('-started_at', 10).catch(() => []),
    base44.entities.MaterialRequest.list('-created_date', 50).catch(() => []),
    base44.entities.AlertEvent.filter({ status: 'OPEN' }, '-created_at', 100).catch(() => []),
    base44.entities.AlertEvent.filter({ status: 'OPEN' }, '-created_at', 50).catch(() => []),
    machineId ? base44.entities.MachineActiveBatch.filter({ machine_id: machineId, status: 'ACTIVE' }).catch(() => []) : Promise.resolve([]),
  ]);
  const activeSessions = sessions.filter(s => ['RUNNING','SOFT_STOP','HARD_STOP','READY'].includes(s.state));
  const q = JSON.parse(localStorage.getItem('factory_offline_queue') || '[]');
  const ab = activeBatches[0];
  return {
    crates, pallets, batches, activeSessions, materialRequests,
    alertsToday: alertsToday.filter(a => a.created_at >= todayStart),
    openAlerts,
    offlineQueue: q.length,
    unpalletizedCount: ab ? (ab.created_crates || 0) - (ab.palletized_crates || 0) : 0,
    activeBatchId: ab?.batch_id,
    activeBatchProduct: ab?.product_code,
  };
}