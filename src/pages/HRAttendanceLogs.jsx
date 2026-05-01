import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Fingerprint, RefreshCw, Search } from 'lucide-react';
import AttendanceLogTable from '@/components/hr/AttendanceLogTable';
import AttendanceApiTester from '@/components/hr/AttendanceApiTester';
import EmployeeCSVImport from '@/components/hr/EmployeeCSVImport';
import AttendanceOutboxStatus from '@/components/hr/AttendanceOutboxStatus';

export default function HRAttendanceLogs() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['attendance-logs'],
    queryFn: () => base44.entities.AttendanceLog.list('-log_datetime', 200),
    refetchInterval: 15000,
  });

  if (user && user.role !== 'admin') {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center text-slate-600">
            Admin access required to view attendance logs.
          </CardContent>
        </Card>
      </div>
    );
  }

  const filtered = logs.filter((log) => {
    const matchesSearch = !search ||
      log.employee_code?.toLowerCase().includes(search.toLowerCase()) ||
      log.employee_name?.toLowerCase().includes(search.toLowerCase());
    const matchesDate = !dateFilter || log.log_date === dateFilter;
    return matchesSearch && matchesDate;
  });

  // Convert YYYY-MM-DD picker value → DD/MM/YYYY (entity stores DD/MM/YYYY)
  const handleDateChange = (e) => {
    const v = e.target.value; // YYYY-MM-DD from input[type=date]
    if (!v) return setDateFilter('');
    const [yyyy, mm, dd] = v.split('-');
    setDateFilter(`${dd}/${mm}/${yyyy}`);
  };

  // Convert stored DD/MM/YYYY back to YYYY-MM-DD for the date input
  const dateInputValue = dateFilter
    ? `${dateFilter.split('/')[2]}-${dateFilter.split('/')[1]}-${dateFilter.split('/')[0]}`
    : '';

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
            <Fingerprint className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">HR Attendance Logs</h1>
            <p className="text-xs md:text-sm text-slate-500">
              Live punches from biometric devices · {logs.length} records (showing latest 200)
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

      {/* Outbound delivery queue */}
      <AttendanceOutboxStatus onWorkerRun={() => refetch()} />

      {/* Employee master importer */}
      <EmployeeCSVImport onSuccess={() => refetch()} />

      {/* API tester */}
      <AttendanceApiTester onSuccess={() => refetch()} />

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
              <Label className="text-xs font-medium text-slate-700">Date</Label>
              <Input
                type="date"
                value={dateInputValue}
                onChange={handleDateChange}
                className="h-11 md:h-9 text-base md:text-sm"
              />
              {dateFilter && <p className="text-xs text-slate-500">Showing: {dateFilter}</p>}
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => { setSearch(''); setDateFilter(''); }}
                className="h-11 md:h-9 w-full"
                disabled={!search && !dateFilter}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Attendance Records {filtered.length !== logs.length && `(${filtered.length} of ${logs.length})`}
          </CardTitle>
          <span className="text-xs text-slate-400">Auto-refreshes every 15s</span>
        </CardHeader>
        <CardContent>
          <AttendanceLogTable logs={filtered} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}