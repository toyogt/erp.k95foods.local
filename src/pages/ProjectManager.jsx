import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2, Plus, Search, Layers, FolderOpen, CheckCircle2, Clock, AlertTriangle
} from 'lucide-react';
import { getDirectorsForEA } from '@/lib/directorTaskHelpers';
import ProjectCard from '@/components/tasks/ProjectCard';
import ProjectFormModal from '@/components/tasks/ProjectFormModal';
import moment from 'moment';

function isProjectOverdue(project) {
  if (!project.end_date || project.status === 'completed' || project.status === 'cancelled') return false;
  return moment(project.end_date, 'DD/MM/YYYY').endOf('day').isBefore(moment());
}

export default function ProjectManager() {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [directors, setDirectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [directorFilter, setDirectorFilter] = useState('all');
  const [tab, setTab] = useState('active');
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const me = await base44.auth.me();
    setUser(me);

    let directorList = [];
    if (me.role === 'admin') {
      directorList = [{ email: me.email, name: me.full_name }];
      const eaMappings = await getDirectorsForEA(me.email);
      eaMappings.forEach(d => {
        if (!directorList.find(x => x.email === d.email)) directorList.push(d);
      });
    } else {
      directorList = await getDirectorsForEA(me.email);
      // Also check if this user is a director themselves (has projects)
      const ownProjects = await base44.entities.Project.filter({ director_email: me.email }, '-created_date', 5);
      if (ownProjects.length > 0 && !directorList.find(d => d.email === me.email)) {
        directorList.unshift({ email: me.email, name: me.full_name });
      }
    }
    setDirectors(directorList);

    const directorEmails = directorList.map(d => d.email);
    let allProjects = [];
    for (const email of directorEmails) {
      const dp = await base44.entities.Project.filter({ director_email: email }, '-created_date', 200);
      allProjects = [...allProjects, ...dp];
    }
    const seen = new Set();
    allProjects = allProjects.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    setProjects(allProjects);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = projects.filter(p => {
    if (directorFilter !== 'all' && p.director_email !== directorFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.project_name?.toLowerCase().includes(q) ||
        p.project_number?.toLowerCase().includes(q) ||
        p.project_description?.toLowerCase().includes(q);
    }
    return true;
  });

  const activeProjects = filtered.filter(p => ['planned', 'in_progress', 'on_hold'].includes(p.status));
  const completedProjects = filtered.filter(p => p.status === 'completed');
  const cancelledProjects = filtered.filter(p => p.status === 'cancelled');
  const overdueProjects = activeProjects.filter(p => isProjectOverdue(p));

  const createDirector = directors.length === 1 ? directors[0]
    : directorFilter !== 'all' ? directors.find(d => d.email === directorFilter)
    : directors[0];

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12 p-3 md:p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage project-based delegation with dependent task chains
          </p>
        </div>
        {createDirector && (
          <Button onClick={() => setShowCreate(true)} className="h-11 px-4 gap-2">
            <Plus className="w-4 h-4" /> New Project
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : directors.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No projects access</p>
          <p className="text-slate-400 text-sm mt-1">You need to be mapped to a director to manage projects</p>
        </div>
      ) : (
        <>
          {/* Counters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{activeProjects.length}</p>
              <p className="text-xs text-blue-400 font-medium mt-0.5">Active</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{overdueProjects.length}</p>
              <p className="text-xs text-red-400 font-medium mt-0.5">Overdue</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{completedProjects.length}</p>
              <p className="text-xs text-green-400 font-medium mt-0.5">Completed</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-slate-600">{projects.length}</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Total</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            {directors.length > 1 && (
              <Select value={directorFilter} onValueChange={setDirectorFilter}>
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
              <Input className="pl-9 h-11 md:h-9" placeholder="Search projects…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="active" className="gap-1.5 text-xs sm:text-sm">
                <Layers className="w-3.5 h-3.5 hidden sm:block" />
                Active ({activeProjects.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="gap-1.5 text-xs sm:text-sm">
                <CheckCircle2 className="w-3.5 h-3.5 hidden sm:block" />
                Done ({completedProjects.length})
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="text-xs sm:text-sm">
                Cancelled ({cancelledProjects.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4">
              <ProjectList projects={activeProjects} user={user} onRefresh={load} emptyText="No active projects" />
            </TabsContent>
            <TabsContent value="completed" className="mt-4">
              <ProjectList projects={completedProjects} user={user} onRefresh={load} emptyText="No completed projects yet" />
            </TabsContent>
            <TabsContent value="cancelled" className="mt-4">
              <ProjectList projects={cancelledProjects} user={user} onRefresh={load} emptyText="No cancelled projects" />
            </TabsContent>
          </Tabs>
        </>
      )}

      {showCreate && createDirector && (
        <ProjectFormModal
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

function ProjectList({ projects, user, onRefresh, emptyText }) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <FolderOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-slate-400 text-sm">{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {projects.map(p => (
        <ProjectCard key={p.id} project={p} user={user} onRefresh={onRefresh} />
      ))}
    </div>
  );
}