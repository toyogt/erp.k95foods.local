/**
 * Approval Aging Widget
 * Shows pending approvals grouped by aging bucket
 */

import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getSLAConfig, calculateAging, SLA_STATUSES } from '@/lib/slaEngine';
import SLAStatusBadge from './SLAStatusBadge';
import { AlertCircle, Clock, CheckCircle, Zap } from 'lucide-react';

export default function ApprovalAgeingWidget() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBucket, setSelectedBucket] = useState(SLA_STATUSES.OVERDUE);

  useEffect(() => {
    loadApprovals();
  }, []);

  const loadApprovals = async () => {
    setLoading(true);
    try {
      // Get pending approvals across document types
      const rules = await base44.entities.DocumentApprovalRule.filter({}, null, 100);
      
      let allApprovals = [];

      // Group by document type
      const docTypes = [...new Set(rules.map(r => r.doc_type))];
      
      for (const docType of docTypes) {
        const slaConfig = await getSLAConfig('purchase_approval'); // Generalize later
        if (!slaConfig) continue;

        // Fetch pending documents for this type
        try {
          const pendingDocs = await base44.entities[docType].filter(
            { status: 'SUBMITTED' },
            '-created_date',
            50
          );

          for (const doc of pendingDocs) {
            const aging = calculateAging(doc.created_date, slaConfig);
            allApprovals.push({
              id: doc.id,
              code: doc.document_no || doc.code,
              type: docType,
              status: doc.status,
              created: doc.created_date,
              ...aging,
            });
          }
        } catch (err) {
          console.error(`Error fetching ${docType}:`, err);
        }
      }

      setApprovals(allApprovals);
    } catch (error) {
      console.error('Error loading approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group by bucket
  const byBucket = {
    [SLA_STATUSES.ON_TIME]: approvals.filter(a => a.status === SLA_STATUSES.ON_TIME),
    [SLA_STATUSES.DUE_SOON]: approvals.filter(a => a.status === SLA_STATUSES.DUE_SOON),
    [SLA_STATUSES.OVERDUE]: approvals.filter(a => a.status === SLA_STATUSES.OVERDUE),
    [SLA_STATUSES.CRITICALLY_OVERDUE]: approvals.filter(a => a.status === SLA_STATUSES.CRITICALLY_OVERDUE),
  };

  const bucketConfig = [
    { key: SLA_STATUSES.CRITICALLY_OVERDUE, label: 'Critically Overdue', icon: Zap, count: byBucket[SLA_STATUSES.CRITICALLY_OVERDUE].length },
    { key: SLA_STATUSES.OVERDUE, label: 'Overdue', icon: AlertCircle, count: byBucket[SLA_STATUSES.OVERDUE].length },
    { key: SLA_STATUSES.DUE_SOON, label: 'Due Soon', icon: Clock, count: byBucket[SLA_STATUSES.DUE_SOON].length },
    { key: SLA_STATUSES.ON_TIME, label: 'On Time', icon: CheckCircle, count: byBucket[SLA_STATUSES.ON_TIME].length },
  ];

  const selected = byBucket[selectedBucket];
  const totalCritical = byBucket[SLA_STATUSES.CRITICALLY_OVERDUE].length + byBucket[SLA_STATUSES.OVERDUE].length;

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 text-white p-4">
        <h3 className="font-bold text-lg">Pending Approvals</h3>
        <p className="text-sm text-slate-300 mt-1">
          {totalCritical > 0 && <span className="text-red-300 font-bold">{totalCritical} require attention</span>}
          {totalCritical === 0 && <span>All on schedule</span>}
        </p>
      </div>

      {loading ? (
        <div className="p-8 text-center">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <>
          {/* Bucket tabs */}
          <div className="flex gap-2 p-4 border-b border-slate-200 bg-slate-50 overflow-x-auto">
            {bucketConfig.map(bucket => {
              const Icon = bucket.icon;
              const isSelected = selectedBucket === bucket.key;
              return (
                <button
                  key={bucket.key}
                  onClick={() => setSelectedBucket(bucket.key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap font-medium text-sm transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {bucket.label}
                  <span className={`ml-1 px-2 py-0.5 rounded text-xs font-bold ${
                    isSelected ? 'bg-slate-700' : 'bg-slate-200'
                  }`}>
                    {bucket.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {selected.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <p>No items in this category</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {selected.map(item => (
                  <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900">{item.code}</p>
                        <p className="text-xs text-slate-500 mt-1">{item.type}</p>
                      </div>
                      <SLAStatusBadge status={item.status} hoursRemaining={item.hoursRemaining} compact />
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                      <span>SLA: {item.slaTarget}h</span>
                      <span>•</span>
                      <span>{Math.round(item.percentageUsed)}% used</span>
                      {item.hoursRemaining > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-amber-600 font-medium">{Math.round(item.hoursRemaining)}h left</span>
                        </>
                      )}
                      {item.hoursRemaining <= 0 && (
                        <>
                          <span>•</span>
                          <span className="text-red-600 font-medium">{Math.round(Math.abs(item.hoursRemaining))}h overdue</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}