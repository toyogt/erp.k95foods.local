import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import OfflineProvider, { OfflineBanner } from '@/components/OfflineProvider';
import { MODULES, getModuleForPage, getVisibleModules, getVisiblePages } from '@/components/nav/moduleConfig';
import { ChevronLeft, Factory, LogOut, X, ChevronDown, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [moduleMenuOpen, setModuleMenuOpen] = useState(null); // key of open module dropdown
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    base44.auth.me()
      .then(u => { setUser(u); setUserLoading(false); })
      .catch(() => setUserLoading(false));
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [currentPageName]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setModuleMenuOpen(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const role = user?.role || 'user';
  const isAdmin = role === 'admin';
  const isFGOnly = role === 'warehouse';

  // Redirect FG-only users to FGWarehouse
  useEffect(() => {
    if (!userLoading && isFGOnly && currentPageName !== 'FGWarehouse') {
      window.location.replace(createPageUrl('FGWarehouse'));
    }
  }, [userLoading, isFGOnly, currentPageName]);

  if (userLoading) return null;

  if (isFGOnly) return (
    <OfflineProvider>
      <div className="min-h-screen bg-slate-50">
        <OfflineBanner />
        <main className="max-w-screen-2xl mx-auto px-4 py-5 pb-24">{children}</main>
      </div>
    </OfflineProvider>
  );

  const visibleModules = getVisibleModules(role);
  const activeModule = getModuleForPage(currentPageName);
  const isDashboard = currentPageName === 'Dashboard';
  const fromPage = new URLSearchParams(window.location.search).get('from');

  // Pages in the active module (for the sub-nav bar)
  const activeModulePages = activeModule ? getVisiblePages(activeModule, role) : [];

  // Back destination — go to Dashboard if no from param, not on dashboard
  const backTo = fromPage ? createPageUrl(fromPage) : createPageUrl('Dashboard');

  return (
    <OfflineProvider>
      <div className="min-h-screen bg-slate-50 overflow-x-hidden max-w-full">
        <style>{`
          :root { --factory-primary: #0f172a; }
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; -webkit-font-smoothing: antialiased; }
          * { -webkit-tap-highlight-color: transparent; }
          input, select, textarea { font-size: 16px !important; }
        `}</style>
        <OfflineBanner />

        {/* ── TOP NAV BAR ─────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
          {/* Row 1: Brand + Module Tabs + User */}
          <div className="max-w-screen-2xl mx-auto flex items-center gap-0 px-3 h-14">

            {/* Brand / Back button */}
            <div className="flex items-center gap-2 shrink-0 mr-4">
              {!isDashboard ? (
                <Link to={backTo} className="w-10 h-10 -ml-1 rounded-xl hover:bg-slate-100 active:bg-slate-200 flex items-center justify-center transition-colors">
                  <ChevronLeft className="w-6 h-6 text-slate-700" />
                </Link>
              ) : null}
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                  <Factory className="w-4 h-4 text-white" />
                </div>
                <span className="hidden sm:block font-bold text-slate-900 text-sm leading-tight tracking-tight">K95</span>
              </Link>
            </div>

            {/* ── Desktop module tabs ─────────────────────────────── */}
            <nav ref={dropdownRef} className="hidden md:flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-hide">
              {/* Dashboard tab */}
              <Link
                to={createPageUrl('Dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  isDashboard ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>

              {visibleModules.filter(m => m.key !== 'DASHBOARD').map(mod => {
                const Icon = mod.icon;
                const isActive = activeModule?.key === mod.key;
                const isOpen = moduleMenuOpen === mod.key;
                const pages = getVisiblePages(mod, role);

                return (
                  <div key={mod.key} className="relative">
                    <button
                      onClick={() => setModuleMenuOpen(isOpen ? null : mod.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                        isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {mod.label}
                      <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown */}
                    {isOpen && (
                      <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl border border-slate-200 shadow-lg z-50 py-1.5 overflow-hidden">
                        {pages.map(page => {
                          const PIcon = page.icon;
                          const pageActive = currentPageName === page.key;
                          return (
                            <Link
                              key={page.key}
                              to={createPageUrl(page.key)}
                              onClick={() => setModuleMenuOpen(null)}
                              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                                pageActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <PIcon className="w-4 h-4 shrink-0" />
                              {page.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* ── Right side: user + mobile menu btn ─────────────── */}
            <div className="flex items-center gap-2 ml-auto shrink-0">
              {user && (
                <div className="hidden md:flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium max-w-[120px] truncate">{user.full_name || user.email}</span>
                  <button
                    onClick={() => base44.auth.logout()}
                    className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
                    title="Sign out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Mobile hamburger */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden w-11 h-11 rounded-xl hover:bg-slate-100 active:bg-slate-200 flex items-center justify-center transition-colors"
              >
                {mobileMenuOpen
                  ? <X className="w-6 h-6 text-slate-700" />
                  : <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                }
              </button>
            </div>
          </div>

          {/* Row 2: Sub-nav bar (current module's pages) — desktop only */}
          {activeModule && activeModulePages.length > 0 && (
            <div className="hidden md:block border-t border-slate-100 bg-slate-50">
              <div className="max-w-screen-2xl mx-auto px-4 flex items-center gap-1 h-10 overflow-x-auto scrollbar-hide">
                <span className={`text-xs font-semibold mr-2 ${activeModule.color}`}>{activeModule.label} /</span>
                {activeModulePages.map(page => {
                  const PIcon = page.icon;
                  const isActive = currentPageName === page.key;
                  return (
                    <Link
                      key={page.key}
                      to={createPageUrl(page.key)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                        isActive
                          ? `${activeModule.bgColor} ${activeModule.color} font-semibold`
                          : 'text-slate-500 hover:bg-white hover:text-slate-800'
                      }`}
                    >
                      <PIcon className="w-3.5 h-3.5" />
                      {page.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Mobile full-screen menu ──────────────────────────────────── */}
          {mobileMenuOpen && (
            <div className="md:hidden absolute top-14 left-0 right-0 bg-white border-b border-slate-200 shadow-xl z-50 max-h-[85vh] overflow-y-auto">
              <div className="p-3 space-y-0.5">
                {/* Dashboard */}
                <Link
                  to={createPageUrl('Dashboard')}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isDashboard ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                >
                  <LayoutDashboard className="w-5 h-5" />
                  <span className="font-medium text-sm">Dashboard</span>
                </Link>

                {/* Modules */}
                {visibleModules.filter(m => m.key !== 'DASHBOARD').map(mod => {
                  const Icon = mod.icon;
                  const pages = getVisiblePages(mod, role);
                  const isModActive = activeModule?.key === mod.key;

                  return (
                    <div key={mod.key}>
                      <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl mt-1 ${isModActive ? mod.bgColor : ''}`}>
                        <Icon className={`w-4 h-4 ${mod.color}`} />
                        <span className={`font-semibold text-xs uppercase tracking-wider ${mod.color}`}>{mod.label}</span>
                      </div>
                      <div className="ml-3 pl-3 border-l-2 border-slate-100 space-y-0.5">
                        {pages.map(page => {
                          const PIcon = page.icon;
                          const pageActive = currentPageName === page.key;
                          return (
                            <Link
                              key={page.key}
                              to={createPageUrl(page.key)}
                              onClick={() => setMobileMenuOpen(false)}
                              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                                pageActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <PIcon className="w-4 h-4" />
                              <span className="font-medium text-sm">{page.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Sign out */}
                {user && (
                  <div className="border-t border-slate-100 pt-2 mt-2">
                    <div className="px-4 py-2 text-xs text-slate-400">{user.full_name || user.email}</div>
                    <button
                      onClick={() => base44.auth.logout()}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 w-full transition-all"
                    >
                      <LogOut className="w-5 h-5" />
                      <span className="font-medium text-sm">Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </header>

        <main className="max-w-screen-2xl mx-auto px-4 py-5 pb-24">{children}</main>
      </div>
    </OfflineProvider>
  );
}