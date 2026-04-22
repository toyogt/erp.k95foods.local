import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { JOB_STATUSES, generateJobId } from '@/lib/labellingHelpers';
import LblJobEditModal from '@/components/labelling/LblJobEditModal';
import {
  GripVertical, Plus, Pencil, Trash2, ChevronRight,
  ArrowUp, ArrowDown, ExternalLink, CheckCircle2,
  Clock, Pause, XCircle, PlayCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const TERMINAL_STATUSES = ['completed', 'cancelled', 'on_hold'];
const IN_PROGRESS_STATUSES = ['active', 'stock_transferred', 'demo_print_sent', 'demo_print_verified',
  'checklist_submitted', 'demo_pending_approval', 'demo_approved', 'bulk_printing', 'paused',
  'bulk_printing_awaiting_printer_reset'];

function StatusIcon({ status }) {
  if (status === 'completed') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === 'cancelled') return <XCircle className="w-4 h-4 text-slate-400" />;
  if (status === 'on_hold') return <Pause className="w-4 h-4 text-amber-500" />;
  if (status === 'pending') return <Clock className="w-4 h-4 text-slate-400" />;
  return <PlayCircle className="w-4 h-4 text-blue-500" />;
}

function JobCard({ job, idx, totalJobs, canManage, canEdit = canManage, canDelete = canManage, canReorder = canManage, isDragging, dragHandleProps, draggableProps, innerRef, onEdit, onDelete, onMoveUp, onMoveDown, onOpen }) {
  const st = JOB_STATUSES[job.status] || JOB_STATUSES.pending;
  const isTerminal = TERMINAL_STATUSES.includes(job.status);
  const isInProgress = IN_PROGRESS_STATUSES.includes(job.status);
  const isDraggable = canReorder && !isTerminal;

  const cardBg =
    job.status === 'completed' ? 'border-green-200 bg-green-50/40' :
    job.status === 'cancelled' ? 'border-slate-200 bg-slate-50 opacity-60' :
    job.status === 'on_hold' ? 'border-amber-200 bg-amber-50/40' :
    isInProgress ? 'border-blue-300 bg-blue-50/40 shadow-sm' :
    'border-slate-200 bg-white';

  return (
    <div
      ref={innerRef}
      {...draggableProps}
      className={`rounded-xl border transition-all ${cardBg} ${isDragging ? 'shadow-xl ring-2 ring-slate-300 scale-[1.02]' : ''}`}
    >
      {/* Top row: drag + priority + status + actions */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-1">
        {/* Drag handle */}
        <div
          {...dragHandleProps}
          className={`shrink-0 p-1 rounded ${isDraggable ? 'cursor-grab active:cursor-grabbing hover:bg-slate-100 text-slate-400 hover:text-slate-600' : 'opacity-20 cursor-not-allowed text-slate-300'}`}
          title={isDraggable ? 'Drag to reorder' : 'Cannot reorder'}
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Priority number */}
        <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0">
          {idx + 1}
        </span>

        {/* Status icon + badge */}
        <StatusIcon status={job.status} />
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.color}`}>{st.label}</span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Move up/down for priority */}
          {canReorder && !isTerminal && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                onClick={() => onMoveUp(idx)}
                disabled={idx === 0}
                title="Move up (higher priority)"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                onClick={() => onMoveDown(idx)}
                disabled={idx === totalJobs - 1}
                title="Move down (lower priority)"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
          {canEdit && !isTerminal && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
              onClick={() => onEdit(job)}
              title="Edit job"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          {canDelete && !isTerminal && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
              onClick={() => onDelete(job)}
              title="Remove job"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            onClick={() => onOpen(job)}
            title="Open job"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Job details */}
      <div className="px-4 pb-3">
        <p className="font-semibold text-sm text-slate-900 leading-tight">{job.product_name}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
          <span className="text-xs text-slate-500">Code: <span className="font-medium text-slate-700">{job.sku_code}</span></span>
          <span className="text-xs text-slate-500">Planned: <span className="font-medium text-slate-700">{job.quantity_bottles_planned?.toLocaleString()} bottles</span></span>
          {job.manufacturing_date && (
            <span className="text-xs text-slate-500">Manufactured: <span className="font-medium text-slate-700">{job.manufacturing_date}</span></span>
          )}
          {job.batch_no && (
            <span className="text-xs text-slate-500">Batch: <span className="font-mono font-medium text-slate-700">{job.batch_no}</span></span>
          )}
        </div>

        {/* Progress bar for in-progress jobs */}
        {(isInProgress || job.status === 'completed') && job.quantity_bottles_planned > 0 && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Printed: {(job.current_printed_qty || 0).toLocaleString()}</span>
              <span>{Math.min(100, Math.round(((job.current_printed_qty || 0) / job.quantity_bottles_planned) * 100))}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${job.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(100, ((job.current_printed_qty || 0) / job.quantity_bottles_planned) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Open button row for mobile — full width tap target */}
        <Button
          className="mt-2 w-full h-9 text-sm gap-1.5 bg-slate-900 hover:bg-slate-700 text-white"
          onClick={() => onOpen(job)}
        >
          {isInProgress ? 'Continue Job' : isTerminal ? 'View Job' : 'Open Job'}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export default function LblLineJobQueue({ line, jobs, products, canManage, caps, user, sortBy = 'priority_asc' }) {
  // Derive granular caps from passed caps object (fallback to canManage for backward compat)
  const canCreate = caps?.canCreateJob ?? canManage;
  const canEdit = caps?.canEditJob ?? canManage;
  const canDelete = caps?.canDeleteJob ?? canManage;
  const canReorder = caps?.canReorderJob ?? canManage;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editingJob, setEditingJob] = useState(null);
  const [addingJob, setAddingJob] = useState(false);
  const [deletingJob, setDeletingJob] = useState(null);

  // Parse DD/MM/YYYY or YYYY-MM-DD into a sortable timestamp
  const parsePlanDate = (d) => {
    if (!d) return 0;
    if (d.includes('/')) {
      const [day, mon, yr] = d.split('/');
      return new Date(`${yr}-${mon}-${day}`).getTime() || 0;
    }
    return new Date(d).getTime() || 0;
  };

  // Jobs store line_id as the Machine record's `id` (not machine_id field)
  const lineJobs = jobs
    .filter(j => j.line_id === line.id || j.line_id === line.machine_id)
    .sort((a, b) => {
      if (sortBy === 'priority_desc') {
        return (b.priority_order || 0) - (a.priority_order || 0);
      }
      if (sortBy === 'date_desc') {
        return parsePlanDate(b.plan_date) - parsePlanDate(a.plan_date);
      }
      if (sortBy === 'date_asc') {
        return parsePlanDate(a.plan_date) - parsePlanDate(b.plan_date);
      }
      // Default: priority_asc
      return (a.priority_order || 999) - (b.priority_order || 999);
    });

  const reorderAndSave = async (reordered) => {
    await Promise.all(
      reordered.map((job, idx) =>
        base44.entities.LabellingJob.update(job.id, { priority_order: idx + 1 })
      )
    );
    queryClient.invalidateQueries({ queryKey: ['lbl-all-jobs'] });
  };

  const handleDragEnd = async (result) => {
    if (!result.destination || result.source.index === result.destination.index) return;
    const reordered = Array.from(lineJobs);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    await reorderAndSave(reordered);
  };

  const handleMoveUp = async (idx) => {
    if (idx === 0) return;
    const reordered = Array.from(lineJobs);
    [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
    await reorderAndSave(reordered);
  };

  const handleMoveDown = async (idx) => {
    if (idx === lineJobs.length - 1) return;
    const reordered = Array.from(lineJobs);
    [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
    await reorderAndSave(reordered);
  };

  const handleAddJob = async (form) => {
    const nextPriority = lineJobs.length + 1;
    await base44.entities.LabellingJob.create({
      job_id: generateJobId(),
      plan_id: `LINE-${line.machine_id}`,
      line_id: line.id,
      line_name: line.display_name,
      status: 'pending',
      priority_order: nextPriority,
      ...form,
    });
    queryClient.invalidateQueries({ queryKey: ['lbl-all-jobs'] });
  };

  const handleEditJob = async (form) => {
    await base44.entities.LabellingJob.update(editingJob.id, form);
    queryClient.invalidateQueries({ queryKey: ['lbl-all-jobs'] });
  };

  const handleDeleteJob = async () => {
    const jobId = deletingJob?.id;
    if (!jobId) {
      setDeletingJob(null);
      return;
    }
    try {
      await base44.entities.LabellingJob.delete(jobId);
    } catch (err) {
      // If the job is already gone (404 / not found), treat as success and just refresh the list.
      const msg = err?.message || '';
      const notFound = msg.includes('not found') || err?.response?.status === 404;
      if (!notFound) {
        console.error('Failed to delete labelling job:', err);
        alert(`Could not remove job: ${msg || 'Unknown error'}`);
        return;
      }
    } finally {
      setDeletingJob(null);
      queryClient.invalidateQueries({ queryKey: ['lbl-all-jobs'] });
    }
  };

  const activeJob = lineJobs.find(j => IN_PROGRESS_STATUSES.includes(j.status));
  const pendingCount = lineJobs.filter(j => j.status === 'pending').length;
  const completedCount = lineJobs.filter(j => j.status === 'completed').length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Line Header */}
      <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-base">{line.display_name}</h2>
          <div className="flex gap-3 mt-0.5 text-xs text-slate-300">
            <span>{lineJobs.length} total</span>
            <span className="text-slate-400">·</span>
            <span>{pendingCount} pending</span>
            <span className="text-slate-400">·</span>
            <span className="text-green-400">{completedCount} completed</span>
          </div>
        </div>
        {canCreate && (
          <Button
            size="sm"
            className="h-11 md:h-9 gap-1.5 bg-white text-slate-900 hover:bg-slate-100 font-semibold text-sm px-4"
            onClick={() => setAddingJob(true)}
          >
            <Plus className="w-4 h-4" /> Add Job
          </Button>
        )}
      </div>

      {/* Active job banner */}
      {activeJob && (
        <div className="bg-blue-600 text-white px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
            <div className="min-w-0">
              <span className="text-sm font-semibold truncate block">{activeJob.product_name}</span>
              <span className="text-xs text-blue-200">{JOB_STATUSES[activeJob.status]?.label}</span>
            </div>
          </div>
          <Button
            size="sm"
            className="h-9 bg-white text-blue-700 hover:bg-blue-50 font-semibold text-sm gap-1 shrink-0"
            onClick={() => navigate(`/LblOperatorJob?jobId=${activeJob.id}`)}
          >
            Continue <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Job Queue */}
      <div className="p-3">
        {lineJobs.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <p className="font-medium text-sm">Queue is empty</p>
            {canCreate && (
              <Button
                className="mt-3 h-11 gap-2 bg-slate-900 text-white"
                onClick={() => setAddingJob(true)}
              >
                <Plus className="w-4 h-4" /> Add First Job
              </Button>
            )}
          </div>
        )}

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId={`line-${line.machine_id}`} isDropDisabled={!canReorder}>
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                {lineJobs.map((job, idx) => {
                  const isTerminal = TERMINAL_STATUSES.includes(job.status);
                  const isDraggable = canReorder && !isTerminal;
                  return (
                    <Draggable key={job.id} draggableId={job.id} index={idx} isDragDisabled={!isDraggable}>
                      {(provided, snapshot) => (
                        <JobCard
                          job={job}
                          idx={idx}
                          totalJobs={lineJobs.filter(j => !TERMINAL_STATUSES.includes(j.status)).length}
                          canManage={canManage}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          canReorder={canReorder}
                          isDragging={snapshot.isDragging}
                          dragHandleProps={provided.dragHandleProps}
                          draggableProps={provided.draggableProps}
                          innerRef={provided.innerRef}
                          onEdit={setEditingJob}
                          onDelete={setDeletingJob}
                          onMoveUp={handleMoveUp}
                          onMoveDown={handleMoveDown}
                          onOpen={(j) => navigate(`/LblOperatorJob?jobId=${j.id}`)}
                        />
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {/* Add Job Modal */}
      {addingJob && (
        <LblJobEditModal
          open={addingJob}
          onClose={() => setAddingJob(false)}
          job={null}
          products={products}
          onSave={handleAddJob}
          mode="add"
          user={user}
        />
      )}

      {/* Edit Job Modal */}
      {editingJob && (
        <LblJobEditModal
          open={!!editingJob}
          onClose={() => setEditingJob(null)}
          job={editingJob}
          products={products}
          onSave={handleEditJob}
          mode="edit"
          user={user}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingJob} onOpenChange={() => setDeletingJob(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Job from Queue?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deletingJob?.product_name}</strong> from the queue. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 md:h-9">Cancel</AlertDialogCancel>
            <AlertDialogAction className="h-11 md:h-9 bg-red-600 hover:bg-red-700" onClick={handleDeleteJob}>
              Remove Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}