import HistoryCard from './HistoryCard';

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
          ]}
        />
      ))}
    </div>
  );
}