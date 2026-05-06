import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, UserCheck, UserX } from 'lucide-react';

/**
 * Smart linker to associate a CandidateLead to an existing Employee.
 * Searches Employee master by code/name/phone and lets user pick one.
 */
export default function CandidateEmployeeLinker({
  employeeId,
  employeeCode,
  onLink,
  candidateMobile,
}) {
  const [search, setSearch] = useState('');
  const [showList, setShowList] = useState(false);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true }, 'employee_name', 500),
  });

  // Auto-suggest by mobile match if not yet linked
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      // Suggest by candidate's mobile number
      if (candidateMobile && !employeeId) {
        return employees.filter((e) => e.phone && e.phone.replace(/\D/g, '') === candidateMobile.replace(/\D/g, '')).slice(0, 5);
      }
      return employees.slice(0, 8);
    }
    return employees
      .filter(
        (e) =>
          e.employee_code?.toLowerCase().includes(q) ||
          e.employee_name?.toLowerCase().includes(q) ||
          e.phone?.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [search, employees, candidateMobile, employeeId]);

  const linkedEmployee = employees.find((e) => e.id === employeeId);

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-slate-700">Linked Employee *</Label>

      {linkedEmployee ? (
        <div className="flex items-center justify-between border border-green-200 bg-green-50 rounded-md px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <UserCheck className="w-4 h-4 text-green-600 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">
                {linkedEmployee.employee_name || '—'}{' '}
                <span className="font-mono text-xs text-slate-600">({linkedEmployee.employee_code})</span>
              </div>
              <div className="text-xs text-slate-500 truncate">
                {linkedEmployee.department || '—'} · {linkedEmployee.designation || '—'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onLink(null, null)}
            className="text-xs text-red-600 hover:text-red-700 font-medium px-2 h-8 rounded hover:bg-red-50 inline-flex items-center gap-1"
          >
            <UserX className="w-3.5 h-3.5" /> Unlink
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onFocus={() => setShowList(true)}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowList(true);
            }}
            placeholder="Search employee by code, name, or phone..."
            className="h-11 md:h-9 pl-9 text-base md:text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">Type to search active employees</p>

          {showList && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
              {isLoading ? (
                <div className="p-3 flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-3 text-sm text-slate-500">No employees found</div>
              ) : (
                filtered.map((e) => (
                  <button
                    type="button"
                    key={e.id}
                    onClick={() => {
                      onLink(e.id, e.employee_code);
                      setSearch('');
                      setShowList(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                  >
                    <div className="text-sm font-medium text-slate-900">
                      {e.employee_name || '—'}{' '}
                      <span className="font-mono text-xs text-slate-500">({e.employee_code})</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {e.department || '—'} · {e.phone || '—'}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {employeeCode && !linkedEmployee && (
        <p className="text-xs text-amber-600">
          Linked employee code: <span className="font-mono">{employeeCode}</span> (record not found in master)
        </p>
      )}
    </div>
  );
}