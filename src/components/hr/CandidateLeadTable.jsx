import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Inbox, Pencil, Phone } from 'lucide-react';

const STATUS_COLOR = {
  New: 'bg-slate-100 text-slate-700',
  Contacted: 'bg-blue-100 text-blue-700',
  Shortlisted: 'bg-amber-100 text-amber-700',
  Interviewed: 'bg-violet-100 text-violet-700',
  Hired: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  'On Hold': 'bg-slate-100 text-slate-600',
};

function formatDateDDMMYYYY(iso) {
  if (!iso) return '—';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export default function CandidateLeadTable({ candidates, isLoading, onEdit }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!candidates?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <Inbox className="w-10 h-10 mb-2 text-slate-300" />
        <div className="text-sm">No candidate leads found</div>
        <div className="text-xs text-slate-400 mt-1">Click "New Candidate Lead" to add one</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Name</th>
            <th className="px-3 py-2 text-left font-medium">Mobile</th>
            <th className="px-3 py-2 text-left font-medium">Role Interested</th>
            <th className="px-3 py-2 text-left font-medium">Location</th>
            <th className="px-3 py-2 text-left font-medium">Source</th>
            <th className="px-3 py-2 text-left font-medium">Contact Mode</th>
            <th className="px-3 py-2 text-left font-medium">First Contact</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {candidates.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-medium text-slate-900">
                {c.candidate_name}
                {!c.is_active && <Badge className="ml-2 bg-slate-100 text-slate-500 text-xs">Inactive</Badge>}
              </td>
              <td className="px-3 py-2 font-mono text-slate-700">
                <a
                  href={`tel:${c.mobile_number}`}
                  className="inline-flex items-center gap-1 hover:text-blue-700"
                >
                  <Phone className="w-3 h-3" />
                  {c.mobile_number}
                </a>
              </td>
              <td className="px-3 py-2 text-slate-700">{c.role_interested || '—'}</td>
              <td className="px-3 py-2 text-slate-700">{c.location_area || '—'}</td>
              <td className="px-3 py-2 text-slate-700">
                <div className="text-slate-700">{c.source_type || '—'}</div>
                {c.source_details && (
                  <div className="text-xs text-slate-500 truncate max-w-[180px]" title={c.source_details}>
                    {c.source_details}
                  </div>
                )}
              </td>
              <td className="px-3 py-2 text-slate-700">{c.first_contact_mode || '—'}</td>
              <td className="px-3 py-2 font-mono text-slate-700">{formatDateDDMMYYYY(c.first_contact_date)}</td>
              <td className="px-3 py-2">
                <Badge className={STATUS_COLOR[c.status] || STATUS_COLOR.New}>
                  {c.status || 'New'}
                </Badge>
              </td>
              <td className="px-3 py-2 text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(c)}
                  className="h-8 gap-1"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}