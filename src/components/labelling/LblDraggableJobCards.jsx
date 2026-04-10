import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import LblJobCard from '@/components/labelling/LblJobCard';
import { GripVertical } from 'lucide-react';

export default function LblDraggableJobCards({ jobs, planLocked, onReorder }) {
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    onReorder(from, to);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="job-cards">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
            {jobs.map((job, idx) => (
              <Draggable key={job.id} draggableId={job.id} index={idx}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`flex items-start gap-2 ${snapshot.isDragging ? 'opacity-90 shadow-lg rounded-lg' : ''}`}
                  >
                    <div
                      {...provided.dragHandleProps}
                      className="mt-4 p-1 cursor-grab active:cursor-grabbing touch-none rounded hover:bg-slate-100 shrink-0"
                    >
                      <GripVertical className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <LblJobCard
                        job={job}
                        isFirst={idx === jobs.findIndex(j => j.status === 'pending')}
                        planLocked={planLocked}
                      />
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}