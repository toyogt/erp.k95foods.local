import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2, Plus, Search, ClipboardList, AlertTriangle,
  CheckCircle2, Clock, User, XCircle, Smartphone, Layers
} from 'lucide-react';
import CreateDirectorTaskModal from '@/components/tasks/CreateDirectorTaskModal';
import DirectorTaskCard from '@/components/tasks/DirectorTaskCard';
import VoiceShortcutGuide from '@/components/tasks/VoiceShortcutGuide';
import ProjectFormModal from '@/components/tasks/ProjectFormModal';
import ProjectCard from '@/components/tasks/ProjectCard';
import { isTaskOverdue } from '@/lib/directorTaskHelpers';

export default function DirectorDashboard() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showVoiceGuide, setShowVoiceGuide] = useState(false);
  const [tab, setTab] = useState('open');
  const [projects, setProjects] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    const me = await base44.auth.me();
    setUser(me);
    const [allTasks, allProjects] = await Promise.all([
      base44.entities.DirectorTask.filter({ director_email: me.email }, '-created_date', 500),
      base44.entities.Project.filter({ director_email: me.email }, '-created_date', 200),
    ]);
    setTasks(allTasks);
    setProjects(allProjects);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Unique assignees
  const assignees = [...new Map(
    tasks.map(t => [t.assigned_to_email, { email: t.assigned_to_email, name: t.assigned_to_name }])
  ).values()];

  // Filtered
  const filtered = tasks.filter(t => {
    if (assigneeFilter !== 'all' && t.assigned_to_email !== assigneeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.task_name?.toLowerCase().includes(q) || t.assigned_to_name?.toLowerCase().includes(q) ||
        t.task_number?.toLowerCase().includes(q);
    }
    return true;
  });

  const openTasks = filtered.filter(t => t.status === 'open');
  const dateChangeTasks = filtered.filter(t => t.status === 'date_change_requested');
  const verifyTasks = filtered.filter(t => t.status === 'pending_verification');
  const completedTasks = filtered.filter(t => t.status === 'completed');
  const cancelledTasks = filtered.filter(t => t.status === 'cancelled');
  const allPending = [...openTasks, ...dateChangeTasks, ...verifyTasks];
  const overdueTasks = allPending.filter(t => isTaskOverdue(t));

  const sortByUrgency = (list) => [...list].sort((a, b) => {
    const aOD = isTaskOverdue(a) ? 0 : 1;
    const bOD = isTaskOverdue(b) ? 0 : 1;
    if (aOD !== bOD) return aOD - bOD;
    const aImp = a.is_important ? 0 : 1;
    const bImp = b.is_important ? 0 : 1;
    return aImp - bImp;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12 p-3 md:p-4 lg:p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Director Task Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            All tasks you have assigned — track status, approvals, and deadlines
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowVoiceGuide(v => !v)} className="h-11 px-3 gap-2">
            <Smartphone className="w-4 h-4" /> Voice Shortcut
          </Button>
          <Button variant="outline" onClick={() => setShowCreateProject(true)} className="h-11 px-4 gap-2">
            <Layers className="w-4 h-4" /> New Project
          </Button>
          <Button onClick={() => setShowCreate(true)} className="h-11 px-4 gap-2">
            <Plus className="w-4 h-4" /> Assign New Task
          </Button>
        </div>
      </div>

      {/* Voice Shortcut Guide */}
      {showVoiceGuide && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 lg:p-6">
          <VoiceShortcutGuide />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : (
        <>
          {/* Summary Counters */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{overdueTasks.length}</p>
              <p className="text-xs text-red-400 font-medium mt-0.5">Overdue</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{openTasks.length}</p>
              <p className="text-xs text-blue-400 font-medium mt-0.5">Open</p>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">{dateChangeTasks.length}</p>
              <p className="text-xs text-orange-400 font-medium mt-0.5">Date Change</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-yellow-600">{verifyTasks.length}</p>
              <p className="text-xs text-yellow-400 font-medium mt-0.5">Verify</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{completedTasks.length}</p>
              <p className="text-xs text-green-400 font-medium mt-0.5">Done</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-52 h-11 md:h-9">
                <SelectValue placeholder="All Assignees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {assignees.map(a => (
                  <SelectItem key={a.email} value={a.email}>{a.name || a.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input className="pl-9 h-11 md:h-9" placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="projects" className="text-xs sm:text-sm gap-1">
                <Layers className="w-3.5 h-3.5 hidden sm:block" />
                Projects ({projects.filter(p => p.status !== 'completed' && p.status !== 'cancelled').length})
              </TabsTrigger>
              <TabsTrigger value="open" className="text-xs sm:text-sm">
                Open ({openTasks.length})
              </TabsTrigger>
              <TabsTrigger value="date_change" className="text-xs sm:text-sm">
                Date Change ({dateChangeTasks.length})
              </TabsTrigger>
              <TabsTrigger value="verify" className="text-xs sm:text-sm">
                Verify ({verifyTasks.length})
              </TabsTrigger>
              <TabsTrigger value="done" className="text-xs sm:text-sm">
                Done ({completedTasks.length})
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="text-xs sm:text-sm">
                Cancelled ({cancelledTasks.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="projects" className="mt-4">
              {projects.filter(p => p.status !== 'completed' && p.status !== 'cancelled').length === 0 ? (
                <div className="text-center py-12">
                  <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">No active projects. Click "New Project" to create one.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.filter(p => p.status !== 'completed' && p.status !== 'cancelled').map(p => (
                    <ProjectCard key={p.id} project={p} user={user} onRefresh={load} />
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="open" className="mt-4">
              <TaskSection tasks={sortByUrgency(openTasks)} user={user} onRefresh={load} />
            </TabsContent>
            <TabsContent value="date_change" className="mt-4">
              <TaskSection tasks={sortByUrgency(dateChangeTasks)} user={user} onRefresh={load} />
            </TabsContent>
            <TabsContent value="verify" className="mt-4">
              <TaskSection tasks={sortByUrgency(verifyTasks)} user={user} onRefresh={load} />
            </TabsContent>
            <TabsContent value="done" className="mt-4">
              <TaskSection tasks={completedTasks} user={user} onRefresh={load} />
            </TabsContent>
            <TabsContent value="cancelled" className="mt-4">
              <TaskSection tasks={cancelledTasks} user={user} onRefresh={load} />
            </TabsContent>
          </Tabs>
        </>
      )}

      {showCreate && user && (
        <CreateDirectorTaskModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          user={user}
          directorEmail={user.email}
          directorName={user.full_name}
          onCreated={load}
        />
      )}

      {showCreateProject && user && (
        <ProjectFormModal
          open={showCreateProject}
          onClose={() => setShowCreateProject(false)}
          user={user}
          directorEmail={user.email}
          directorName={user.full_name}
          onCreated={load}
        />
      )}
    </div>
  );
}

function TaskSection({ tasks, user, onRefresh }) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-slate-400 text-sm">No tasks here</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {tasks.map(t => (
        <DirectorTaskCard key={t.id} task={t} user={user} viewMode="director" onRefresh={onRefresh} />
      ))}
    </div>
  );
}