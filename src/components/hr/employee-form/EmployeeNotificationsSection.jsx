import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const FIELD_INPUT = 'h-11 md:h-9 text-base md:text-sm';
const LABEL_CLASS = 'text-xs font-medium text-slate-700';

const MOBILE_ATTENDANCE_MODES = ['Disabled', 'GPS Attendance', 'GPS + Photo', 'Web Punch'];

/**
 * Notifications & mobile attendance section: Telegram, allow notifications,
 * mobile attendance mode and auto-approve GPS punch toggle.
 */
export default function EmployeeNotificationsSection({ form, update }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-1">
        Notifications & Mobile Attendance
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className={LABEL_CLASS}>Telegram Token</Label>
          <Input
            value={form.telegram_token || ''}
            onChange={(e) => update('telegram_token', e.target.value)}
            className={FIELD_INPUT}
          />
        </div>

        <div className="space-y-1">
          <Label className={LABEL_CLASS}>Telegram Chat ID</Label>
          <Input
            value={form.chat_id || ''}
            onChange={(e) => update('chat_id', e.target.value)}
            className={FIELD_INPUT}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className={LABEL_CLASS}>Mobile Attendance Mode</Label>
        <Select
          value={form.mobile_attendance_mode || 'unset'}
          onValueChange={(v) => update('mobile_attendance_mode', v === 'unset' ? '' : v)}
        >
          <SelectTrigger className={FIELD_INPUT}>
            <SelectValue placeholder="Select mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unset">— Not set —</SelectItem>
            {MOBILE_ATTENDANCE_MODES.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.allow_notifications !== false}
            onChange={(e) => update('allow_notifications', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm text-slate-700">Allow Notifications</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!form.auto_approved_gps_punch}
            onChange={(e) => update('auto_approved_gps_punch', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm text-slate-700">Auto-Approve GPS Punches</span>
        </label>
      </div>
    </div>
  );
}