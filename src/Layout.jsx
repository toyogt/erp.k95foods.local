import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import OfflineProvider, { OfflineBanner } from '@/components/OfflineProvider';
import { getVisibleModules, getVisiblePagesInModule, getModuleForPage, getAllPages } from '@/lib/registryConfig';
import { isOperatorLayout } from '@/lib/roleLayoutMap';
import OperatorLayout from '@/components/layouts/OperatorLayout';
import AccessDenied from '@/components/AccessDenied';
import { getAllowedPagesFromDB } from '@/lib/accessControl';
import { canAccessPage } from '@/lib/permissionResolver';
import PermissionDebugPanel from '@/components/admin/PermissionDebugPanel';
import {
  Factory, LogOut, X, ChevronDown, LayoutDashboard, Menu, ChevronRight
} from 'lucide-react';

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [roleModuleAccess, setRoleModuleAccess] = useState(null); // from DB AppRole
  const [allowedPages, setAllowedPages] = useState([]);          // allowed pages for this user
  const [sidebarOpen, setSidebarOpen] = useState(false);       // mobile drawer
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // desktop collapse
  const [expandedModules, setExpandedModules] = useState({});  // which modules are expanded

  useEffect(() => {
    base44.auth.me().then(async u => {
      setUser(u);
      if (u?.role) {
        // Load allowed pages from database
        const pages = await getAllowedPagesFromDB(u);
        setAllowedPages(pages);
        
        if (u.role !== 'admin') {
          // Load this user's role record to get module_access
          base44.entities.AppRole.filter({ role_key: u.role, is_active: true })
            .then(roles => {
              if (roles?.[0]?.module_access) setRoleModuleAccess(roles[0].module_access);
            })
            .catch(() => {});
        }
      }
      setUserLoading(false);
    }).catch(() => setUserLoading(false));
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [currentPageName]);

  // Auto-expand the active module
  useEffect(() => {
    const active = getModuleForPage(currentPageName);
    if (active) {
      setExpandedModules(prev => ({ ...prev, [active.moduleKey]: true }));
    }
  }, [currentPageName]);

  const role = user?.role || 'user';
  const isAdmin = role === 'admin';
  const isOperator = isOperatorLayout(role);
  const isDashboard = currentPageName === 'Dashboard';
  
  // Check if user has access to current page
  const canAccessDashboard = isAdmin || allowedPages.includes('*') || allowedPages.includes('Dashboard') || allowedPages.includes('SMSDashboard');
  const hasAccess = allowedPages.includes('*') || allowedPages.includes(currentPageName) || (isDashboard && canAccessDashboard);

  if (userLoading) return null;

  // Redirect from Dashboard to first allowed page for non-admin users
  // who don't have Dashboard access
  if (isDashboard && !isAdmin && !isOperator && allowedPages.length > 0 && !allowedPages.includes('*') && !allowedPages.includes('Dashboard')) {
    const firstPage = allowedPages[0];
    if (firstPage) {
      window.location.href = createPageUrl(firstPage);
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
        </div>
      );
    }
  }
  
  // Block access to unauthorized pages
  if (!hasAccess && !isOperator) {
    return <AccessDenied page={currentPageName} />;
  }

  // Operator roles (shop floor) get app-like layout, not sidebar
  if (isOperator) {
    return <OperatorLayout currentPageName={currentPageName} user={user}>{children}</OperatorLayout>;
  }

  // Get modules from database (AppRole.module_access) for non-admins, otherwise use registry
  const visibleModules = isAdmin 
    ? getVisibleModules(role) 
    : getVisibleModules(role).filter(m => roleModuleAccess?.includes(m.moduleKey));
  const activeModule = getModuleForPage(currentPageName);

  const toggleModule = (moduleKey) => {
    setExpandedModules(prev => ({ ...prev, [moduleKey]: !prev[moduleKey] }));
  };

  const SidebarContent = ({ onNavigate }) => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-slate-200 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
          <Factory className="w-4 h-4 text-white" />
        </div>
        {!sidebarCollapsed && (
          <span className="font-bold text-slate-900 text-sm tracking-tight">K95 ERP</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {/* Dashboard — only show if user has access */}
        {(isAdmin || allowedPages.includes('*') || allowedPages.includes('Dashboard')) && (
          <Link
            to={createPageUrl('Dashboard')}
            onClick={onNavigate}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isDashboard ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Dashboard</span>}
          </Link>
        )}

        {/* Module groups */}
        {visibleModules.filter(m => m.moduleKey !== 'DASHBOARD').map(mod => {
          const Icon = mod.icon;
          const pages = getVisiblePagesInModule(mod.moduleKey, role);
          
          // Filter pages by allowedPages (respects page_access overrides)
          const visiblePages = pages.filter(p => allowedPages.includes('*') || allowedPages.includes(p.pageKey));
          if (visiblePages.length === 0) return null; // Hide module if no pages visible
          const isActive = activeModule?.moduleKey === mod.moduleKey;
          const isExpanded = expandedModules[mod.moduleKey];

          return (
            <div key={mod.moduleKey}>
              <button
                onClick={() => !sidebarCollapsed && toggleModule(mod.moduleKey)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive && !isExpanded
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title={sidebarCollapsed ? mod.label : undefined}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? mod.color : ''}`} />
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 text-left">{mod.label}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform text-slate-400 ${isExpanded ? 'rotate-180' : ''}`} />
                  </>
                )}
              </button>

              {/* Sub-pages */}
              {!sidebarCollapsed && isExpanded && (
                <div className="ml-3 pl-3 border-l-2 border-slate-100 mt-0.5 space-y-0.5">
                  {visiblePages.map(page => {
                    const PIcon = page.icon;
                    const pageActive = currentPageName === page.pageKey;
                    return (
                      <Link
                        key={page.pageKey}
                        to={createPageUrl(page.pageKey)}
                        onClick={onNavigate}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                          pageActive
                            ? 'bg-slate-900 text-white font-medium'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <PIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{page.title}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User / Logout */}
      {user && (
        <div className="border-t border-slate-200 p-3 shrink-0">
          {!sidebarCollapsed && (
            <div className="px-2 py-1 text-xs text-slate-400 truncate mb-1">{user.full_name || user.email}</div>
          )}
          <button
            onClick={() => base44.auth.logout()}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all w-full ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
            title="Sign out"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <OfflineProvider>
      <div className="min-h-screen bg-slate-50 flex overflow-x-hidden">
        <style>{`
          :root { --factory-primary: #0f172a; }
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; -webkit-font-smoothing: antialiased; }
          * { -webkit-tap-highlight-color: transparent; }
          input, select, textarea { font-size: 16px !important; }
        `}</style>

        {/* ── Desktop Sidebar ──────────────────────────────────────────── */}
        <aside className={`hidden md:flex flex-col bg-white border-r border-slate-200 shrink-0 transition-all duration-200 ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        }`}>
          <SidebarContent onNavigate={() => {}} />
          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-10 bg-white border border-slate-200 rounded-r-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all z-30"
            style={{ left: sidebarCollapsed ? '3.5rem' : '14.5rem' }}
          >
            {sidebarCollapsed
              ? <ChevronRight className="w-3 h-3" />
              : <ChevronRight className="w-3 h-3 rotate-180" />
            }
          </button>
        </aside>

        {/* ── Mobile Overlay ───────────────────────────────────────────── */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/40 z-40"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Mobile Drawer ────────────────────────────────────────────── */}
        <div className={`md:hidden fixed top-0 left-0 h-full w-72 bg-white border-r border-slate-200 z-50 transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <SidebarContent onNavigate={() => setSidebarOpen(false)} />
        </div>

        {/* ── Main area ────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          <OfflineBanner />

          {/* Mobile top bar */}
          <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200 flex items-center gap-3 px-4 h-14 shadow-sm">
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-slate-100 active:bg-slate-200 transition-colors"
            >
              <Menu className="w-6 h-6 text-slate-700" />
            </button>
            <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center">
                <Factory className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-slate-900 text-sm">K95 ERP</span>
            </Link>
            {activeModule && (
              <span className={`ml-auto text-xs font-semibold ${activeModule.color}`}>
                {activeModule.label}
              </span>
            )}
          </header>

          <main className="flex-1 px-4 py-5 pb-24 max-w-screen-2xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>

      {/* Permission Debug Panel (super admin only) */}
      {isAdmin && <PermissionDebugPanel />}
    </OfflineProvider>
  );
}