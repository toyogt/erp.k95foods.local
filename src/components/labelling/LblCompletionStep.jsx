import { CheckCircle2 } from 'lucide-react';
import moment from 'moment';

export default function LblCompletionStep({ job }) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2"><CheckCircle2 className="w-6 h-6 text-green-600" /><h2 className="text-lg font-semibold text-green-800">Job Completed</h2></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg p-3 text-center"><p className="text-xs text-slate-500">Planned</p><p className="text-lg font-bold text-slate-900">{job.quantity_bottles_planned?.toLocaleString()}</p></div>
        <div className="bg-white rounded-lg p-3 text-center"><p className="text-xs text-green-600">Accepted</p><p className="text-lg font-bold text-green-700">{job.accepted_qty?.toLocaleString() || 0}</p></div>
        <div className="bg-white rounded-lg p-3 text-center"><p className="text-xs text-red-600">Rejected</p><p className="text-lg font-bold text-red-700">{job.rejected_qty?.toLocaleString() || 0}</p></div>
        <div className="bg-white rounded-lg p-3 text-center"><p className="text-xs text-amber-600">Wastage</p><p className="text-lg font-bold text-amber-700">{job.wastage_qty?.toLocaleString() || 0}</p></div>
      </div>
      {job.completion_remarks && <div className="bg-white rounded-lg p-3 text-sm text-slate-600">{job.completion_remarks}</div>}
      <div className="text-xs text-slate-500 space-y-0.5">
        {job.started_at && <p>Started: {moment(job.started_at).format('DD/MM/YYYY HH:mm')}</p>}
        {job.completed_at && <p>Completed: {moment(job.completed_at).format('DD/MM/YYYY HH:mm')}</p>}
        {job.completed_by && <p>By: {job.completed_by}</p>}
      </div>
    </div>
  );
}