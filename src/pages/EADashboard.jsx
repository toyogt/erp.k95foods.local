import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2, Plus, Search, ClipboardList, AlertTriangle,
  CheckCircle2, Clock, CalendarClock, User
} from 'lucide-react';
import CreateDirectorTaskModal from '@/components/tasks/CreateDirectorTaskModal';
import DirectorTaskCard from '@/components/tasks/DirectorTaskCard';
import DirectorTaskLogPanel from '@/components/tasks/DirectorTaskLogPanel';
import { getDirectorsForEA, isTaskOverdue } from '@/lib/directorTaskHelpers';

export default function EADashboard() {
  const [user, setUser] = useState(null);
  const [directors, setDirectors] = useState([]);
  const [selectedDirector, setSelectedDirector] = useState('all');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState('pending');
  const [selectedTaskLog, setSelectedTaskLog] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const me = await base44.auth.me();
    setUser(me);

    // Get directors this EA serves
    let directorList = [];
    const isAdmin = me.role === 'admin';

    if (isAdmin) {
      // Admins (directors) see their own tasks
      directorList = [{ email: me.email, name: me.full_name }];
      // Also check if they have EA mappings (they might be managing other directors)
      const eaMappings = await getDirectorsForEA(me.email);
      eaMappings.forEach(d => {
        if (!directorList.find(x => x.email === d.email)) {
          directorList.push(d);
        }
      });
    } else {
      directorList = await getDirectorsForEA(me.email);
    }
    setDirectors(directorList);

    // Fetch tasks for all directors
    const directorEmails = directorList.map(d => d.email);
    let allTasks = [];
    for (const email of directorEmails) {
      const dt = await base44.entities.DirectorTask.filter({ director_email: email }, '-created_date', 200);
      allTasks = [...allTasks, ...dt];
    }
    // Deduplicate by id
    const seen = new Set();
    allTasks = allTasks.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    setTasks(allTasks);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filter tasks
  const filtered = tasks.filter(t => {
    if (selectedDirector !== 'all' && t.director_email !== selectedDirector) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.task_name?.toLowerCase().includes(q) && !t.assigned_to_name?.toLowerCase().includes(q) &&
          !t.task_number?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const pendingTasks = filtered.filter(t => ['open', 'date_change_requested'].includes(t.status));
  const verificationTasks = filtered.filter(t => t.status === 'pending_verification');
  const completedTasks = filtered.filter(t => t.status === 'completed');
  const overdueTasks = pendingTasks.filter(t => isTaskOverdue(t));
  const importantOpen = pendingTasks.filter(t => t.is_important && t.status !== 'completed');

  // For creating tasks — use first director if only one, otherwise user picks
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
          <Button onClick={() => setShowCreate(true)} className="h-11 px-4 gap-2">
            <Plus className="w-4 h-4" /> Assign Task
          </Button>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{overdueTasks.length}</p>
              <p className="text-xs text-red-400 font-medium mt-0.5">Overdue</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-yellow-600">{verificationTasks.length}</p>
              <p className="text-xs text-yellow-400 font-medium mt-0.5">Pending Verification</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{importantOpen.length}</p>
              <p className="text-xs text-blue-400 font-medium mt-0.5">Important Open</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{completedTasks.length}</p>
              <p className="text-xs text-green-400 font-medium mt-0.5">Completed</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            {directors.length > 1 && (
              <Select value={selectedDirector} onValueChange={setSelectedDirector}>
                <SelectTrigger className="w-48 h-11 md:h-9">
                  <SelectValue placeholder="All Directors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Directors</SelectItem>
                  {directors.map(d => (
                    <SelectItem key={d.email} value={d.email}>{d.name || d.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input className="pl-9 h-11 md:h-9" placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="pending" className="gap-1.5">
                <ClipboardList className="w-3.5 h-3.5" />
                Open ({pendingTasks.length})
              </TabsTrigger>
              <TabsTrigger value="verification" className="gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Verify ({verificationTasks.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Done ({completedTasks.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4">
              <TaskList tasks={pendingTasks} user={user} viewMode="ea" onRefresh={load} />
            </TabsContent>
            <TabsContent value="verification" className="mt-4">
              {verificationTasks.length === 0 ? (
                <EmptyState text="No tasks pending verification" />
              ) : (
                <div className="space-y-3">
                  {verificationTasks.map(t => (
                    <DirectorTaskCard key={t.id} task={t} user={user} viewMode="ea" onRefresh={load} />
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="completed" className="mt-4">
              <TaskList tasks={completedTasks} user={user} viewMode="ea" onRefresh={load} />
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Create Task Modal */}
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
    </div>
  );
}

function TaskList({ tasks, user, viewMode, onRefresh }) {
  if (tasks.length === 0) return <EmptyState text="No tasks here" />;

  // Sort: overdue first, then important, then by end date
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
        <DirectorTaskCard key={t.id} task={t} user={user} viewMode={viewMode} onRefresh={onRefresh} />
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