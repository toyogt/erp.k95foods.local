import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Bell, Loader2, Save, X } from 'lucide-react';

const CONFIG_KEY = 'DEFAULT';

export default function HRNotificationSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [emailDraft, setEmailDraft] = useState('');
  const [form, setForm] = useState({
    hr_emails: [],
    alert_on_missing_out: true,
    alert_on_missing_in: true,
    alert_on_no_punches: false,
    alert_on_flagged: false,
    skip_holidays: true,
    skip_weekly_off: true,
    is_active: true,
  });

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const { data: configRows = [], isLoading } = useQuery({
    queryKey: ['hr-notification-config'],
    queryFn: () => base44.entities.HRNotificationConfig.filter({ config_key: CONFIG_KEY }, '-updated_date', 1),
  });
  const config = configRows[0] || null;

  useEffect(() => {
    if (config) {
      setForm({
        hr_emails: config.hr_emails || [],
        alert_on_missing_out: config.alert_on_missing_out !== false,
        alert_on_missing_in: config.alert_on_missing_in !== false,
        alert_on_no_punches: !!config.alert_on_no_punches,
        alert_on_flagged: !!config.alert_on_flagged,
        skip_holidays: config.skip_holidays !== false,
        skip_weekly_off: config.skip_weekly_off !== false,
        is_active: config.is_active !== false,
      });
    }
  }, [config?.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, config_key: CONFIG_KEY };
      if (config?.id) return base44.entities.HRNotificationConfig.update(config.id, payload);
      return base44.entities.HRNotificationConfig.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-notification-config'] });
      toast({ title: 'Saved', description: 'HR notification settings updated.' });
    },
    onError: (err) => toast({ title: 'Save failed', description: err.message, variant: 'destructive' }),
  });

  const addEmail = () => {
    const e = emailDraft.trim();
    if (!e) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      toast({ title: 'Invalid email', description: e, variant: 'destructive' });
      return;
    }
    if (form.hr_emails.map((x) => x.toLowerCase()).includes(e.toLowerCase())) {
      setEmailDraft('');
      return;
    }
    setForm((f) => ({ ...f, hr_emails: [...f.hr_emails, e] }));
    setEmailDraft('');
  };

  const removeEmail = (e) =>
    setForm((f) => ({ ...f, hr_emails: f.hr_emails.filter((x) => x !== e) }));

  if (user === null) return null;
  if (!['admin', 'hr_manager'].includes(user?.role)) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          Only admin / HR Manager can change notification settings.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-3 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
          <Bell className="w-5 h-5 text-amber-700" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">HR Notification Settings</h1>
          <p className="text-sm text-slate-600">Configure who is alerted when an employee has an attendance anomaly.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">HR Recipients</CardTitle>
          <p className="text-xs text-slate-500">These emails are CC'd on every attendance alert. Department head is the primary recipient.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="email"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              placeholder="hr@company.com"
              className="h-11 md:h-9 text-base md:text-sm flex-1"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
            />
            <Button onClick={addEmail} className="h-11 md:h-9">Add</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.hr_emails.map((e) => (
              <span key={e} className="inline-flex items-center gap-1 text-sm bg-slate-100 text-slate-700 rounded-full pl-3 pr-1 py-1">
                {e}
                <button onClick={() => removeEmail(e)} className="w-5 h-5 rounded-full hover:bg-slate-200 flex items-center justify-center">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {form.hr_emails.length === 0 && (
              <p className="text-xs text-slate-500">No HR recipients yet — alerts will only go to department heads.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alert Triggers</CardTitle>
          <p className="text-xs text-slate-500">Pick which attendance issues should trigger an email alert.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'alert_on_missing_out', label: 'Single punch — Missing OUT', helper: 'Employee punched IN but never OUT in 24 hours.' },
            { key: 'alert_on_missing_in', label: 'Single punch — Missing IN', helper: 'Employee punched OUT but never IN.' },
            { key: 'alert_on_flagged', label: 'Day flagged with unmatched punches', helper: 'Multiple unpaired punches on the same day.' },
            { key: 'alert_on_no_punches', label: 'No punches at all', helper: 'Active employee has zero punches on a working day.' },
            { key: 'skip_holidays', label: 'Skip alerts on holidays', helper: 'Recommended: do not alert if the date is a registered holiday.' },
            { key: 'skip_weekly_off', label: 'Skip alerts on weekly off', helper: 'Skip if the date matches the employee\'s weekly off day.' },
          ].map((row) => (
            <div key={row.key} className="flex items-center justify-between border border-slate-200 rounded-md px-3 py-2">
              <div>
                <Label className="text-sm text-slate-900">{row.label}</Label>
                <p className="text-xs text-slate-500">{row.helper}</p>
              </div>
              <Switch
                checked={!!form[row.key]}
                onCheckedChange={(v) => setForm((f) => ({ ...f, [row.key]: v }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || isLoading}
          className="h-11 md:h-9 gap-2"
        >
          {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          <Save className="w-4 h-4" />
          Save Settings
        </Button>
      </div>
    </div>
  );
}