import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import PunchRequestList from '@/components/hr/PunchRequestList';

const APPROVER_ROLES = new Set(['admin', 'hr_manager', 'hr_supervisor', 'supervisor']);

export default function HRManualPunchApprovals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [reviewing, setReviewing] = useState(null); // { request, action }
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['punch-requests', statusFilter],
    queryFn: () => base44.entities.ManualPunchRequest.filter(
      { status: statusFilter },
      '-requested_at',
      200
    ),
    refetchInterval: 20000,
  });

  if (user && !APPROVER_ROLES.has(user.role)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center text-slate-600">
            Approver access required (admin, HR manager, HR supervisor, or supervisor).
          </CardContent>
        </Card>
      </div>
    );
  }

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['punch-requests'] });
    queryClient.invalidateQueries({ queryKey: ['attendance-logs'] });
    queryClient.invalidateQueries({ queryKey: ['daily-attendance-summary'] });
  };

  const submitReview = async () => {
    if (!reviewing) return;
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('applyManualPunchRequest', {
        request_id: reviewing.request.id,
        action: reviewing.action,
        review_remarks: reviewRemarks,
      });
      const data = res.data || res;
      if (!data.ok) throw new Error(data.error || 'Failed');
      toast({
        title: reviewing.action === 'approve' ? 'Request approved' : 'Request rejected',
        description: reviewing.action === 'approve' ? 'Punch applied · daily attendance recalculated' : '',
      });
      setReviewing(null);
      setReviewRemarks('');
      refresh();
    } catch (e) {
      toast({ title: 'Review failed', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
          <ClipboardCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Manual Punch Approvals</h1>
          <p className="text-xs md:text-sm text-slate-500">
            Approve or reject manual punch change requests. Approval auto-applies the change and recalculates attendance.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? 'default' : 'outline'}
                onClick={() => setStatusFilter(s)}
                className="h-11 md:h-9"
              >
                {s}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{statusFilter} Requests ({requests.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <PunchRequestList
            requests={requests}
            isLoading={isLoading}
            renderActions={(r) =>
              r.status === 'PENDING' ? (
                <div className="inline-flex gap-1">
                  <Button
                    size="sm" variant="outline"
                    className="h-8 px-2 text-green-700 hover:bg-green-50"
                    onClick={() => { setReviewing({ request: r, action: 'approve' }); setReviewRemarks(''); }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="h-8 px-2 text-red-600 hover:bg-red-50"
                    onClick={() => { setReviewing({ request: r, action: 'reject' }); setReviewRemarks(''); }}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : null
            }
          />
        </CardContent>
      </Card>

      {reviewing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-3">
            <h3 className="font-semibold text-slate-900">
              {reviewing.action === 'approve' ? 'Approve Request' : 'Reject Request'}
            </h3>
            <div className="text-sm bg-slate-50 border border-slate-200 rounded-md p-3 space-y-1">
              <div><span className="text-slate-500">Type:</span> <strong className="uppercase">{reviewing.request.request_type}</strong></div>
              <div><span className="text-slate-500">Employee:</span> {reviewing.request.employee_code}</div>
              <div><span className="text-slate-500">Reason:</span> {reviewing.request.reason}</div>
            </div>
            <textarea
              value={reviewRemarks}
              onChange={(e) => setReviewRemarks(e.target.value)}
              placeholder="Review remarks (optional)..."
              rows={3}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReviewing(null)} disabled={submitting} className="h-11 md:h-9">
                Cancel
              </Button>
              <Button
                onClick={submitReview}
                disabled={submitting}
                className={`h-11 md:h-9 gap-2 ${reviewing.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm {reviewing.action === 'approve' ? 'Approval' : 'Rejection'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}