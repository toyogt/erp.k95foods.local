import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TaskGroupManager from '@/components/tasks/TaskGroupManager';
import TaskTemplateManager from '@/components/tasks/TaskTemplateManager';
import ScheduledTaskMonitor from '@/components/tasks/ScheduledTaskMonitor';
import { Loader2, FolderOpen, Clock, BarChart3 } from 'lucide-react';

export default function ScheduledTaskManager() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [instances, setInstances] = useState([]);
  const [users, setUsers] = useState([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [u, g, t, i, allUsers] = await Promise.all([
      base44.auth.me().catch(() => null),
      base44.entities.ScheduledTaskGroup.list('-created_date', 200),
      base44.entities.ScheduledTaskTemplate.list('-created_date', 500),
      base44.entities.ScheduledTaskInstance.list('-created_date', 200),
      base44.entities.User.list('-created_date', 200),
    ]);
    setUser(u);
    setGroups(g);
    setTemplates(t);
    setInstances(i);
    setUsers(allUsers);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, []);

  const reloadGroups = useCallback(async () => {
    const g = await base44.entities.ScheduledTaskGroup.list('-created_date', 200);
    setGroups(g);
  }, []);

  const reloadTemplates = useCallback(async () => {
    const t = await base44.entities.ScheduledTaskTemplate.list('-created_date', 500);
    setTemplates(t);
  }, []);

  const reloadInstances = useCallback(async () => {
    const i = await base44.entities.ScheduledTaskInstance.list('-created_date', 200);
    setInstances(i);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const isCoordinator = groups.some(g => g.coordinator_email === user?.email);
  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Scheduled Tasks</h1>
        <p className="text-sm text-slate-500">Manage recurring time-based tasks with groups and process coordinators</p>
      </div>

      <Tabs defaultValue="monitor" className="w-full">
        <TabsList className="h-11 rounded-xl bg-slate-100 p-1">
          <TabsTrigger value="monitor" className="rounded-lg text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 gap-1.5">
            <BarChart3 className="w-4 h-4" /> Task Monitor
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="groups" className="rounded-lg text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 gap-1.5">
                <FolderOpen className="w-4 h-4" /> Groups
              </TabsTrigger>
              <TabsTrigger value="templates" className="rounded-lg text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 gap-1.5">
                <Clock className="w-4 h-4" /> Recurring Tasks
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="monitor" className="mt-4">
          <ScheduledTaskMonitor
            instances={instances}
            groups={groups}
            user={user}
            onRefresh={reloadInstances}
          />
        </TabsContent>

        {isAdmin && (
          <>
            <TabsContent value="groups" className="mt-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-5">
                <TaskGroupManager groups={groups} users={users} onSaved={reloadGroups} />
              </div>
            </TabsContent>
            <TabsContent value="templates" className="mt-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-5">
                <TaskTemplateManager templates={templates} groups={groups.filter(g => g.is_active)} users={users} onSaved={reloadTemplates} />
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}