export default function POCreateTermsTab({ form, setForm }) {
  function updateField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  return (
    <div className="space-y-4 p-4 md:p-5">
      <div>
        <label className="text-xs font-medium text-slate-700">Terms & Conditions</label>
        <textarea
          rows={6}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1 resize-none"
          value={form.terms_and_conditions || ''}
          onChange={e => updateField('terms_and_conditions', e.target.value)}
          placeholder="Enter terms and conditions for this Purchase Order..."
        />
        <p className="text-xs text-slate-400 mt-1">These terms will appear on the printed Purchase Order document.</p>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-700">Internal Notes</label>
        <textarea
          rows={3}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1 resize-none"
          value={form.internal_notes || ''}
          onChange={e => updateField('internal_notes', e.target.value)}
          placeholder="Internal notes (not shown on printed document)"
        />
      </div>
    </div>
  );
}