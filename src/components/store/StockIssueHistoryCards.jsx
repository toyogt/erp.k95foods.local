import HistoryCard from './HistoryCard';

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
            { label: 'Issued By', value: i.issued_by || '—' },
            ...(i.notes ? [{ label: 'Notes', value: i.notes }] : []),
          ]}
        />
      ))}
    </div>
  );
}