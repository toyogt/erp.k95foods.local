import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, UserMinus, Loader2, AlertTriangle, Send } from 'lucide-react';
import { fireFMSEvent, triggerFMSProcess } from '@/lib/useFMSAutoComplete';

const ALLOWED_ROLES = ['admin', 'hr_manager', 'hr_supervisor'];
const EXIT_TYPES = ['Resignation', 'Termination', 'Absconded', 'Retirement', 'End of Contract', 'Other'];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(fromISO, toISO) {
  if (!fromISO || !toISO) return 0;
  const a = new Date(fromISO).getTime();
  const b = new Date(toISO).getTime();
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

function formatDateDDMMYYYY(iso) {
  if (!iso) return '—';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export default function HRTerminationForm() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    attrition_date: todayISO(),
    last_working_day: '',
    exit_type: '',
    attrition_reason: '',
    eligible_for_rehire: false,
    exit_feedback: '',
    send_exit_survey: true,
  });
  const [errors, setErrors] = useState({});
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const candidateId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  }, []);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const { data: candidate, isLoading } = useQuery({
    queryKey: ['candidate-lead', candidateId],
    queryFn: async () => {
      if (!candidateId) return null;
      const list = await base44.entities.CandidateLead.filter({ id: candidateId });
      return list?.[0] || null;
    },
    enabled: !!candidateId && !!user,
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.attrition_date) e.attrition_date = 'Attrition date is required';
    if (!form.exit_type) e.exit_type = 'Exit type is required';
    if (!form.attrition_reason?.trim()) e.attrition_reason = 'Attrition reason is required';
    if (candidate?.enrollment_date && form.attrition_date && form.attrition_date < candidate.enrollment_date) {
      e.attrition_date = 'Attrition date cannot be before enrollment date';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const terminateMutation = useMutation({
    mutationFn: async () => {
      if (!candidate) throw new Error('Candidate not found');
      const oldStatus = candidate.status || 'New';
      const now = new Date().toISOString();

      const payload = {
        status: 'Terminated',
        attrition_date: form.attrition_date,
        last_working_day: form.last_working_day || form.attrition_date,
        exit_type: form.exit_type,
        attrition_reason: form.attrition_reason.trim(),
        eligible_for_rehire: !!form.eligible_for_rehire,
        exit_feedback: form.exit_feedback?.trim() || '',
        days_employed: candidate.enrollment_date
          ? daysBetween(candidate.enrollment_date, form.attrition_date)
          : 0,
      };

      // 1. Update candidate
      const updated = await base44.entities.CandidateLead.update(candidate.id, payload);

      // 2. Log the status transition
      try {
        const lastLog = await base44.entities.CandidateLeadStatusLog.filter(
          { candidate_lead_id: candidate.id },
          '-changed_at',
          1
        );
        let durationMinutes;
        if (lastLog?.[0]?.changed_at) {
          const diffMs = new Date(now).getTime() - new Date(lastLog[0].changed_at).getTime();
          durationMinutes = Math.max(0, Math.round(diffMs / 60000));
        }
        await base44.entities.CandidateLeadStatusLog.create({
          candidate_lead_id: candidate.id,
          candidate_name: candidate.candidate_name,
          old_status: oldStatus,
          new_status: 'Terminated',
          changed_at: now,
          changed_by: user?.email || 'system',
          duration_in_previous_status_minutes: durationMinutes,
          remarks: `Terminated via Termination Form. Reason: ${form.attrition_reason.trim()}`,
        });
      } catch (logErr) {
        console.warn('[Termination] Status log failed:', logErr?.message);
      }

      // 3. Fire FMS events (best-effort)
      try {
        await triggerFMSProcess({
          triggerSource: 'employee_exit_initiated',
          triggerRefId: candidate.id,
          title: `Exit: ${candidate.candidate_name}`,
          triggerData: { exit_type: form.exit_type, attrition_date: form.attrition_date },
        });
        await fireFMSEvent('employee_exit_initiated', candidate.id);
      } catch (e) {
        console.warn('[Termination] FMS trigger failed:', e?.message);
      }

      // 4. Optionally send the exit interview survey
      if (form.send_exit_survey) {
        try {
          await base44.functions.invoke('sendExitInterviewSurvey', {
            candidate_lead_id: candidate.id,
            app_origin: window.location.origin,
          });
          await fireFMSEvent('exit_interview_sent', candidate.id);
        } catch (e) {
          console.warn('[Termination] Exit survey send failed:', e?.message);
        }
      }

      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-leads'] });
      queryClient.invalidateQueries({ queryKey: ['candidate-lead', candidateId] });
      queryClient.invalidateQueries({ queryKey: ['candidate-status-log', candidateId] });
      toast({
        title: 'Employee terminated',
        description: 'Termination recorded and exit workflow initiated.',
      });
      navigate('/HRCandidateLeads');
    },
    onError: (err) => {
      toast({ title: 'Termination failed', description: err.message, variant: 'destructive' });
    },
  });

  const handleSubmit = () => {
    if (!validate()) return;
    terminateMutation.mutate();
  };

  if (user && !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center text-slate-600">
            HR Manager / Supervisor access required to terminate an employee.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-slate-600 mb-3">Candidate not found.</div>
            <Button variant="outline" onClick={() => navigate('/HRCandidateLeads')} className="h-11 md:h-9">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Candidate Leads
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const alreadyTerminated = candidate.status === 'Terminated';
  const tenureDays = candidate.enrollment_date && form.attrition_date
    ? daysBetween(candidate.enrollment_date, form.attrition_date)
    : 0;

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/HRCandidateLeads')}
          className="h-11 md:h-9"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center">
            <UserMinus className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Termination Form</h1>
            <p className="text-xs md:text-sm text-slate-500">Record employee exit and initiate offboarding</p>
          </div>
        </div>
      </div>

      {/* Candidate summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Employee Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Info label="Name" value={candidate.candidate_name} />
            <Info label="Mobile" value={candidate.mobile_number} mono />
            <Info label="Employee Code" value={candidate.employee_code || '—'} mono />
            <Info label="Department" value={candidate.department || '—'} />
            <Info label="Designation" value={candidate.designation || '—'} />
            <Info label="Enrollment Date" value={formatDateDDMMYYYY(candidate.enrollment_date)} mono />
            <Info label="Current Status" value={
              <Badge className={alreadyTerminated ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                {candidate.status}
              </Badge>
            } />
            <Info label="Tenure (so far)" value={
              candidate.enrollment_date
                ? `${daysBetween(candidate.enrollment_date, todayISO())} days`
                : '—'
            } />
          </div>
        </CardContent>
      </Card>

      {alreadyTerminated && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            This employee is already marked as <strong>Terminated</strong>. Submitting will update the existing termination record.
          </div>
        </div>
      )}

      {/* Termination Form */}
      <Card className="border-red-200">
        <CardHeader className="pb-3 bg-red-50/50">
          <CardTitle className="text-base text-red-900">Termination Details</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Attrition Date *" error={errors.attrition_date}>
              <Input
                type="date"
                value={form.attrition_date}
                onChange={(e) => set('attrition_date', e.target.value)}
                className="h-11 md:h-9 text-base md:text-sm"
              />
              {tenureDays > 0 && (
                <p className="text-xs text-slate-500 mt-1">Final tenure: {tenureDays} days</p>
              )}
            </Field>

            <Field label="Last Working Day">
              <Input
                type="date"
                value={form.last_working_day}
                onChange={(e) => set('last_working_day', e.target.value)}
                className="h-11 md:h-9 text-base md:text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">Defaults to attrition date if blank</p>
            </Field>

            <Field label="Exit Type *" error={errors.exit_type}>
              <Select value={form.exit_type} onValueChange={(v) => set('exit_type', v)}>
                <SelectTrigger className="h-11 md:h-9 text-base md:text-sm">
                  <SelectValue placeholder="Select exit type" />
                </SelectTrigger>
                <SelectContent>
                  {EXIT_TYPES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Eligible for Rehire">
              <div className="flex items-center justify-between border border-slate-200 rounded-md px-3 h-11 md:h-9 bg-white">
                <span className="text-sm text-slate-700">
                  {form.eligible_for_rehire ? 'Yes' : 'No'}
                </span>
                <Switch
                  checked={!!form.eligible_for_rehire}
                  onCheckedChange={(v) => set('eligible_for_rehire', v)}
                />
              </div>
            </Field>
          </div>

          <Field label="Attrition Reason *" error={errors.attrition_reason}>
            <Input
              value={form.attrition_reason}
              onChange={(e) => set('attrition_reason', e.target.value)}
              placeholder="e.g. Better opportunity, Personal reasons, Absconded, Misconduct..."
              className="h-11 md:h-9 text-base md:text-sm"
            />
          </Field>

          <Field label="Exit Feedback / Interview Notes">
            <Textarea
              value={form.exit_feedback}
              onChange={(e) => set('exit_feedback', e.target.value)}
              placeholder="Any additional feedback, suggestions, or observations from the exit conversation..."
              rows={4}
              className="text-base md:text-sm"
            />
          </Field>

          <div className="flex items-center justify-between border border-slate-200 rounded-md px-3 py-2 bg-blue-50/50">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-600" />
              <div>
                <Label className="text-xs font-medium text-slate-700">Send Exit Interview Survey</Label>
                <p className="text-xs text-slate-500">Email a secure survey link to the employee</p>
              </div>
            </div>
            <Switch
              checked={!!form.send_exit_survey}
              onCheckedChange={(v) => set('send_exit_survey', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col md:flex-row md:justify-end gap-2 sticky bottom-0 bg-slate-50 py-3">
        <Button
          variant="outline"
          onClick={() => navigate('/HRCandidateLeads')}
          disabled={terminateMutation.isPending}
          className="h-11 md:h-9 w-full md:w-auto"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={terminateMutation.isPending}
          className="h-11 md:h-9 w-full md:w-auto bg-red-600 hover:bg-red-700 gap-2"
        >
          {terminateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          <UserMinus className="w-4 h-4" />
          Confirm Termination
        </Button>
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-slate-700">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Info({ label, value, mono }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-sm font-medium text-slate-900 ${mono ? 'font-mono' : ''}`}>
        {value}
      </div>
    </div>
  );
}