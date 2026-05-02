import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Clock, Search, Loader2 } from 'lucide-react';
import { formatIstDateTime } from '@/lib/istFormatter';

const APPROVER_ROLES = new Set(['admin', 'hr_manager', 'hr_supervisor', 'hr_user', 'supervisor']);

function todayIso() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function startOfMonthIso() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
}

function isoToDDMMYYYY(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtHours(hours) {
  if (!hours || hours <= 0) return '0h';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export default function HREmployeeDailyHours() {
  const [user, setUser] = useState(null);
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [fromIso, setFromIso] = useState(startOfMonthIso());
  const [toIso, setToIso] = useState(todayIso());

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-for-hours'],
    queryFn: () => base44.entities.Employee.list('employee_code', 1000),
  });

  const filteredEmps = useMemo(() => {
    if (!empSearch.trim()) return employees.slice(0, 20);
    const q = empSearch.toLowerCase();
    return employees.filter((e) =>
      e.employee_code?.toLowerCase().includes(q) ||
      e.employee_name?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [employees, empSearch]);

  const { data: summaries = [], isLoading } = useQuery({
    queryKey: ['emp-daily-hours', selectedEmp?.employee_code, fromIso, toIso],
    queryFn: () => base44.entities.DailyAttendanceSummary.filter(
      {
        employee_code: selectedEmp.employee_code,
        work_date_iso: { $gte: fromIso, $lte: toIso },
      },
      '-work_date_iso',
      500
    ),
    enabled: !!selectedEmp?.employee_code && !!fromIso && !!toIso,
  });

  if (user && !APPROVER_ROLES.has(user.role)) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-6 text-center text-slate-600">HR access required.</CardContent></Card>
      </div>
    );
  }

  // Aggregate stats
  const totalHours = summaries.reduce((s, x) => s + (x.total_work_hours || 0), 0);
  const totalDays = summaries.filter((x) => (x.total_work_hours || 0) > 0).length;
  const totalOvertimeMin = summaries.reduce((s, x) => s + (x.overtime_minutes || 0), 0);
  const lateDays = summaries.filter((x) => x.is_late_arrival).length;
  const avgHours = totalDays > 0 ? (totalHours / totalDays) : 0;

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
          <Clock className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Employee Daily Hours</h1>
          <p className="text-xs md:text-sm text-slate-500">
            View total work hours per day from IN/OUT punches for any employee
          </p>
        </div>
      </div>

      {/* Employee picker + date range */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select Employee & Date Range</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1 md:col-span-1">
              <Label className="text-xs font-medium text-slate-700">Search Employee</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  placeholder="Code or name..."
                  className="h-11 md:h-9 pl-9 text-base md:text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">From Date</Label>
              <Input type="date" value={fromIso} onChange={(e) => setFromIso(e.target.value)} className="h-11 md:h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">To Date</Label>
              <Input type="date" value={toIso} onChange={(e) => setToIso(e.target.value)} className="h-11 md:h-9" />
            </div>
          </div>

          {/* Employee list */}
          {!selectedEmp && (
            <div className="border border-slate-200 rounded-md max-h-48 overflow-y-auto">
              {filteredEmps.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-sm">No employees found</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredEmps.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setSelectedEmp(e)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                    >
                      <div className="font-medium text-slate-900">{e.employee_code}</div>
                      <div className="text-xs text-slate-500">{e.employee_name || '—'} · {e.department || ''}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedEmp && (
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
              <div>
                <div className="font-medium text-slate-900">{selectedEmp.employee_code} — {selectedEmp.employee_name}</div>
                <div className="text-xs text-slate-500">{selectedEmp.department} · {selectedEmp.shift_name || 'Default shift'}</div>
              </div>
              <Button variant="outline" onClick={() => setSelectedEmp(null)} className="h-9">Change</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      {selectedEmp && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total Hours" value={fmtHours(totalHours)} />
          <StatCard label="Days Worked" value={totalDays} />
          <StatCard label="Avg / Day" value={fmtHours(avgHours)} />
          <StatCard label="Overtime" value={fmtHours(totalOvertimeMin / 60)} valueClass="text-blue-700" />
          <StatCard label="Late Days" value={lateDays} valueClass={lateDays > 0 ? 'text-amber-700' : 'text-slate-900'} />
        </div>
      )}

      {/* Daily breakdown */}
      {selectedEmp && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Daily Breakdown ({summaries.length} days)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
            ) : summaries.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                No attendance records for this employee in the selected range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700">
                      <th className="text-left px-3 py-2 font-medium">Date</th>
                      <th className="text-left px-3 py-2 font-medium">First IN</th>
                      <th className="text-left px-3 py-2 font-medium">Last OUT</th>
                      <th className="text-right px-3 py-2 font-medium">Total Hours</th>
                      <th className="text-right px-3 py-2 font-medium">Punches</th>
                      <th className="text-right px-3 py-2 font-medium">Overtime</th>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summaries.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-900">{s.work_date || isoToDDMMYYYY(s.work_date_iso)}</td>
                        <td className="px-3 py-2 text-slate-700">{s.first_in ? formatIstDateTime(s.first_in).split(' ')[1] : '—'}</td>
                        <td className="px-3 py-2 text-slate-700">{s.last_out ? formatIstDateTime(s.last_out).split(' ')[1] : '—'}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">{fmtHours(s.total_work_hours)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{s.punch_count || 0}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{s.overtime_minutes ? fmtHours(s.overtime_minutes / 60) : '—'}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              s.status === 'CLEAN' ? 'bg-green-100 text-green-700' :
                              s.status === 'HOLIDAY' ? 'bg-purple-100 text-purple-700' :
                              s.status === 'HOLIDAY_WORKED' ? 'bg-blue-100 text-blue-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>{s.status}</span>
                            {s.is_late_arrival && <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700">Late</span>}
                            {s.is_early_departure && <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700">Early</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
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