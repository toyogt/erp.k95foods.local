import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { logLabellingEvent } from '@/lib/labellingEventLogger';
import { toast } from '@/components/ui/use-toast';
import { Loader2, ClipboardCheck, Upload, X } from 'lucide-react';

export default function LblChecklistStep({ job, user, onComplete }) {
  const [answers, setAnswers] = useState({});
  const [images, setImages] = useState([]); // array of { file, preview }
  const [saving, setSaving] = useState(false);
  const demoQty = job?.demo_print_qty || 1;

  const { data: templates = [] } = useQuery({
    queryKey: ['lbl-checklist-templates-demo'],
    queryFn: () => base44.entities.LblChecklistTemplate.filter({ purpose: 'demo_print_approval', is_active: true }),
  });

  const template = templates[0];
  const items = template?.items_json || [];

  const handleImageChange = (e, slotIndex) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setImages(prev => {
      const updated = [...prev];
      updated[slotIndex] = { file, preview };
      return updated;
    });
  };

  const removeImage = (slotIndex) => {
    setImages(prev => {
      const updated = [...prev];
      updated[slotIndex] = null;
      return updated;
    });
  };

  const handleSubmit = async () => {
    for (const item of items) {
      if (item.required && !answers[item.question]) { toast({ title: 'Missing Answer', description: `"${item.question}" is required`, variant: 'destructive' }); return; }
    }
    const uploadedImages = images.filter(Boolean);
    if (uploadedImages.length === 0) { toast({ title: 'Image Required', description: 'Upload at least one demo bottle image', variant: 'destructive' }); return; }
    setSaving(true);
    const imageUrls = [];
    for (const img of uploadedImages) {
      if (img?.file) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: img.file });
        imageUrls.push(file_url);
      }
    }
    const answersArray = items.map(item => ({ question: item.question, answer: answers[item.question] || '', type: item.type }));
    await base44.entities.LblChecklistSubmission.create({ submission_id: `CKS-${Date.now()}`, job_id: job.id, template_id: template?.id || '', template_name: template?.name || 'Demo Print Checklist', answers_json: answersArray, image_urls: imageUrls, status: 'pending_approval', submitted_by_email: user?.email, submitted_by_name: user?.full_name, submitted_at: new Date().toISOString() });
    await base44.entities.LabellingJob.update(job.id, { status: 'demo_pending_approval', demo_image_url: imageUrls[0] || '', approval_status: 'pending' });
    await logLabellingEvent({ action_type: 'checklist_submitted', job_id: job.id, plan_id: job.plan_id, description: `Checklist submitted with ${imageUrls.length} image(s) for job ${job.job_id}`, user });
    toast({ title: 'Checklist Submitted', description: 'Waiting for supervisor approval' });
    onComplete?.();
    setSaving(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-violet-600" /><h2 className="text-base font-semibold text-slate-900">Fill Demo Print Checklist</h2></div>
      {!template ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">No checklist template configured. Contact admin to create one.</div>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">{item.question} {item.required && <span className="text-red-500">*</span>}</Label>
              {item.type === 'yes_no' && (
                <Select value={answers[item.question] || ''} onValueChange={v => setAnswers(a => ({ ...a, [item.question]: v }))}><SelectTrigger className="h-11 md:h-9"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem></SelectContent></Select>
              )}
              {item.type === 'text' && <Input value={answers[item.question] || ''} onChange={e => setAnswers(a => ({ ...a, [item.question]: e.target.value }))} className="h-11 md:h-9" />}
              {item.type === 'number' && <Input type="number" value={answers[item.question] || ''} onChange={e => setAnswers(a => ({ ...a, [item.question]: e.target.value }))} className="h-11 md:h-9" />}
              {item.type === 'dropdown' && (
                <Select value={answers[item.question] || ''} onValueChange={v => setAnswers(a => ({ ...a, [item.question]: v }))}><SelectTrigger className="h-11 md:h-9"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{(item.options || []).map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-slate-700">Demo Bottle Images <span className="text-red-500">*</span></Label>
          <span className="text-xs text-slate-500">{demoQty} image slot{demoQty > 1 ? 's' : ''} (matches demo print quantity)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: demoQty }).map((_, idx) => {
            const img = images[idx];
            return (
              <div key={idx} className="space-y-1">
                <p className="text-xs font-medium text-slate-600">Image {idx + 1} of {demoQty}</p>
                <div className="border-2 border-dashed border-slate-300 rounded-lg overflow-hidden">
                  {img?.preview ? (
                    <div className="relative">
                      <img src={img.preview} alt={`Demo ${idx + 1}`} className="w-full object-contain max-h-64 bg-slate-50" />
                      <button onClick={() => removeImage(idx)} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow hover:bg-red-700">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-2 p-6">
                      <Upload className="w-8 h-8 text-slate-400" />
                      <span className="text-sm text-slate-500">Tap to upload image {idx + 1}</span>
                      <input type="file" accept="image/*" capture="environment" onChange={e => handleImageChange(e, idx)} className="hidden" />
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Button className="h-11 w-full md:w-auto gap-2 bg-violet-600 hover:bg-violet-700" onClick={handleSubmit} disabled={saving || !template}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}Submit for Approval</Button>
    </div>
  );
}