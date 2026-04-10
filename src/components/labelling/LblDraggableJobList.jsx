import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import LblJobRowEditor from '@/components/labelling/LblJobRowEditor';

export default function LblDraggableJobList({ jobs, products, planDate, onUpdate, onRemove, onReorder }) {
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    onReorder(from, to);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="job-list">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
            {jobs.map((job, idx) => (
              <Draggable key={job._key} draggableId={String(job._key)} index={idx}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={snapshot.isDragging ? 'opacity-90 shadow-lg rounded-lg' : ''}
                  >
                    <LblJobRowEditor
                      index={idx}
                      job={job}
                      products={products}
                      planDate={planDate}
                      onUpdate={onUpdate}
                      onRemove={onRemove}
                      dragHandleProps={provided.dragHandleProps}
                    />
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