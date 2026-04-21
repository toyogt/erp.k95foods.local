import { Input } from '@/components/ui/input';

export default function LabelArtworkFields({ form, setField }) {
  return (
    <div className="border border-blue-100 rounded-xl p-4 space-y-3 bg-blue-50/30">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Label Artwork Fields</p>

      {/* Artwork Version */}
      <div>
        <label className="text-xs font-medium text-slate-700">Artwork Version</label>
        <Input
          className="h-9 text-sm mt-1"
          value={form.sys_artwork_version || ''}
          onChange={e => setField('sys_artwork_version', e.target.value)}
          placeholder="e.g. v1.0"
        />
      </div>

      {/* Label Size */}
      <div>
        <label className="text-xs font-medium text-slate-700">Label Size</label>
        <Input
          className="h-9 text-sm mt-1"
          value={form.sys_label_size || ''}
          onChange={e => setField('sys_label_size', e.target.value)}
          placeholder="e.g. 90mm x 60mm"
        />
      </div>

      {/* Version Notes */}
      <div>
        <label className="text-xs font-medium text-slate-700">Version Notes</label>
        <textarea
          rows={2}
          className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1 resize-none"
          value={form.sys_version_notes || ''}
          onChange={e => setField('sys_version_notes', e.target.value)}
          placeholder="Notes about this artwork version"
        />
      </div>
    </div>
  );
}

export function validateLabelArtworkFields(_form) {
  // No mandatory extra fields beyond artwork_name (which is item_name)
  return null;
}