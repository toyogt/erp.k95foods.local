import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus, ChevronDown, ChevronUp, GitBranch, CheckCircle2,
  Clock, AlertTriangle, Lock, ArrowRight, Loader2
} from 'lucide-react';
import { isTaskOverdue, TASK_STATUS_CONFIG } from '@/lib/directorTaskHelpers';
import DirectorTaskCard from '@/components/tasks/DirectorTaskCard';
import CreateDirectorTaskModal from '@/components/tasks/CreateDirectorTaskModal';

/**
 * Shows all tasks within a project, with dependency chain visualization.
 * Blocked tasks (waiting on predecessors) are clearly indicated.
 */
export default function ProjectTaskBoard({ project, user, onRefresh }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [expandedTask, setExpandedTask] = useState(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const all = await base44.entities.DirectorTask.filter({ project_id: project.id }, 'created_date', 200);
    setTasks(all);
    setLoading(false);
  }, [project.id]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Build a map of id → task for dependency lookup
  const taskMap = Object.fromEntries(tasks.map(t => [t.id, t]));

  const getDepStatus = (task) => {
    if (!task.predecessor_task_ids?.length) return 'unblocked';
    const allDone = task.predecessor_task_ids.every(pid => {
      const p = taskMap[pid];
      return p?.status === 'completed';
    });
    return allDone ? 'unblocked' : 'blocked';
  };

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const overdueCount = tasks.filter(t => isTaskOverdue(t)).length;
  const blockedCount = tasks.filter(t => t.status === 'blocked').length;

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mini stats */}
      <div className="grid grid-cols-4 gap-2">
        <StatPill label="Total" value={tasks.length} color="slate" />
        <StatPill label="Done" value={completedCount} color="green" />
        <StatPill label="Overdue" value={overdueCount} color="red" />
        <StatPill label="Blocked" value={blockedCount} color="purple" />
      </div>

      {/* Add task button */}
      <Button size="sm" variant="outline" onClick={() => setShowAddTask(true)}
        className="gap-2 h-9 border-dashed">
        <Plus className="w-4 h-4" /> Add Task to Project
      </Button>

      {/* Task list with dependency chain */}
      {tasks.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">
          No tasks yet. Add the first task to this project.
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task, idx) => {
            const depStatus = getDepStatus(task);
            const preds = (task.predecessor_task_ids || []).map(pid => taskMap[pid]).filter(Boolean);
            return (
              <div key={task.id}>
                {/* Dependency connector line */}
                {idx > 0 && task.predecessor_task_ids?.length > 0 && (
                  <div className="flex items-center gap-2 px-4 py-1 text-xs text-slate-400">
                    <ArrowRight className="w-3 h-3" />
                    <span>
                      Depends on: {preds.map(p => p.task_number).join(', ')}
                    </span>
                    {depStatus === 'blocked' ? (
                      <span className="bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Blocked
                      </span>
                    ) : (
                      <span className="bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-medium">
                        Ready
                      </span>
                    )}
                  </div>
                )}
                {depStatus === 'blocked' ? (
                  <BlockedTaskRow task={task} preds={preds} />
                ) : (
                  <DirectorTaskCard task={task} user={user} viewMode="ea" onRefresh={loadTasks} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add task to this project */}
      {showAddTask && (
        <CreateDirectorTaskModal
          open={showAddTask}
          onClose={() => setShowAddTask(false)}
          user={user}
          directorEmail={project.director_email}
          directorName={project.director_name}
          defaultProjectId={project.id}
          defaultProjectName={project.project_name}
          existingProjectTasks={tasks}
          onCreated={() => { setShowAddTask(false); loadTasks(); onRefresh?.(); }}
        />
      )}
    </div>
  );
}

function BlockedTaskRow({ task, preds }) {
  const [expanded, setExpanded] = useState(false);
  const status = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.open;
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 border-l-4 border-l-purple-400 opacity-75">
      <div className="p-3 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{task.task_number}</span>
            <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Lock className="w-3 h-3" /> Blocked
            </span>
          </div>
          <p className="font-medium text-slate-600 text-sm mt-1">{task.task_name}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Waiting for: {preds.map(p => `${p.task_number} (${p.task_name})`).join(' · ')}
          </p>
        </div>
        <button onClick={() => setExpanded(e => !e)} className="text-slate-400 hover:text-slate-600 p-1">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
      {expanded && task.task_details && (
        <div className="px-3 pb-3">
          <p className="text-xs text-slate-500 whitespace-pre-wrap">{task.task_details}</p>
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value, color }) {
  const colors = {
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
    green: 'bg-green-50 border-green-100 text-green-700',
    red: 'bg-red-50 border-red-100 text-red-600',
    purple: 'bg-purple-50 border-purple-100 text-purple-700',
  };
  return (
    <div className={`rounded-lg border p-2 text-center ${colors[color]}`}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5">{label}</p>
    </div>
  );
}