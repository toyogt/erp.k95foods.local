import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, AlertCircle, UserCheck, Calendar } from 'lucide-react';
import { fireFMSEvent, triggerFMSProcess } from '@/lib/useFMSAutoComplete';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDDMMYYYY(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Best-effort log of the status transition (mirrors HRCandidateLeads logic).
 */
async function logStatusChange({ candidate, oldStatus, newStatus, userEmail, remarks, effectiveDateISO }) {
  try {
    const changedAtISO = effectiveDateISO
      ? new Date(`${effectiveDateISO}T12:00:00`).toISOString()
      : new Date().toISOString();

    let durationMinutes;
    if (oldStatus) {
      const lastLog = await base44.entities.CandidateLeadStatusLog.filter(
        { candidate_lead_id: candidate.id }, '-changed_at', 1
      );
      const startISO = lastLog?.[0]?.changed_at || candidate.created_date;
      if (startISO) {
        const diffMs = new Date(changedAtISO).getTime() - new Date(startISO).getTime();
        durationMinutes = Math.max(0, Math.round(diffMs / 60000));
      }
    }
    await base44.entities.CandidateLeadStatusLog.create({
      candidate_lead_id: candidate.id,
      candidate_name: candidate.candidate_name,
      old_status: oldStatus || '',
      new_status: newStatus,
      changed_at: changedAtISO,
      changed_by: userEmail || 'system',
      duration_in_previous_status_minutes: durationMinutes,
      remarks: remarks || '',
    });
  } catch (err) {
    console.warn('[HR] Status log failed:', err?.message);
  }
}

/**
 * Quick employee creation from a Shortlisted candidate.
 * On success: creates Employee, links it to the CandidateLead, sets status to "Hired",
 * logs the transition, and fires the candidate_hired FMS event/process.
 */
export default function CreateEmployeeFromCandidateDialog({
  open,
  onOpenChange,
  candidate,
  user,
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [employeeCode, setEmployeeCode] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [branch, setBranch] = useState('');
  const [shiftName, setShiftName] = useState('');
  const [dateOfJoining, setDateOfJoining] = useState(todayISO());
  const [error, setError] = useState('');

  const { data: departments = [] } = useQuery({
    queryKey: ['departments-active'],
    queryFn: () => base44.entities.Department.filter({ is_active: true }, 'department_name', 500),
    enabled: open,
  });
  const { data: designations = [] } = useQuery({
    queryKey: ['designations-active'],
    queryFn: () => base44.entities.Designation.filter({ is_active: true }, 'designation_name', 500),
    enabled: open,
  });
  const { data: branches = [] } = useQuery({
    queryKey: ['branches-active'],
    queryFn: () => base44.entities.Branch.filter({ is_active: true }, 'branch_name', 500),
    enabled: open,
  });
  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts-active'],
    queryFn: () => base44.entities.ShiftTiming.filter({ is_active: true }, 'shift_name', 200),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setEmployeeCode('');
      setDepartment('');
      setDesignation('');
      setBranch('');
      setShiftName('');
      setDateOfJoining(candidate?.enrollment_date || todayISO());
      setError('');
    }
  }, [open, candidate?.id, candidate?.enrollment_date]);

  const mutation = useMutation({
    mutationFn: async () => {
      const code = employeeCode.trim();
      if (!code) throw new Error('Employee Code is required');
      if (!department) throw new Error('Department is required');
      if (!designation) throw new Error('Designation is required');
      if (!dateOfJoining) throw new Error('Date of Joining is required');
      if (dateOfJoining > todayISO()) throw new Error('Date of Joining cannot be in the future');

      // Duplicate check on employee_code (case-insensitive trim)
      const existing = await base44.entities.Employee.filter({ employee_code: code });
      if (existing?.length) {
        throw new Error(`Employee Code "${code}" already exists for "${existing[0].employee_name || existing[0].employee_code}"`);
      }

      // 1. Create Employee
      const newEmployee = await base44.entities.Employee.create({
        employee_code: code,
        employee_name: candidate.candidate_name,
        phone: candidate.mobile_number,
        department,
        designation,
        branch_name: branch || undefined,
        shift_name: shiftName || undefined,
        date_of_joining: formatDDMMYYYY(dateOfJoining), // Employee uses DD/MM/YYYY string
        is_active: true,
      });

      // 2. Update CandidateLead → Hired + link
      const before = { ...candidate };
      const updated = await base44.entities.CandidateLead.update(candidate.id, {
        status: 'Hired',
        employee_id: newEmployee.id,
        employee_code: newEmployee.employee_code,
        department,
        designation,
        enrollment_date: dateOfJoining,
      });

      // 3. Log status transition
      if (before.status !== 'Hired') {
        await logStatusChange({
          candidate: updated,
          oldStatus: before.status || '',
          newStatus: 'Hired',
          userEmail: user?.email,
          remarks: `Employee created (${code}) and hired from candidate lead`,
          effectiveDateISO: dateOfJoining,
        });
      }

      // 4. Fire HR onboarding FMS event + trigger onboarding process
      try {
        await triggerFMSProcess({
          triggerSource: 'candidate_hired',
          triggerRefId: updated.id,
          title: `Onboarding: ${updated.candidate_name}`,
          triggerData: { employee_code: code, department, designation },
        });
        await fireFMSEvent('candidate_hired', updated.id);
      } catch (e) {
        console.warn('[HR] FMS fire failed:', e?.message);
      }

      return { newEmployee, updated };
    },
    onSuccess: ({ newEmployee }) => {
      queryClient.invalidateQueries({ queryKey: ['candidate-leads'] });
      queryClient.invalidateQueries({ queryKey: ['employees-active'] });
      toast({
        title: 'Employee created & candidate hired',
        description: `${candidate.candidate_name} → ${newEmployee.employee_code}`,
      });
      onOpenChange(false);
    },
    onError: (err) => setError(err.message || 'Failed to create employee'),
  });

  if (!candidate) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-green-600" />
            Create Employee & Mark Hired
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Candidate snapshot (auto-filled into employee) */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
            <div className="text-xs text-slate-500">Candidate (auto-filled into employee)</div>
            <div className="font-semibold text-slate-900">{candidate.candidate_name}</div>
            <div className="text-xs text-slate-600 font-mono">{candidate.mobile_number}</div>
            {candidate.role_interested && (
              <div className="text-xs text-slate-500">Role of interest: {candidate.role_interested}</div>
            )}
          </div>

          {/* Employee Code */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">
              Employee Code <span className="text-red-600">*</span>
            </Label>
            <Input
              value={employeeCode}
              onChange={(e) => { setEmployeeCode(e.target.value); setError(''); }}
              placeholder="e.g. RT001"
              className="h-11 md:h-9 text-base md:text-sm font-mono"
            />
            <p className="text-xs text-slate-500">Unique code used by the biometric machine</p>
          </div>

          {/* Department + Designation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">
                Department <span className="text-red-600">*</span>
              </Label>
              <Select value={department} onValueChange={(v) => { setDepartment(v); setError(''); }}>
                <SelectTrigger className="h-11 md:h-9 text-base md:text-sm">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.department_name}>{d.department_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">
                Designation <span className="text-red-600">*</span>
              </Label>
              <Select value={designation} onValueChange={(v) => { setDesignation(v); setError(''); }}>
                <SelectTrigger className="h-11 md:h-9 text-base md:text-sm">
                  <SelectValue placeholder="Select designation" />
                </SelectTrigger>
                <SelectContent>
                  {designations.map((d) => (
                    <SelectItem key={d.id} value={d.designation_name}>{d.designation_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Branch + Shift */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Branch</Label>
              <Select value={branch || 'none'} onValueChange={(v) => setBranch(v === 'none' ? '' : v)}>
                <SelectTrigger className="h-11 md:h-9 text-base md:text-sm">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.branch_name}>{b.branch_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Shift</Label>
              <Select value={shiftName || 'none'} onValueChange={(v) => setShiftName(v === 'none' ? '' : v)}>
                <SelectTrigger className="h-11 md:h-9 text-base md:text-sm">
                  <SelectValue placeholder="Default shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Default —</SelectItem>
                  {shifts.map((s) => (
                    <SelectItem key={s.id} value={s.shift_name}>{s.shift_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date of Joining */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Date of Joining <span className="text-red-600">*</span>
            </Label>
            <Input
              type="date"
              value={dateOfJoining}
              max={todayISO()}
              onChange={(e) => { setDateOfJoining(e.target.value); setError(''); }}
              className="h-11 md:h-9 text-base md:text-sm"
            />
            <p className="text-xs text-slate-500">
              Used as enrollment date on the candidate lead. Display: {formatDDMMYYYY(dateOfJoining) || '—'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 md:h-9"
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            className="h-11 md:h-9 bg-green-600 hover:bg-green-700 text-white"
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Employee & Hire
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}