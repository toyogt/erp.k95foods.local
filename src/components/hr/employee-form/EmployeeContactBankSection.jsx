import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const FIELD_INPUT = 'h-11 md:h-9 text-base md:text-sm';
const LABEL_CLASS = 'text-xs font-medium text-slate-700';

/**
 * Contact and bank details section: phone, email, attachments and bank info.
 * Attachment fields are URL inputs (file upload integration can be added later).
 */
export default function EmployeeContactBankSection({ form, update }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-1">
        Contact & Bank Details
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className={LABEL_CLASS}>Phone Number</Label>
          <Input
            type="tel"
            value={form.phone || ''}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="e.g. +91 98765 43210"
            className={FIELD_INPUT}
          />
        </div>

        <div className="space-y-1">
          <Label className={LABEL_CLASS}>Email</Label>
          <Input
            type="email"
            value={form.email || ''}
            onChange={(e) => update('email', e.target.value)}
            placeholder="optional"
            className={FIELD_INPUT}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className={LABEL_CLASS}>Attachment 1 URL</Label>
          <Input
            value={form.attachment_1_url || ''}
            onChange={(e) => update('attachment_1_url', e.target.value)}
            placeholder="https://..."
            className={FIELD_INPUT}
          />
          <p className="text-xs text-slate-500">e.g. ID proof scan</p>
        </div>

        <div className="space-y-1">
          <Label className={LABEL_CLASS}>Attachment 2 URL</Label>
          <Input
            value={form.attachment_2_url || ''}
            onChange={(e) => update('attachment_2_url', e.target.value)}
            placeholder="https://..."
            className={FIELD_INPUT}
          />
          <p className="text-xs text-slate-500">e.g. Address proof scan</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className={LABEL_CLASS}>Bank Name</Label>
          <Input
            value={form.bank_name || ''}
            onChange={(e) => update('bank_name', e.target.value)}
            className={FIELD_INPUT}
          />
        </div>

        <div className="space-y-1">
          <Label className={LABEL_CLASS}>Bank Account Number</Label>
          <Input
            value={form.bank_account_number || ''}
            onChange={(e) => update('bank_account_number', e.target.value)}
            className={FIELD_INPUT}
          />
        </div>

        <div className="space-y-1">
          <Label className={LABEL_CLASS}>IFSC Code</Label>
          <Input
            value={form.bank_ifsc_code || ''}
            onChange={(e) => update('bank_ifsc_code', e.target.value)}
            className={FIELD_INPUT}
          />
        </div>
      </div>
    </div>
  );
}