import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Clock, RefreshCw, Search } from 'lucide-react';
import AttendanceSummaryTable from '@/components/hr/AttendanceSummaryTable';
import AttendanceCalculatorPanel from '@/components/hr/AttendanceCalculatorPanel';

export default function HRAttendanceSummary() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateIso, setDateIso] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  });

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const { data: summaries = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['daily-attendance-summary', dateIso],
    queryFn: () => base44.entities.DailyAttendanceSummary.filter(
      { work_date_iso: dateIso },
      'employee_code',
      1000
    ),
    enabled: !!dateIso,
  });

  if (user && user.role !== 'admin') {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center text-slate-600">
            Admin access required to view attendance summaries.
          </CardContent>
        </Card>
      </div>
    );
  }

  const filtered = summaries.filter((s) => {
    const matchesSearch = !search ||
      s.employee_code?.toLowerCase().includes(search.toLowerCase()) ||
      s.employee_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const totalMinutes = filtered.reduce((sum, s) => sum + (s.total_work_minutes || 0), 0);
  const totalHoursLabel = `${Math.floor(totalMinutes / 60)}h ${String(Math.round(totalMinutes % 60)).padStart(2, '0')}m`;
  const flaggedCount = filtered.filter((s) => s.status === 'FLAGGED' || s.status === 'MISSING_OUT' || s.status === 'MISSING_IN').length;
  const cleanCount = filtered.filter((s) => s.status === 'CLEAN').length;

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Daily Attendance Summary</h1>
            <p className="text-xs md:text-sm text-slate-500">
              Total work hours per employee per day · {summaries.length} records
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-11 md:h-9 gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Calculator panel */}
      <AttendanceCalculatorPanel onCalculated={() => refetch()} />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Employees" value={filtered.length} />
        <StatCard label="Total Hours" value={totalHoursLabel} />
        <StatCard label="Clean" value={cleanCount} valueClass="text-green-700" />
        <StatCard label="Flagged" value={flaggedCount} valueClass="text-amber-700" />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Work Date</Label>
              <Input
                type="date"
                value={dateIso}
                onChange={(e) => setDateIso(e.target.value)}
                className="h-11 md:h-9 text-base md:text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Search Employee</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Code or name..."
                  className="h-11 md:h-9 pl-9 text-base md:text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Status</Label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-11 md:h-9 w-full border border-slate-200 rounded-md px-3 text-base md:text-sm bg-white"
              >
                <option value="">All</option>
                <option value="CLEAN">Clean</option>
                <option value="FLAGGED">Flagged</option>
                <option value="MISSING_OUT">Missing OUT</option>
                <option value="MISSING_IN">Missing IN</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => { setSearch(''); setStatusFilter(''); }}
                className="h-11 md:h-9 w-full"
                disabled={!search && !statusFilter}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Daily Summary {filtered.length !== summaries.length && `(${filtered.length} of ${summaries.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceSummaryTable summaries={filtered} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, valueClass = 'text-slate-900' }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl md:text-2xl font-bold mt-1 ${valueClass}`}>{value}</div>
    </div>
  );
}