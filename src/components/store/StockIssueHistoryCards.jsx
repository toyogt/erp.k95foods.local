import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import HistoryCard from './HistoryCard';
import { formatDateTime } from '@/lib/dateFormatter';

function IssueExpandedDetails({ issue }) {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.StoreIssueLine.filter({ issue_id: issue.issue_id })
      .then(data => { setLines(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [issue.issue_id]);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Issue Summary</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          <DetailItem label="Issue ID" value={issue.issue_id} />
          <DetailItem label="Type" value={issue.issue_type} />
          <DetailItem label="Reference" value={issue.reference_number} />
          <DetailItem label="Status" value={issue.status} />
          <DetailItem label="Total Items" value={issue.total_items} />
          <DetailItem label="Issued By" value={issue.issued_by} />
          <DetailItem label="Date & Time" value={formatDateTime(issue.issued_at || issue.created_date)} />
          {issue.notes && <DetailItem label="Notes" value={issue.notes} />}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Issue Lines ({lines.length})</p>
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
        ) : lines.length === 0 ? (
          <p className="text-xs text-slate-400">No line items found</p>
        ) : (
          <div className="space-y-1.5">
            {lines.map((ln, idx) => (
              <div key={ln.id || idx} className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                <p className="text-sm font-medium text-slate-900">{ln.item_name || ln.item_code}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
                  <span>Lot: <strong className="text-slate-700">{ln.lot_id || '—'}</strong></span>
                  <span>Location: <strong className="text-slate-700">{ln.location_code || '—'}</strong></span>
                  {ln.batch_number && <span>Batch: <strong className="text-slate-700">{ln.batch_number}</strong></span>}
                  {ln.manufacturing_date && <span>Manufacturing: <strong className="text-slate-700">{ln.manufacturing_date}</strong></span>}
                  {ln.expiry_date && <span>Expiry: <strong className="text-slate-700">{ln.expiry_date}</strong></span>}
                  {ln.supplier_name && <span>Supplier: <strong className="text-slate-700">{ln.supplier_name}</strong></span>}
                  <span>Issued: <strong className="text-slate-700">{ln.issued_quantity}</strong></span>
                  <span>Unit: <strong className="text-slate-700">{ln.uom || 'Nos'}</strong></span>
                  {ln.picking_strategy && <span>Strategy: <strong className="text-slate-700">{ln.picking_strategy}</strong></span>}
                  {ln.issued_at && <span>At: <strong className="text-slate-700">{formatDateTime(ln.issued_at)}</strong></span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="font-medium text-slate-800 mt-0.5">{value || '—'}</p>
    </div>
  );
}

export default function StockIssueHistoryCards({ issues }) {
  if (!issues || issues.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">No issue history yet.</p>;
  }

  return (
    <div className="space-y-3">
      {issues.map(i => (
        <HistoryCard
          key={i.id}
          id={i.issue_id || i.id}
          title={i.issue_type ? `${i.issue_type.charAt(0).toUpperCase() + i.issue_type.slice(1)} Issue` : 'Stock Issue'}
          subtitle={i.reference_number ? `Reference: ${i.reference_number}` : undefined}
          status={i.status || 'Confirmed'}
          statusColor={i.status === 'confirmed' ? 'green' : 'amber'}
          date={i.issued_at || i.created_date}
          details={[
            { label: 'Items', value: i.total_items || 0 },
            { label: 'Strategy', value: i.picking_strategy || 'Manual' },
            { label: 'Issued By', value: i.issued_by || '—' },
            ...(i.notes ? [{ label: 'Notes', value: i.notes }] : []),
          ]}
          expandedContent={<IssueExpandedDetails issue={i} />}
        />
      ))}
    </div>
  );
}