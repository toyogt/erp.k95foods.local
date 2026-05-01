import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  ChevronDown, ChevronUp, Calendar, AlertTriangle,
  Layers, CheckCircle2, Clock, XCircle
} from 'lucide-react';
import { isTaskOverdue } from '@/lib/directorTaskHelpers';
import ProjectTaskBoard from '@/components/tasks/ProjectTaskBoard';
import moment from 'moment';

const PROJECT_STATUS = {
  planned:     { label: 'Planned',     color: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  on_hold:     { label: 'On Hold',     color: 'bg-yellow-100 text-yellow-700' },
  completed:   { label: 'Completed',   color: 'bg-green-100 text-green-700' },
  cancelled:   { label: 'Cancelled',   color: 'bg-slate-100 text-slate-400' },
};

function isProjectOverdue(project) {
  if (!project.end_date || project.status === 'completed' || project.status === 'cancelled') return false;
  return moment(project.end_date, 'DD/MM/YYYY').endOf('day').isBefore(moment());
}

export default function ProjectCard({ project, user, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = PROJECT_STATUS[project.status] || PROJECT_STATUS.planned;
  const overdue = isProjectOverdue(project);

  const borderColor = overdue ? 'border-l-red-500'
    : project.status === 'completed' ? 'border-l-green-400'
    : project.status === 'in_progress' ? 'border-l-blue-400'
    : 'border-l-slate-300';

  const markStatus = async (status) => {
    await base44.entities.Project.update(project.id, { status });
    onRefresh?.();
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200 border-l-4 ${borderColor} shadow-sm`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                {project.project_number}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
              {project.is_important && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Important
                </span>
              )}
              {overdue && project.status !== 'completed' && (
                <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-semibold">OVERDUE</span>
              )}
              <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Layers className="w-3 h-3" /> Project
              </span>
            </div>
            <h3 className="font-semibold text-slate-800 mt-1.5 text-base">{project.project_name}</h3>
            {project.project_description && (
              <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{project.project_description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Deadline: {project.end_date}
              </span>
              <span className="flex items-center gap-1">
                From: {project.director_name || project.director_email}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 items-end shrink-0">
            {/* Status quick actions */}
            {project.status === 'planned' && (
              <Button size="sm" onClick={() => markStatus('in_progress')}
                className="gap-1.5 min-h-[36px] text-xs bg-blue-600 hover:bg-blue-700">
                Start Project
              </Button>
            )}
            {project.status === 'in_progress' && (
              <div className="flex gap-1.5">
                <Button size="sm" onClick={() => markStatus('completed')}
                  className="gap-1.5 min-h-[36px] text-xs bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Mark Done
                </Button>
                <Button size="sm" variant="outline" onClick={() => markStatus('on_hold')}
                  className="min-h-[36px] text-xs">
                  Hold
                </Button>
              </div>
            )}
            {project.status === 'on_hold' && (
              <Button size="sm" onClick={() => markStatus('in_progress')}
                className="gap-1.5 min-h-[36px] text-xs">
                Resume
              </Button>
            )}

            <button onClick={() => setExpanded(e => !e)}
              className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-xs min-h-[36px] px-2">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {expanded ? 'Hide Tasks' : 'View Tasks'}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded: Task Board */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-4">
          <ProjectTaskBoard project={project} user={user} onRefresh={onRefresh} />
        </div>
      )}
    </div>
  );
}