import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { JOB_STATUSES, generateJobId } from '@/lib/labellingHelpers';
import LblJobEditModal from '@/components/labelling/LblJobEditModal';
import { GripVertical, Plus, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const TERMINAL_STATUSES = ['completed', 'cancelled', 'on_hold'];

export default function LblLineJobQueue({ line, jobs, products, canManage }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editingJob, setEditingJob] = useState(null);
  const [addingJob, setAddingJob] = useState(false);
  const [deletingJob, setDeletingJob] = useState(null);

  const lineJobs = jobs
    .filter(j => j.line_id === line.machine_id)
    .sort((a, b) => (a.priority_order || 999) - (b.priority_order || 999));

  const handleDragEnd = async (result) => {
    if (!result.destination || result.source.index === result.destination.index) return;
    const reordered = Array.from(lineJobs);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    // Persist new priority_order
    await Promise.all(
      reordered.map((job, idx) =>
        base44.entities.LabellingJob.update(job.id, { priority_order: idx + 1 })
      )
    );
    queryClient.invalidateQueries({ queryKey: ['lbl-all-jobs'] });
  };

  const handleAddJob = async (form) => {
    const nextPriority = lineJobs.length + 1;
    await base44.entities.LabellingJob.create({
      job_id: generateJobId(),
      plan_id: `LINE-${line.machine_id}`,
      line_id: line.machine_id,
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
    await base44.entities.LabellingJob.delete(deletingJob.id);
    setDeletingJob(null);
    queryClient.invalidateQueries({ queryKey: ['lbl-all-jobs'] });
  };

  const activeJob = lineJobs.find(j => !TERMINAL_STATUSES.includes(j.status) && j.status !== 'pending');
  const pendingCount = lineJobs.filter(j => j.status === 'pending').length;
  const completedCount = lineJobs.filter(j => j.status === 'completed').length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Line Header */}
      <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-base">{line.display_name}</h2>
          <div className="flex gap-3 mt-0.5 text-xs text-slate-300">
            <span>{lineJobs.length} jobs total</span>
            <span>{pendingCount} pending</span>
            <span>{completedCount} completed</span>
          </div>
        </div>
        {canManage && (
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white text-sm"
            onClick={() => setAddingJob(true)}
          >
            <Plus className="w-4 h-4" /> Add Job
          </Button>
        )}
      </div>

      {/* Active job indicator */}
      {activeJob && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
            <span className="text-sm font-medium text-blue-800">Active: {activeJob.product_name}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${JOB_STATUSES[activeJob.status]?.color}`}>
              {JOB_STATUSES[activeJob.status]?.label}
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-blue-700 hover:bg-blue-100 text-xs"
            onClick={() => navigate(`/LblOperatorJob?jobId=${activeJob.id}`)}
          >
            View <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Job Queue */}
      <div className="p-3 space-y-1">
        {lineJobs.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">
            No jobs in this queue. {canManage && 'Click "Add Job" to add one.'}
          </div>
        )}

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId={`line-${line.machine_id}`} isDropDisabled={!canManage}>
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                {lineJobs.map((job, idx) => {
                  const st = JOB_STATUSES[job.status] || JOB_STATUSES.pending;
                  const isTerminal = TERMINAL_STATUSES.includes(job.status);
                  const isDraggable = canManage && !isTerminal;
                  return (
                    <Draggable key={job.id} draggableId={job.id} index={idx} isDragDisabled={!isDraggable}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-all ${
                            snapshot.isDragging ? 'shadow-lg opacity-90' : ''
                          } ${
                            job.status === 'completed' ? 'border-green-200 bg-green-50/40' :
                            job.status === 'cancelled' ? 'border-slate-200 bg-slate-50 opacity-60' :
                            job.status === 'on_hold' ? 'border-amber-200 bg-amber-50/30' :
                            job.status === 'pending' ? 'border-slate-200 bg-white' :
                            'border-blue-200 bg-blue-50/30'
                          }`}
                        >
                          {/* Drag handle */}
                          <div
                            {...provided.dragHandleProps}
                            className={`shrink-0 ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'opacity-20 cursor-not-allowed'}`}
                          >
                            <GripVertical className="w-4 h-4 text-slate-400" />
                          </div>

                          {/* Priority badge */}
                          <span className="text-xs font-bold text-slate-400 w-5 text-center shrink-0">#{idx + 1}</span>

                          {/* Job info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm text-slate-900 truncate">{job.product_name}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${st.color}`}>{st.label}</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-3">
                              <span>Code: {job.sku_code}</span>
                              <span>{job.quantity_bottles_planned?.toLocaleString()} bottles</span>
                              {job.manufacturing_date && <span>Manufactured: {job.manufacturing_date}</span>}
                              {job.batch_no && <span>Batch: {job.batch_no}</span>}
                            </div>
                          </div>

                          {/* Actions */}
                          {canManage && !isTerminal && (
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-slate-400 hover:text-slate-700"
                                onClick={() => setEditingJob(job)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-slate-400 hover:text-red-600"
                                onClick={() => setDeletingJob(job)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-blue-600 hover:bg-blue-50 text-xs px-2"
                                onClick={() => navigate(`/LblOperatorJob?jobId=${job.id}`)}
                              >
                                Open <ChevronRight className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                          {isTerminal && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-slate-500 hover:bg-slate-50 text-xs px-2 shrink-0"
                              onClick={() => navigate(`/LblOperatorJob?jobId=${job.id}`)}
                            >
                              View <ChevronRight className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
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