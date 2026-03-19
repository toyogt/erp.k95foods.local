/**
 * Pending Actions Aging Widget
 * Shows other pending items (GRN QC, dispatch, etc.)
 */

import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getSLAConfig, calculateAging, SLA_STATUSES } from '@/lib/slaEngine';
import SLAStatusBadge from './SLAStatusBadge';
import { AlertTriangle } from 'lucide-react';

const PENDING_WORKFLOWS = [
  { type: 'grn_qc_pending', entity: 'GRNHeader', filter: { status: 'QC_PENDING' }, label: 'GRN Pending Quality Control' },
  { type: 'dispatch_readiness', entity: 'Dispatch', filter: { status: 'READY_FOR_DISPATCH' }, label: 'Dispatch Readiness Check' },
  { type: 'transfer_receipt_pending', entity: 'WarehouseReceipt', filter: { status: 'PENDING' }, label: 'Transfer Receipt Pending' },
  { type: 'quality_hold', entity: 'Batch', filter: { status: 'QC_ON_HOLD' }, label: 'Quality Hold Pending Review' },
];

export default function PendingActionsAgeingWidget() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadPendingItems();
  }, []);

  const loadPendingItems = async () => {
    setLoading(true);
    try {
      let allItems = [];

      for (const workflow of PENDING_WORKFLOWS) {
        const slaConfig = await getSLAConfig(workflow.type);
        if (!slaConfig) continue;

        try {
          const docs = await base44.entities[workflow.entity].filter(
            workflow.filter,
            '-created_date',
            30
          );

          for (const doc of docs) {
            const aging = calculateAging(doc.created_date, slaConfig);
            allItems.push({
              id: doc.id,
              code: doc.code || doc.id,
              workflowType: workflow.type,
              workflowLabel: workflow.label,
              entity: workflow.entity,
              created: doc.created_date,
              ...aging,
            });
          }
        } catch (err) {
          console.error(`Error fetching ${workflow.entity}:`, err);
        }
      }

      setItems(allItems);
    } catch (error) {
      console.error('Error loading pending items:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter items
  const filtered = filter === 'all'
    ? items
    : items.filter(i => [SLA_STATUSES.CRITICALLY_OVERDUE, SLA_STATUSES.OVERDUE].includes(i.status));

  const criticalCount = items.filter(i => 
    [SLA_STATUSES.CRITICALLY_OVERDUE, SLA_STATUSES.OVERDUE].includes(i.status)
  ).length;

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 text-white p-4">
        <h3 className="font-bold text-lg">Pending Actions</h3>
        <p className="text-sm text-slate-300 mt-1">
          {criticalCount > 0 && <span className="text-orange-300 font-bold">{criticalCount} require attention</span>}
          {criticalCount === 0 && <span>All on schedule</span>}
        </p>
      </div>

      {loading ? (
        <div className="p-8 text-center">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <>
          {/* Filter buttons */}
          <div className="flex gap-2 p-4 border-b border-slate-200 bg-slate-50">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setFilter('urgent')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filter === 'urgent'
                  ? 'bg-red-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Critical ({criticalCount})
            </button>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <p>No pending items</p>
              </div>
            ) : (
              filtered.map(item => (
                <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <p className="font-bold text-slate-900">{item.code}</p>
                      <p className="text-xs text-slate-500">{item.workflowLabel}</p>
                    </div>
                    <SLAStatusBadge status={item.status} compact />
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex justify-between">
                      <span>SLA Target:</span>
                      <span className="font-medium">{item.slaTarget}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Elapsed:</span>
                      <span className="font-medium">{Math.round(item.hoursElapsed)}h ({Math.round(item.percentageUsed)}%)</span>
                    </div>
                    {item.hoursRemaining > 0 && (
                      <div className="flex justify-between text-amber-600">
                        <span>Time Remaining:</span>
                        <span className="font-medium">{Math.round(item.hoursRemaining)}h</span>
                      </div>
                    )}
                    {item.hoursRemaining <= 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Overdue:</span>
                        <span className="font-medium">{Math.round(Math.abs(item.hoursRemaining))}h</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}