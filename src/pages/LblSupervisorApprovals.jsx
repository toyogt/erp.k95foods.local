import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { logLabellingEvent } from '@/lib/labellingEventLogger';
import { toast } from '@/components/ui/use-toast';
import { Loader2, CheckCircle2, XCircle, ClipboardCheck } from 'lucide-react';
import moment from 'moment';

export default function LblSupervisorApprovals() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [acting, setActing] = useState(false);
  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: submissions = [], isLoading } = useQuery({ queryKey: ['lbl-pending-approvals'], queryFn: () => base44.entities.LblChecklistSubmission.filter({ status: 'pending_approval' }), refetchInterval: 10000 });
  const { data: allJobs = [] } = useQuery({ queryKey: ['lbl-approval-jobs'], queryFn: () => base44.entities.LabellingJob.list('-created_date', 500), enabled: submissions.length > 0 });
  const jobMap = {};
  allJobs.forEach(j => { jobMap[j.id] = j; });

  const handleDecision = async (sub, approved) => {
    if (!approved && !rejectReason.trim()) { toast({ title: 'Rejection reason required', variant: 'destructive' }); return; }
    setActing(true);
    const job = jobMap[sub.job_id];
    await base44.entities.LblChecklistSubmission.update(sub.id, { status: approved ? 'approved' : 'rejected', reviewed_by_email: user?.email, reviewed_by_name: user?.full_name, reviewed_at: new Date().toISOString(), rejection_reason: approved ? '' : rejectReason, review_remarks: remarks });
    if (job) await base44.entities.LabellingJob.update(job.id, { status: approved ? 'demo_approved' : 'demo_rejected', approval_status: approved ? 'approved' : 'rejected', approved_by: approved ? user?.email : '', approved_at: approved ? new Date().toISOString() : '', rejection_reason: approved ? '' : rejectReason });
    await logLabellingEvent({ action_type: approved ? 'demo_approved' : 'demo_rejected', job_id: sub.job_id, description: `Demo ${approved ? 'approved' : 'rejected'} for job ${job?.job_id || sub.job_id}`, user });
    toast({ title: approved ? 'Approved' : 'Rejected' });
    queryClient.invalidateQueries({ queryKey: ['lbl-pending-approvals'] });
    setActiveId(null); setRejectReason(''); setRemarks(''); setActing(false);
  };

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-4xl mx-auto">
      <div><h1 className="text-xl md:text-2xl font-bold text-slate-900">Demo Print Approvals</h1><p className="text-sm text-slate-500">{submissions.length} pending</p></div>
      {submissions.length === 0 ? (
        <div className="text-center py-12 bg-white border border-slate-200 rounded-lg"><CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" /><p className="text-slate-500">No pending approvals</p></div>
      ) : submissions.map(sub => {
        const job = jobMap[sub.job_id];
        const isExpanded = activeId === sub.id;
        return (
          <div key={sub.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <button className="w-full text-left p-4 hover:bg-slate-50" onClick={() => { setActiveId(isExpanded ? null : sub.id); setRejectReason(''); setRemarks(''); }}>
              <div className="flex items-center justify-between"><div><p className="font-semibold text-slate-900 text-sm">{job?.product_name || 'Unknown'}</p><p className="text-xs text-slate-500">Job: {job?.job_id || '—'} · By: {sub.submitted_by_name} · {moment(sub.submitted_at).format('DD/MM/YYYY HH:mm')}</p></div><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Pending</span></div>
            </button>
            {isExpanded && (
              <div className="border-t border-slate-200 p-4 space-y-4">
                <div className="space-y-2"><h3 className="text-sm font-medium text-slate-900 flex items-center gap-1"><ClipboardCheck className="w-4 h-4" /> Checklist</h3>
                  {(sub.answers_json || []).map((a, i) => <div key={i} className="flex justify-between bg-slate-50 rounded p-2 text-sm"><span className="text-slate-600">{a.question}</span><span className="font-medium text-slate-900">{a.answer}</span></div>)}
                </div>
                {sub.image_urls?.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-slate-900">Demo Bottle Images ({sub.image_urls.length})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sub.image_urls.map((url, i) => {
                        const aiResult = sub.ai_analysis?.find(a => a.image_index === i) || null;
                        const isPass = aiResult?.analysis?.includes('✅');
                        const isFail = aiResult?.analysis?.includes('❌');
                        return (
                          <div key={i} className="space-y-2">
                            <p className="text-xs text-slate-500 font-medium">Image {i + 1} of {sub.image_urls.length}</p>
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt={`Demo ${i + 1}`} className="w-full rounded-lg border border-slate-200 object-contain bg-slate-50 max-h-72 hover:opacity-90 transition-opacity cursor-zoom-in" />
                            </a>
                            <p className="text-xs text-slate-400 text-center">Click to open full size</p>
                            {/* AI Analysis for supervisor */}
                            {aiResult?.analysis && (
                              <div className={`rounded-lg border p-3 space-y-1 ${
                                isPass ? 'bg-green-50 border-green-200' :
                                isFail ? 'bg-red-50 border-red-200' :
                                'bg-amber-50 border-amber-200'
                              }`}>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs">✨</span>
                                  <span className={`text-xs font-semibold uppercase tracking-wide ${isPass ? 'text-green-700' : isFail ? 'text-red-700' : 'text-amber-700'}`}>
                                    AI Label Assessment
                                  </span>
                                  {isPass && <span className="ml-auto text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">PASS</span>}
                                  {isFail && <span className="ml-auto text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">FAIL</span>}
                                </div>
                                <p className={`text-xs leading-relaxed whitespace-pre-wrap ${isPass ? 'text-green-800' : isFail ? 'text-red-800' : 'text-amber-800'}`}>
                                  {aiResult.analysis}
                                </p>
                              </div>
                            )}
                            {/* No AI analysis available */}
                            {!aiResult?.analysis && (
                              <p className="text-xs text-slate-400 italic text-center">No AI analysis available for this image</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  <div className="space-y-1"><Label className="text-xs font-medium text-slate-700">Remarks (Optional)</Label><Textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Comments..." className="min-h-[50px]" /></div>
                  <div className="space-y-1"><Label className="text-xs font-medium text-slate-700">Rejection Reason (Required if rejecting)</Label><Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason..." className="min-h-[50px]" /></div>
                  <div className="flex flex-col md:flex-row gap-3">
                    <Button className="h-11 flex-1 gap-2 bg-green-600 hover:bg-green-700" onClick={() => handleDecision(sub, true)} disabled={acting}>{acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}Approve</Button>
                    <Button variant="outline" className="h-11 flex-1 gap-2 border-red-300 text-red-600 hover:bg-red-50" onClick={() => handleDecision(sub, false)} disabled={acting}>{acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}Reject</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}