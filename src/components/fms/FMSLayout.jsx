import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, GitBranch, PlayCircle, MonitorDot, Users, ChevronRight, Settings2 } from 'lucide-react';

const NAV = [
  { label: 'My Tasks',    path: '/FMSMyTasks',     icon: LayoutDashboard, roles: ['admin','process_designer','process_controller','user'] },
  { label: 'Processes',   path: '/FMSProcesses',   icon: GitBranch,       roles: ['admin','process_designer'] },
  { label: 'Active Runs', path: '/FMSActiveRuns',  icon: PlayCircle,      roles: ['admin','process_controller','process_designer'] },
  { label: 'Monitor',     path: '/FMSMonitor',     icon: MonitorDot,      roles: ['admin','process_controller'] },
  { label: 'Users',       path: '/FMSUsers',       icon: Users,           roles: ['admin'] },
];

export default function FMSLayout({ children, user }) {
  const loc = useLocation();
  const role = user?.role || 'user';

  const visibleNav = NAV.filter(n => n.roles.includes(role));

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-slate-900 text-white flex flex-col">
        <div className="px-5 py-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-blue-500 flex items-center justify-center">
              <Settings2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm text-white leading-tight">Process Flow</p>
              <p className="text-xs text-slate-400 leading-tight">Management System</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {visibleNav.map(item => {
            const Icon = item.icon;
            const active = loc.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}>
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="w-3 h-3" />}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-700">
          <div className="px-3 py-2 text-xs text-slate-500">
            <p className="font-medium text-slate-400">{user?.full_name || user?.email}</p>
            <p className="capitalize mt-0.5">{role.replace('_', ' ')}</p>
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}