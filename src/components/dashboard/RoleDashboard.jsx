import { useState, useEffect } from 'react';
import WidgetRenderer, { fetchSharedDashboardData } from './WidgetRenderer';

// Default widget layout per role
const ROLE_WIDGET_LAYOUTS = {
  filling_operator:  ['filling_active_batch',   'filling_crates_today',    'filling_unpalletized'],
  chamber_operator:  ['chamber_waiting_crates',  'chamber_pallets_in',      'chamber_post_nochamber'],
  labelling_receiver:['receiving_pallets_transit','receiving_crates_putaway','receiving_zone_line1','receiving_zone_line2'],
  line_operator:     ['labelling_active_wo',     'labelling_zone_crates',   'labelling_offline_queue'],
  labelling_supervisor:['labelling_active_wo',   'labelling_hardstops_today','labelling_zone_crates','manager_open_alerts'],
  warehouse:         ['receiving_pallets_transit','manager_total_crates'],
  stores:            ['stores_released_requests', 'stores_pending_sync'],
  qa:                ['manager_active_batches',   'manager_total_crates'],
  production_manager:['manager_total_crates',    'manager_open_alerts',     'manager_active_batches','manager_pallets_transit','labelling_hardstops_today','filling_unpalletized'],
  admin:             ['manager_total_crates',    'manager_open_alerts',     'manager_active_batches','manager_pallets_transit'],
  user:              ['manager_total_crates',    'manager_open_alerts'],
};

// Display type per widget
const WIDGET_DISPLAY = {
  filling_active_batch: 'BIG_NUMBER',
  labelling_active_wo:  'BIG_NUMBER',
  manager_open_alerts:  'BIG_NUMBER',
};

export default function RoleDashboard({ user, userOverride, roleLayout }) {
  const [sharedData, setSharedData] = useState(null);
  const [loading, setLoading] = useState(true);

  const role = user?.role || 'admin';
  // determine layout: user override → role DB layout → hardcoded default
  const widgetKeys = userOverride?.layout_json?.length
    ? userOverride.layout_json
    : (roleLayout?.layout_json?.length ? roleLayout.layout_json : (ROLE_WIDGET_LAYOUTS[role] || ROLE_WIDGET_LAYOUTS.admin));

  useEffect(() => {
    if (!user) return;
    fetchSharedDashboardData(user.id, null)
      .then(data => setSharedData(data))
      .finally(() => setLoading(false));
  }, [user]);

  if (!widgetKeys || widgetKeys.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">My Dashboard</p>
      <div className="grid grid-cols-2 gap-3">
        {widgetKeys.map(key => (
          <WidgetRenderer
            key={key}
            widgetKey={key}
            display_type={WIDGET_DISPLAY[key] || 'SMALL_CARD'}
            sharedData={sharedData}
            loading={loading}
          />
        ))}
      </div>
    </div>
  );
}