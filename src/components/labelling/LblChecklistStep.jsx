/**
 * LblChecklistStep
 *
 * Operator fills the demo print checklist:
 *  - All yes/no questions must be answered "Yes"
 *  - One image per demo label printed (slots = demo_print_qty)
 *  - Each image is AI-analysed against the sent POD values immediately after upload
 *  - AI analysis is saved with the submission for supervisor review
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { logLabellingEvent } from '@/lib/labellingEventLogger';
import { toast } from '@/components/ui/use-toast';
import { Loader2, ClipboardCheck, Upload, X, CheckCircle2, XCircle, AlertTriangle, Sparkles } from 'lucide-react';

// Build a clear prompt for the AI to analyse the label image
function buildAIPrompt(podValues, productName, batchNo) {
  const podLines = Object.entries(podValues)
    .filter(([, v]) => v)
    .map(([k, v]) => `  ${k}: "${v}"`)
    .join('\n');

  return `You are a quality control inspector for a beverage labelling production line.

Analyse this image of a labelled bottle and assess the printed label quality.

Expected label data (what should be printed on the label):
${podLines || '  (No POD data available)'}

Product: ${productName || 'Unknown'}
Batch Number: ${batchNo || 'Unknown'}

Please assess:
1. Is the label clearly visible and readable?
2. Does the printed text match the expected values above? Check each field carefully.
3. Is the print quality acceptable (no smudging, misalignment, or fading)?
4. Are there any defects or concerns?

Respond with a concise assessment (3-5 sentences) that a production supervisor can quickly read to decide whether to approve or reject this demo print. Start with either "✅ PASS" or "❌ FAIL" followed by your reasoning. Mention any specific field mismatches by name.`;
}

export default function LblChecklistStep({ job, user, onComplete }) {
  const [answers, setAnswers]   = useState({});
  const [images, setImages]     = useState([]); // array of { file, preview, url, analysis, analysing }
  const [saving, setSaving]     = useState(false);
  const demoQty = job?.demo_print_qty || 1;

  // Load checklist template
  const { data: templates = [] } = useQuery({
    queryKey: ['lbl-checklist-templates-demo'],
    queryFn: () => base44.entities.LblChecklistTemplate.filter({ purpose: 'demo_print_approval', is_active: true }),
  });

  // Load ALL demo print commands for this job to find the DATA command with POD values
  const { data: demoCommands = [] } = useQuery({
    queryKey: ['demo-commands-job', job.id],
    queryFn: () => base44.entities.LblPrintCommand.filter({ job_id: job.id, command_type: 'demo' }),
    enabled: !!job.id,
  });

  const template = templates[0];
  const items    = template?.items_json || [];

  // DATA command carries the actual POD values in request_payload.command.data
  // STAR command carries template name — so prefer DATA command for POD values
  const dataCommand = demoCommands.find(c => c.request_payload?.command?.command === 'DATA')
    || demoCommands.find(c => c.request_payload?.command?.data)
    || demoCommands[0]
    || null;
  const sentPodValues = dataCommand?.request_payload?.command?.data || {};

  // Derived submit-readiness
  const filledSlots    = Array.from({ length: demoQty }).map((_, i) => images[i]).filter(img => img && img.url);
  const analysing      = images.some(img => img?.analysing);
  const allSlotsReady  = filledSlots.length >= demoQty && !analysing;
  // Block if any required yes_no is answered No
  const anyNoAnswer    = items.some(item => item.type === 'yes_no' && item.required && answers[item.question] === 'No');
  const canSubmit      = template && allSlotsReady && !anyNoAnswer && !saving;

  // Upload image then immediately run AI analysis
  const handleImageChange = async (e, slotIndex) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const preview = URL.createObjectURL(file);

    // Set slot to uploading+analysing state
    setImages(prev => {
      const updated = [...prev];
      updated[slotIndex] = { file, preview, url: null, analysis: null, analysing: true };
      return updated;
    });

    // Upload file
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    // Run AI analysis immediately
    let analysis = null;
    try {
      const prompt = buildAIPrompt(sentPodValues, job.product_name, job.batch_no);
      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: [file_url],
        model: 'gemini_3_flash',
      });
      analysis = typeof result === 'string' ? result : JSON.stringify(result);
    } catch (err) {
      analysis = '⚠ AI analysis could not be completed: ' + err.message;
    }

    setImages(prev => {
      const updated = [...prev];
      updated[slotIndex] = { file, preview, url: file_url, analysis, analysing: false };
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
    // Validate: all required questions answered
    for (const item of items) {
      if (item.required && !answers[item.question]) {
        toast({ title: 'Missing Answer', description: `"${item.question}" is required`, variant: 'destructive' });
        return;
      }
    }

    // Validate: all yes_no required questions must be "Yes"
    for (const item of items) {
      if (item.type === 'yes_no' && item.required && answers[item.question] === 'No') {
        toast({ title: 'All checks must pass', description: `"${item.question}" must be Yes to proceed`, variant: 'destructive' });
        return;
      }
    }

    // Validate: all image slots must be filled with uploaded (not just previewed) images
    const filledImages = Array.from({ length: demoQty }).map((_, i) => images[i]).filter(img => img && img.url);
    if (filledImages.length < demoQty) {
      toast({ title: 'All bottle images required', description: `Please upload all ${demoQty} demo bottle image(s) and wait for AI analysis to complete`, variant: 'destructive' });
      return;
    }

    // Check if any image is still being analysed
    if (images.some(img => img?.analysing)) {
      toast({ title: 'Please wait', description: 'AI analysis is still running — please wait a moment', variant: 'destructive' });
      return;
    }


    setSaving(true);

    const imageUrls = filledImages.map(img => img.url);
    const aiAnalysis  = filledImages.map((img, idx) => ({
      image_index: idx,
      image_url:   img.url,
      analysis:    img.analysis || '',
      pod_match:   img.analysis ? img.analysis.includes('✅') : null,
      issues:      [],
    }));

    const answersArray = items.map(item => ({
      question: item.question,
      answer:   answers[item.question] || '',
      type:     item.type,
    }));

    await base44.entities.LblChecklistSubmission.create({
      submission_id:      `CKS-${Date.now()}`,
      job_id:             job.id,
      template_id:        template?.id || '',
      template_name:      template?.name || 'Demo Print Checklist',
      answers_json:       answersArray,
      image_urls:         imageUrls,
      ai_analysis:        aiAnalysis,
      status:             'pending_approval',
      submitted_by_email: user?.email,
      submitted_by_name:  user?.full_name,
      submitted_at:       new Date().toISOString(),
    });

    await base44.entities.LabellingJob.update(job.id, {
      status:           'demo_pending_approval',
      demo_image_url:   imageUrls[0] || '',
      approval_status:  'pending',
    });

    await logLabellingEvent({
      action_type: 'checklist_submitted',
      job_id:      job.id,
      plan_id:     job.plan_id,
      description: `Checklist submitted with ${imageUrls.length} image(s) and AI analysis for job ${job.job_id}`,
      user,
    });

    toast({ title: 'Checklist Submitted', description: 'Waiting for supervisor approval' });
    onComplete?.();
    setSaving(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">

      {/* Header */}
      <div className="flex items-center gap-2">
        <ClipboardCheck className="w-5 h-5 text-violet-600" />
        <h2 className="text-base font-semibold text-slate-900">Fill Demo Print Checklist</h2>
      </div>

      {/* No template warning */}
      {!template && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          No checklist template configured. Contact admin to create one.
        </div>
      )}

      {/* Checklist Questions */}
      {template && items.length > 0 && (
        <div className="border border-slate-200 rounded-lg p-3 space-y-3">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Checklist Questions</p>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1">
            All required Yes/No questions must be answered <strong>Yes</strong> to submit.
          </p>
          {items.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">
                {item.question} {item.required && <span className="text-red-500">*</span>}
              </Label>
              {item.type === 'yes_no' && (
                <Select
                  value={answers[item.question] || ''}
                  onValueChange={v => setAnswers(a => ({ ...a, [item.question]: v }))}
                >
                  <SelectTrigger className="h-11 md:h-9">
                    <SelectValue placeholder="Select Yes or No" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {item.type === 'text' && (
                <Input value={answers[item.question] || ''} onChange={e => setAnswers(a => ({ ...a, [item.question]: e.target.value }))} className="h-11 md:h-9" />
              )}
              {item.type === 'number' && (
                <Input type="number" value={answers[item.question] || ''} onChange={e => setAnswers(a => ({ ...a, [item.question]: e.target.value }))} className="h-11 md:h-9" />
              )}
              {item.type === 'dropdown' && (
                <Select value={answers[item.question] || ''} onValueChange={v => setAnswers(a => ({ ...a, [item.question]: v }))}>
                  <SelectTrigger className="h-11 md:h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{(item.options || []).map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                </Select>
              )}
              {/* Show warning if No is selected on a required yes_no */}
              {item.type === 'yes_no' && item.required && answers[item.question] === 'No' && (
                <div className="flex items-center gap-1 text-xs text-red-600">
                  <AlertTriangle className="w-3 h-3" /> This must be Yes to proceed
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Image Upload Slots */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-slate-700">
            Demo Bottle Images <span className="text-red-500">*</span>
          </Label>
          <span className="text-xs text-slate-500">{demoQty} slot{demoQty > 1 ? 's' : ''} — one per label printed</span>
        </div>

        <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-100 rounded px-2 py-1.5 mb-1">
          <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0" />
          <p className="text-xs text-purple-700">
            Upload a clear image of the labelled bottle. AI will instantly compare the printed label against the expected POD values ({Object.keys(sentPodValues).length > 0 ? Object.keys(sentPodValues).join(', ') : 'sent during demo print'}).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: demoQty }).map((_, idx) => {
            const img = images[idx];
            const isPass = img?.analysis?.includes('✅');
            const isFail = img?.analysis?.includes('❌');

            return (
              <div key={idx} className="space-y-2">
                <p className="text-xs font-medium text-slate-600">Image {idx + 1} of {demoQty}</p>

                {/* Upload area */}
                <div className="border-2 border-dashed border-slate-300 rounded-lg overflow-hidden">
                  {img?.preview ? (
                    <div className="relative">
                      <img src={img.preview} alt={`Demo ${idx + 1}`} className="w-full object-contain max-h-64 bg-slate-50" />
                      {!img.analysing && (
                        <button onClick={() => removeImage(idx)} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow hover:bg-red-700">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-2 p-6">
                      <Upload className="w-8 h-8 text-slate-400" />
                      <span className="text-sm text-slate-500">Tap to upload image {idx + 1}</span>
                      <input type="file" accept="image/*" capture="environment" onChange={e => handleImageChange(e, idx)} className="hidden" />
                    </label>
                  )}
                </div>

                {/* AI Analysis result */}
                {img?.analysing && (
                  <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-700">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>AI is analysing label data…</span>
                  </div>
                )}

                {img?.analysis && !img.analysing && (
                  <div className={`rounded-lg border p-3 space-y-1 ${
                    isPass ? 'bg-green-50 border-green-200' :
                    isFail ? 'bg-red-50 border-red-200' :
                    'bg-amber-50 border-amber-200'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <Sparkles className={`w-3.5 h-3.5 shrink-0 ${isPass ? 'text-green-600' : isFail ? 'text-red-600' : 'text-amber-600'}`} />
                      <span className={`text-xs font-semibold uppercase tracking-wide ${isPass ? 'text-green-700' : isFail ? 'text-red-700' : 'text-amber-700'}`}>
                        AI Analysis
                      </span>
                      {isPass && <CheckCircle2 className="w-3.5 h-3.5 text-green-600 ml-auto" />}
                      {isFail && <XCircle className="w-3.5 h-3.5 text-red-600 ml-auto" />}
                    </div>
                    <p className={`text-xs leading-relaxed whitespace-pre-wrap ${isPass ? 'text-green-800' : isFail ? 'text-red-800' : 'text-amber-800'}`}>
                      {img.analysis}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Submit readiness summary */}
      <div className={`rounded-lg border px-3 py-2 flex items-center gap-2 text-xs font-medium ${
        canSubmit
          ? 'bg-green-50 border-green-200 text-green-700'
          : anyNoAnswer
            ? 'bg-red-50 border-red-200 text-red-700'
            : analysing
              ? 'bg-purple-50 border-purple-200 text-purple-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
      }`}>
        {canSubmit
          ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          : anyNoAnswer
            ? <XCircle className="w-4 h-4 text-red-600 shrink-0" />
            : analysing
              ? <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        }
        <span>
          {canSubmit
            ? `All ${demoQty} image${demoQty > 1 ? 's' : ''} uploaded and analysed — ready to submit`
            : anyNoAnswer
              ? 'All required checklist questions must be answered Yes before submitting'
              : analysing
                ? 'AI is analysing uploaded images — please wait…'
                : `${filledSlots.length} of ${demoQty} bottle image${demoQty > 1 ? 's' : ''} uploaded`
          }
        </span>
      </div>

      {/* Submit */}
      <Button
        className="h-11 w-full gap-2 bg-violet-600 hover:bg-violet-700"
        onClick={handleSubmit}
        disabled={!canSubmit}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
        Submit for Approval
      </Button>
    </div>
  );
}