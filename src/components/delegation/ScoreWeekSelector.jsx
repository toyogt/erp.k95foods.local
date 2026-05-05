import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import moment from 'moment';

export default function ScoreWeekSelector({ weekOffset, onWeekChange, personFilter, onPersonFilterChange, assignees, planFilter, onPlanFilterChange }) {
  const start = moment().startOf('isoWeek').add(weekOffset, 'weeks');
  const end = start.clone().endOf('isoWeek');
  const label = `${start.format('DD/MM/YYYY')} – ${end.format('DD/MM/YYYY')}`;
  const weekLabel = weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : weekOffset === 1 ? 'Next Week' : `Week ${start.isoWeek()}`;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Week navigator */}
      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onWeekChange(weekOffset - 1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="px-3 text-center min-w-[220px]">
          <p className="text-sm font-semibold text-slate-900">{weekLabel}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onWeekChange(weekOffset + 1)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Person filter */}
      <Select value={personFilter} onValueChange={onPersonFilterChange}>
        <SelectTrigger className="w-52 h-11 md:h-9">
          <SelectValue placeholder="All People" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All People</SelectItem>
          {assignees.map(a => (
            <SelectItem key={a.email} value={a.email}>{a.name || a.email}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Plan status filter */}
      <Select value={planFilter} onValueChange={onPlanFilterChange}>
        <SelectTrigger className="w-44 h-11 md:h-9">
          <SelectValue placeholder="All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="no_plan">No Meeting Plan</SelectItem>
          <SelectItem value="has_plan">Has Meeting Plan</SelectItem>
        </SelectContent>
      </Select>

      {/* Go to current week */}
      {weekOffset !== 0 && (
        <Button variant="outline" className="h-11 md:h-9 text-sm" onClick={() => onWeekChange(0)}>
          Go to Current Week
        </Button>
      )}
    </div>
  );
}