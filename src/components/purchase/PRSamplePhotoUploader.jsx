import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Camera, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { logPurchaseAudit } from './purchaseHelpers';

export default function PRSamplePhotoUploader({ item, user, onUploaded }) {
  const [uploading, setUploading] = useState(false);

  const needsUpload = item.sample_photo_requested && !item.sample_photo_submitted;
  const alreadyDone = item.sample_photo_submitted;

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.PurchaseRequestItem.update(item.id, {
      sample_image: file_url,
      sample_photo_submitted: true,
      item_status: 'Pending',
    });
    await logPurchaseAudit({
      action: `Sample photo uploaded for item "${item.item_name}" in ${item.pr_number}`,
      action_type: 'update',
      entity_type: 'PurchaseRequestItem',
      entity_id: item.pr_number,
      user,
    });
    setUploading(false);
    if (onUploaded) onUploaded();
  }

  if (alreadyDone) {
    return (
      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
        <CheckCircle2 className="w-4 h-4 text-green-600" />
        <span className="text-sm text-green-700 font-medium">Sample photo submitted</span>
      </div>
    );
  }

  if (!needsUpload) return null;

  return (
    <div className="border-2 border-dashed border-purple-300 rounded-xl p-4 text-center bg-purple-50/50">
      <Camera className="w-6 h-6 text-purple-500 mx-auto mb-2" />
      <p className="text-sm text-purple-700 font-medium mb-1">Upload sample photo</p>
      {item.sample_photo_request_note && (
        <p className="text-xs text-purple-500 mb-2">Note: {item.sample_photo_request_note}</p>
      )}
      <label className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium cursor-pointer hover:bg-purple-700">
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {uploading ? 'Uploading...' : 'Choose Photo'}
        <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
      </label>
    </div>
  );
}