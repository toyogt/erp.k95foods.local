import HistoryCard from './HistoryCard';

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
          ]}
        />
      ))}
    </div>
  );
}