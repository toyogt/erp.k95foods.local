import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { PLAN_STATUSES, SHIFT_TYPES } from '@/lib/labellingHelpers';
import LblPlanTable from '@/components/labelling/LblPlanTable';
import { Plus, Search, Calendar } from 'lucide-react';
import moment from 'moment';

export default function LblPlanningDashboard() {
  const [search, setSearch] = useState('');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState(moment().format('YYYY-MM-DD'));

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['labelling-plans'],
    queryFn: () => base44.entities.LabellingShiftPlan.list('-created_date', 200),
  });

  const filtered = plans.filter(p => {
    if (shiftFilter !== 'all' && p.shift_type !== shiftFilter) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (dateFilter) {
      const pd = moment(p.plan_date, 'DD/MM/YYYY').format('YYYY-MM-DD');
      if (pd !== dateFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!p.plan_id?.toLowerCase().includes(q) && !p.line_name?.toLowerCase().includes(q) && !p.supervisor_name?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const counts = { draft: 0, locked: 0, in_progress: 0, completed: 0 };
  filtered.forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++; });

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Labelling Planning</h1>
          <p className="text-sm text-slate-500">Create and manage shift plans for labelling lines</p>
        </div>
        <Link to="/LblPlanCreate">
          <Button className="h-11 md:h-9 gap-2 w-full md:w-auto"><Plus className="w-4 h-4" /> Create Plan</Button>
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(counts).map(([key, val]) => (
          <div key={key} className="bg-white border border-slate-200 rounded-lg p-3"><p className="text-xs text-slate-500">{PLAN_STATUSES[key]?.label}</p><p className="text-2xl font-bold text-slate-900">{val}</p></div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Search plans..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-11 md:h-9" /></div>
        <div className="relative"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" /><Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="pl-9 h-11 md:h-9" /></div>
        <Select value={shiftFilter} onValueChange={setShiftFilter}><SelectTrigger className="h-11 md:h-9"><SelectValue placeholder="Shift" /></SelectTrigger><SelectContent><SelectItem value="all">All Shifts</SelectItem>{SHIFT_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="h-11 md:h-9"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem>{Object.entries(PLAN_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select>
      </div>
      <LblPlanTable plans={filtered} isLoading={isLoading} />
    </div>
  );
}