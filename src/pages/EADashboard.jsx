import { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2, Plus, ClipboardList,
  CheckCircle2, Clock, User, Layers, CalendarClock
} from 'lucide-react';
import CreateDirectorTaskModal from '@/components/tasks/CreateDirectorTaskModal';
import DirectorTaskCard from '@/components/tasks/DirectorTaskCard';
import ProjectFormModal from '@/components/tasks/ProjectFormModal';
import ProjectCard from '@/components/tasks/ProjectCard';
import { getDirectorsForEA, isTaskOverdue } from '@/lib/directorTaskHelpers';
import { canEAManageTask } from '@/lib/eaPermissions';
import EADashboardFilters, { applyFilters } from '@/components/tasks/EADashboardFilters';

export default function EADashboard() {
  const [user, setUser] = useState(null);
  const [directors, setDirectors] = useState([]);
  const [selectedDirector, setSelectedDirector] = useState('all');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [tab, setTab] = useState('pending');
  const [projects, setProjects] = useState([]);
  const [projectTaskStats, setProjectTaskStats] = useState({});
  const [supportedDirectorEmails, setSupportedDirectorEmails] = useState([]);
  const [advancedFilters, setAdvancedFilters] = useState({
    assignee: 'all', datePreset: 'all', importantOnly: false, overdueOnly: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const me = await base44.auth.me();
    setUser(me);

    let directorList = [];
    const isAdmin = me.role === 'admin';

    if (isAdmin) {
      directorList = [{ email: me.email, name: me.full_name }];
      const eaMappings = await getDirectorsForEA(me.email);
      eaMappings.forEach(d => {
        if (!directorList.find(x => x.email === d.email)) directorList.push(d);
      });
    } else {
      directorList = await getDirectorsForEA(me.email);
    }
    setDirectors(directorList);
    const directorEmails = directorList.map(d => d.email);
    setSupportedDirectorEmails(directorEmails);

    let allTasks = [];
    let allProjects = [];
    for (const email of directorEmails) {
      const [dt, dp] = await Promise.all([
        base44.entities.DirectorTask.filter({ director_email: email }, '-created_date', 200),
        base44.entities.Project.filter({ director_email: email }, '-created_date', 100),
      ]);
      allTasks = [...allTasks, ...dt];
      allProjects = [...allProjects, ...dp];
    }

    const seen = new Set();
    allTasks = allTasks.filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });
    const seenP = new Set();
    allProjects = allProjects.filter(p => { if (seenP.has(p.id)) return false; seenP.add(p.id); return true; });

    setTasks(allTasks);
    setProjects(allProjects);

    const stats = {};
    allProjects.forEach(p => { stats[p.id] = { total: 0, completed: 0 }; });
    allTasks.forEach(t => {
      if (t.project_id && stats[t.project_id] !== undefined) {
        stats[t.project_id].total += 1;
        if (t.status === 'completed') stats[t.project_id].completed += 1;
      }
    });
    setProjectTaskStats(stats);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Build assignee list from tasks
  const assignees = useMemo(() => {
    const map = new Map();
    tasks.forEach(t => {
      if (t.assigned_to_email && !map.has(t.assigned_to_email)) {
        map.set(t.assigned_to_email, { email: t.assigned_to_email, name: t.assigned_to_name || t.assigned_to_email });
      }
    });
    return Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [tasks]);

  // Apply all filters
  const filtered = useMemo(() => {
    return applyFilters(tasks, {
      search,
      director: selectedDirector,
      ...advancedFilters,
    });
  }, [tasks, search, selectedDirector, advancedFilters]);

  const pendingTasks = filtered.filter(t => t.status === 'open');
  const dateChangeRequests = filtered.filter(t => t.status === 'date_change_requested');
  const verificationTasks = filtered.filter(t => t.status === 'pending_verification');
  const completedTasks = filtered.filter(t => t.status === 'completed');
  const cancelledTasks = filtered.filter(t => t.status === 'cancelled');
  const overdueTasks = filtered.filter(t => ['open', 'date_change_requested'].includes(t.status) && isTaskOverdue(t));
  const importantOpen = filtered.filter(t => t.is_important && !['completed', 'cancelled'].includes(t.status));

  const createDirector = directors.length === 1 ? directors[0]
    : selectedDirector !== 'all' ? directors.find(d => d.email === selectedDirector)
    : directors[0];

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12 p-3 md:p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Executive Assistant Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage tasks for {directors.length === 1 ? directors[0]?.name : `${directors.length} directors`}
          </p>
        </div>
        {createDirector && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCreateProject(true)} className="h-11 px-4 gap-2">
              <Layers className="w-4 h-4" /> New Project
            </Button>
            <Button onClick={() => setShowCreate(true)} className="h-11 px-4 gap-2">
              <Plus className="w-4 h-4" /> Assign Task
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : directors.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No Directors Assigned</p>
          <p className="text-slate-400 text-sm mt-1">Ask your admin to map you to a director in User Management</p>
        </div>
      ) : (
        <>
          {/* Counters */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
              <p className="text-3xl font-bold text-red-600">{overdueTasks.length}</p>
              <p className="text-sm text-red-400 font-medium mt-1">Overdue</p>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-center">
              <p className="text-3xl font-bold text-orange-600">{dateChangeRequests.length}</p>
              <p className="text-sm text-orange-400 font-medium mt-1">Date Change</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4 text-center">
              <p className="text-3xl font-bold text-yellow-600">{verificationTasks.length}</p>
              <p className="text-sm text-yellow-500 font-medium mt-1">Needs Verification</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{importantOpen.length}</p>
              <p className="text-sm text-blue-400 font-medium mt-1">Important Open</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{completedTasks.length}</p>
              <p className="text-sm text-green-500 font-medium mt-1">Completed</p>
            </div>
          </div>

          {/* Filters */}
          <EADashboardFilters
            search={search}
            onSearchChange={setSearch}
            directors={directors}
            selectedDirector={selectedDirector}
            onDirectorChange={setSelectedDirector}
            assignees={assignees}
            filters={advancedFilters}
            onFiltersChange={setAdvancedFilters}
          />

          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="projects" className="gap-1.5 text-xs sm:text-sm">
                <Layers className="w-3.5 h-3.5 hidden sm:block" />
                Projects ({projects.filter(p => p.status !== 'completed' && p.status !== 'cancelled').length})
              </TabsTrigger>
              <TabsTrigger value="pending" className="gap-1.5 text-xs sm:text-sm">
                <ClipboardList className="w-3.5 h-3.5 hidden sm:block" />
                Open ({pendingTasks.length})
              </TabsTrigger>
              <TabsTrigger value="date_change" className="gap-1.5 text-xs sm:text-sm">
                <CalendarClock className="w-3.5 h-3.5 hidden sm:block" />
                Date Change ({dateChangeRequests.length})
              </TabsTrigger>
              <TabsTrigger value="verification" className="gap-1.5 text-xs sm:text-sm">
                <Clock className="w-3.5 h-3.5 hidden sm:block" />
                Verify ({verificationTasks.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="gap-1.5 text-xs sm:text-sm">
                <CheckCircle2 className="w-3.5 h-3.5 hidden sm:block" />
                Done ({completedTasks.length})
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="text-xs sm:text-sm">
                Cancelled ({cancelledTasks.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="projects" className="mt-4">
              {projects.filter(p => p.status !== 'completed' && p.status !== 'cancelled').length === 0 ? (
                <EmptyState text="No active projects. Create a project to group related tasks." />
              ) : (
                <div className="space-y-3">
                  {projects.filter(p => p.status !== 'completed' && p.status !== 'cancelled').map(p => (
                    <ProjectCard key={p.id} project={p} user={user} onRefresh={load} taskStats={projectTaskStats[p.id]} />
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="pending" className="mt-4">
              <TaskList tasks={pendingTasks} user={user} viewMode="ea" onRefresh={load} supportedDirectorEmails={supportedDirectorEmails} />
            </TabsContent>
            <TabsContent value="date_change" className="mt-4">
              {dateChangeRequests.length === 0 ? (
                <EmptyState text="No date change requests pending" />
              ) : (
                <div className="space-y-3">
                  {dateChangeRequests.map(t => (
                    <DirectorTaskCard key={t.id} task={t} user={user} viewMode="ea" onRefresh={load} supportedDirectorEmails={supportedDirectorEmails} />
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="verification" className="mt-4">
              {verificationTasks.length === 0 ? (
                <EmptyState text="No tasks pending verification" />
              ) : (
                <div className="space-y-3">
                  {verificationTasks.map(t => (
                    <DirectorTaskCard key={t.id} task={t} user={user} viewMode="ea" onRefresh={load} supportedDirectorEmails={supportedDirectorEmails} />
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="completed" className="mt-4">
              <TaskList tasks={completedTasks} user={user} viewMode="ea" onRefresh={load} supportedDirectorEmails={supportedDirectorEmails} />
            </TabsContent>
            <TabsContent value="cancelled" className="mt-4">
              <TaskList tasks={cancelledTasks} user={user} viewMode="ea" onRefresh={load} supportedDirectorEmails={supportedDirectorEmails} />
            </TabsContent>
          </Tabs>
        </>
      )}

      {showCreate && createDirector && (
        <CreateDirectorTaskModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          user={user}
          directorEmail={createDirector.email}
          directorName={createDirector.name}
          onCreated={load}
        />
      )}

      {showCreateProject && createDirector && (
        <ProjectFormModal
          open={showCreateProject}
          onClose={() => setShowCreateProject(false)}
          user={user}
          directorEmail={createDirector.email}
          directorName={createDirector.name}
          onCreated={load}
        />
      )}
    </div>
  );
}

function TaskList({ tasks, user, viewMode, onRefresh, supportedDirectorEmails }) {
  if (tasks.length === 0) return <EmptyState text="No tasks here" />;

  const sorted = [...tasks].sort((a, b) => {
    const aOD = isTaskOverdue(a) ? 0 : 1;
    const bOD = isTaskOverdue(b) ? 0 : 1;
    if (aOD !== bOD) return aOD - bOD;
    const aImp = a.is_important ? 0 : 1;
    const bImp = b.is_important ? 0 : 1;
    if (aImp !== bImp) return aImp - bImp;
    return 0;
  });

  return (
    <div className="space-y-3">
      {sorted.map(t => (
        <DirectorTaskCard key={t.id} task={t} user={user} viewMode={viewMode} onRefresh={onRefresh} supportedDirectorEmails={supportedDirectorEmails} />
      ))}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="text-center py-12">
      <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-2" />
      <p className="text-slate-400 text-sm">{text}</p>
    </div>
  );
}