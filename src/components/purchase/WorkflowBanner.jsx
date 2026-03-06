import { ArrowRight } from 'lucide-react';

const MR_FLOW = ['DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'CLOSED'];
const PO_FLOW = ['DRAFT', 'SUBMITTED', 'APPROVED', 'SENT', 'PART_RECEIVED', 'CLOSED'];

const STEP_COLOR = {
  DRAFT: 'bg-slate-200 text-slate-600',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  ORDERED: 'bg-purple-100 text-purple-700',
  SENT: 'bg-cyan-100 text-cyan-700',
  PART_RECEIVED: 'bg-amber-100 text-amber-700',
  CLOSED: 'bg-slate-300 text-slate-600',
  CANCELLED: 'bg-red-100 text-red-500',
};

const NEXT_ACTION = {
  DRAFT: 'Submit to proceed',
  SUBMITTED: 'Awaiting manager approval',
  APPROVED: 'Ready — create PO or share',
  REJECTED: 'Rejected — create new document',
  ORDERED: 'PO created',
  SENT: 'Awaiting supplier confirmation',
  PART_RECEIVED: 'Partial receipt — GRN in progress',
  CLOSED: 'Completed',
  CANCELLED: 'Cancelled',
};

export default function WorkflowBanner({ docType, status }) {
  const flow = docType === 'MR' ? MR_FLOW : PO_FLOW;
  const currentIdx = flow.indexOf(status);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Workflow Status</p>
      {/* Step pills */}
      <div className="flex items-center gap-1 flex-wrap">
        {flow.map((step, i) => (
          <div key={step} className="flex items-center gap-1">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              step === status ? STEP_COLOR[step] || 'bg-blue-100 text-blue-700' :
              i < currentIdx ? 'bg-slate-100 text-slate-400 line-through' :
              'bg-slate-50 text-slate-300'
            }`}>
              {step}
            </span>
            {i < flow.length - 1 && <ArrowRight className="w-3 h-3 text-slate-300" />}
          </div>
        ))}
        {(status === 'REJECTED' || status === 'CANCELLED') && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STEP_COLOR[status]}`}>{status}</span>
        )}
      </div>
      {/* Next action hint */}
      <p className="text-xs text-slate-500 italic">{NEXT_ACTION[status] || ''}</p>
    </div>
  );
}