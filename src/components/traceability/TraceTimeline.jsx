/**
 * Trace Timeline Visualization
 * Visual representation of event sequence
 */

import { format } from 'date-fns';
import {
  Package, Droplets, CheckCircle2, XCircle, Truck, Tag, Boxes,
  Zap, AlertCircle, RotateCw, ArrowDownUp, Archive,
} from 'lucide-react';

const EVENT_ICONS = {
  RM_INWARD: Package,
  QC_RELEASE: CheckCircle2,
  QC_REJECT: XCircle,
  ISSUE_TO_BATCH: Droplets,
  BATCH_CREATION: Tag,
  MIXING_COMPLETE: Zap,
  FILLING_OUTPUT: Droplets,
  CRATE_CREATION: Package,
  CHAMBER_MOVEMENT: Truck,
  LABELLING_ISSUE: Tag,
  LABELLING_CONSUMPTION: Tag,
  REPACKING: Boxes,
  REWORK: RotateCw,
  PALLET_BUILD: Boxes,
  DISPATCH: Truck,
  STOCK_ADJUSTMENT: ArrowDownUp,
  RETURN: Archive,
};

const EVENT_COLORS = {
  RM_INWARD: 'bg-blue-100 border-blue-300',
  QC_RELEASE: 'bg-green-100 border-green-300',
  QC_REJECT: 'bg-red-100 border-red-300',
  ISSUE_TO_BATCH: 'bg-yellow-100 border-yellow-300',
  BATCH_CREATION: 'bg-purple-100 border-purple-300',
  MIXING_COMPLETE: 'bg-orange-100 border-orange-300',
  FILLING_OUTPUT: 'bg-cyan-100 border-cyan-300',
  CRATE_CREATION: 'bg-blue-100 border-blue-300',
  CHAMBER_MOVEMENT: 'bg-indigo-100 border-indigo-300',
  LABELLING_ISSUE: 'bg-pink-100 border-pink-300',
  LABELLING_CONSUMPTION: 'bg-pink-100 border-pink-300',
  REPACKING: 'bg-teal-100 border-teal-300',
  REWORK: 'bg-red-100 border-red-300',
  PALLET_BUILD: 'bg-emerald-100 border-emerald-300',
  DISPATCH: 'bg-purple-100 border-purple-300',
  STOCK_ADJUSTMENT: 'bg-slate-100 border-slate-300',
  RETURN: 'bg-slate-100 border-slate-300',
};

export default function TraceTimeline({ events, searchType }) {
  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <p>No events found for this {searchType}.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((event, index) => {
        const Icon = EVENT_ICONS[event.event_type] || Package;
        const colorClass = EVENT_COLORS[event.event_type] || 'bg-slate-100 border-slate-300';
        const isLast = index === events.length - 1;

        return (
          <div key={event.id} className="relative">
            {/* Timeline connector */}
            {!isLast && (
              <div className="absolute left-6 top-14 w-0.5 h-12 bg-slate-200"></div>
            )}

            {/* Event node */}
            <div className="flex gap-4 pb-4">
              {/* Icon circle */}
              <div className="flex flex-col items-center">
                <div className={`p-3 rounded-lg border-2 ${colorClass} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-slate-700" />
                </div>
              </div>

              {/* Event details */}
              <div className="flex-1 min-w-0 pt-1">
                <div className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        {formatEventType(event.event_type)}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {format(new Date(event.timestamp), 'MMM d, yyyy HH:mm:ss')}
                      </p>
                    </div>
                    {event.is_critical && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700">
                        <AlertCircle className="w-3 h-3" />
                        <span className="text-xs font-semibold">Critical</span>
                      </div>
                    )}
                  </div>

                  {/* Entity flow */}
                  <div className="text-sm text-slate-600 mb-3">
                    <p>
                      <span className="font-medium text-slate-900">{event.source_entity_type}</span>
                      {' → '}
                      <span className="font-medium text-slate-900">{event.target_entity_type}</span>
                    </p>
                    <p className="text-xs mt-1">
                      {event.source_entity_id} → {event.target_entity_id}
                    </p>
                  </div>

                  {/* Quantity */}
                  {event.quantity && (
                    <div className="mb-3 p-2 bg-slate-50 rounded border border-slate-200">
                      <p className="text-sm font-semibold text-slate-900">
                        {event.quantity} {event.unit}
                      </p>
                    </div>
                  )}

                  {/* Loss info */}
                  {event.yield_loss && event.yield_loss > 0 && (
                    <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded">
                      <p className="text-xs font-medium text-red-900">
                        Loss: {event.yield_loss} {event.unit}
                      </p>
                      {event.loss_reason && (
                        <p className="text-xs text-red-700 mt-1">{event.loss_reason}</p>
                      )}
                    </div>
                  )}

                  {/* Details grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs mb-3">
                    {event.batch_id && (
                      <div>
                        <p className="text-slate-500">Batch</p>
                        <p className="font-mono text-slate-900">{event.batch_id}</p>
                      </div>
                    )}
                    {event.lot_id && (
                      <div>
                        <p className="text-slate-500">Lot</p>
                        <p className="font-mono text-slate-900">{event.lot_id}</p>
                      </div>
                    )}
                    {event.sku && (
                      <div>
                        <p className="text-slate-500">Product Code</p>
                        <p className="font-mono text-slate-900">{event.sku}</p>
                      </div>
                    )}
                    {event.session_id && (
                      <div>
                        <p className="text-slate-500">Session</p>
                        <p className="font-mono text-slate-900">{event.session_id}</p>
                      </div>
                    )}
                    {event.module && (
                      <div>
                        <p className="text-slate-500">Module</p>
                        <p className="font-mono text-slate-900">{event.module}</p>
                      </div>
                    )}
                    {event.user_name && (
                      <div>
                        <p className="text-slate-500">User</p>
                        <p className="font-mono text-slate-900">{event.user_name}</p>
                      </div>
                    )}
                  </div>

                  {/* Remarks */}
                  {event.remarks && (
                    <div className="p-2 bg-slate-50 rounded border border-slate-200 text-xs">
                      <p className="text-slate-600">{event.remarks}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatEventType(type) {
  return type
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}