import HistoryCard from './HistoryCard';
import { formatDateTime, formatDate } from '@/lib/dateFormatter';

function TransferExpandedDetails({ record }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Full Transfer Details</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
        <DetailItem label="Transfer ID" value={record.transfer_id} />
        <DetailItem label="Lot ID" value={record.lot_id} />
        <DetailItem label="Item Code" value={record.item_code} />
        <DetailItem label="Item Name" value={record.item_name} />
        <DetailItem label="From Location" value={record.from_location_code} />
        <DetailItem label="To Location" value={record.to_location_code} />
        <DetailItem label="Quantity" value={`${record.quantity} ${record.uom || ''}`} />
        <DetailItem label="Batch Number" value={record.batch_number} />
        <DetailItem label="Manufacture Date" value={record.mfg_date ? formatDate(record.mfg_date) : '—'} />
        <DetailItem label="Expiry Date" value={record.expiry_date ? formatDate(record.expiry_date) : '—'} />
        <DetailItem label="Status" value={record.status} />
        <DetailItem label="Reason" value={record.reason} />
        <DetailItem label="Transferred By" value={record.transferred_by} />
        <DetailItem label="Date & Time" value={formatDateTime(record.transferred_at || record.created_date)} />
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

export default function TransferHistoryCards({ transfers }) {
  if (!transfers || transfers.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">No transfer history yet.</p>;
  }

  return (
    <div className="space-y-3">
      {transfers.map(t => (
        <HistoryCard
          key={t.id}
          id={t.transfer_id || t.id}
          title={t.item_name || '—'}
          subtitle={`Lot: ${t.lot_id || '—'}`}
          status={t.status || 'Completed'}
          statusColor="green"
          date={t.transferred_at || t.created_date}
          from={t.from_location_code}
          to={t.to_location_code}
          details={[
            { label: 'Quantity', value: `${t.quantity} ${t.uom || ''}` },
            { label: 'Reason', value: t.reason || '—' },
            { label: 'By', value: t.transferred_by || '—' },
            ...(t.batch_number ? [{ label: 'Batch', value: t.batch_number }] : []),
            ...(t.mfg_date ? [{ label: 'Manufacture', value: formatDate(t.mfg_date) }] : []),
          ]}
          expandedContent={<TransferExpandedDetails record={t} />}
        />
      ))}
    </div>
  );
}