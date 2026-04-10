import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import LblJobCard from '@/components/labelling/LblJobCard';
import { Loader2, Tag } from 'lucide-react';
import moment from 'moment';

export default function LblOperatorQueue() {
  const [user, setUser] = useState(null);
  const [lineFilter, setLineFilter] = useState('all');
  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const today = moment().format('DD/MM/YYYY');
  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['labelling-jobs-today'], queryFn: () => base44.entities.LabellingJob.filter({ plan_date: today }), refetchInterval: 10000 });
  const { data: machines = [] } = useQuery({ queryKey: ['labelling-machines'], queryFn: () => base44.entities.Machine.filter({ machine_type: 'LABEL-LINE', is_active: true }) });

  const filtered = lineFilter === 'all' ? jobs : jobs.filter(j => j.line_id === lineFilter);
  const byLine = {};
  filtered.forEach(j => { const key = j.line_name || j.line_id || 'Unassigned'; if (!byLine[key]) byLine[key] = []; byLine[key].push(j); });
  Object.values(byLine).forEach(lj => lj.sort((a, b) => a.priority_order - b.priority_order));

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div><h1 className="text-xl md:text-2xl font-bold text-slate-900">Operator Queue</h1><p className="text-sm text-slate-500">Today's labelling jobs — {today}</p></div>
        <Select value={lineFilter} onValueChange={setLineFilter}><SelectTrigger className="h-11 md:h-9 w-full md:w-64"><SelectValue placeholder="Filter by line" /></SelectTrigger><SelectContent><SelectItem value="all">All Lines</SelectItem>{machines.map(m => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}</SelectContent></Select>
      </div>
      {Object.keys(byLine).length === 0 ? (
        <div className="text-center py-12 bg-white border border-slate-200 rounded-lg"><Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p className="text-slate-500">No jobs for today</p></div>
      ) : Object.entries(byLine).map(([lineName, lineJobs]) => {
        const firstPendingIdx = lineJobs.findIndex(j => j.status === 'pending');
        return (
          <div key={lineName} className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Tag className="w-4 h-4 text-pink-600" />{lineName}<span className="text-xs text-slate-400 font-normal">{lineJobs.filter(j => j.status === 'completed').length}/{lineJobs.length} completed</span></h2>
            {lineJobs.map((job, idx) => <LblJobCard key={job.id} job={job} isFirst={idx === firstPendingIdx} planLocked={true} />)}
          </div>
        );
      })}
    </div>
  );
}