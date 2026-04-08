import HistoryCard from './HistoryCard';
import { formatDateTime, formatDate } from '@/lib/dateFormatter';

function PutawayExpandedDetails({ record }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Full Putaway Details</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
        <DetailItem label="Putaway ID" value={record.putaway_id} />
        <DetailItem label="Lot ID" value={record.lot_id} />
        <DetailItem label="Item Code" value={record.item_code} />
        <DetailItem label="Item Name" value={record.item_name} />
        <DetailItem label="Location" value={record.location_code} />
        <DetailItem label="Quantity" value={`${record.quantity} ${record.uom || ''}`} />
        <DetailItem label="Batch Number" value={record.batch_number} />
        <DetailItem label="Manufacture Date" value={record.mfg_date ? formatDate(record.mfg_date) : '—'} />
        <DetailItem label="Expiry Date" value={record.expiry_date ? formatDate(record.expiry_date) : '—'} />
        <DetailItem label="Performed By" value={record.putaway_by} />
        <DetailItem label="Date & Time" value={formatDateTime(record.putaway_at || record.created_date)} />
        {record.notes && <DetailItem label="Notes" value={record.notes} span />}
      </div>
    </div>
  );
}

function DetailItem({ label, value, span }) {
  return (
    <div className={span ? 'col-span-full' : ''}>
      <p className="text-slate-500">{label}</p>
      <p className="font-medium text-slate-800 mt-0.5">{value || '—'}</p>
    </div>
  );
}

export default function PutawayHistoryCards({ history }) {
  if (!history || history.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">No putaway history yet.</p>;
  }

  return (
    <div className="space-y-3">
      {history.map(p => (
        <HistoryCard
          key={p.id}
          id={p.putaway_id || p.id}
          title={p.item_name || '—'}
          subtitle={`Lot: ${p.lot_id || '—'}`}
          status="Completed"
          statusColor="green"
          date={p.putaway_at || p.created_date}
          details={[
            { label: 'Location', value: p.location_code || '—' },
            { label: 'Quantity', value: `${p.quantity} ${p.uom || ''}` },
            { label: 'Done By', value: p.putaway_by || '—' },
            ...(p.batch_number ? [{ label: 'Batch Number', value: p.batch_number }] : []),
            ...(p.mfg_date ? [{ label: 'Manufacture Date', value: formatDate(p.mfg_date) }] : []),
            ...(p.expiry_date ? [{ label: 'Expiry Date', value: formatDate(p.expiry_date) }] : []),
          ]}
          expandedContent={<PutawayExpandedDetails record={p} />}
        />
      ))}
    </div>
  );
}