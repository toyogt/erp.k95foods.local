import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Menu, LogOut, Home, ChevronLeft } from 'lucide-react';
import { OfflineProvider, OfflineBanner } from '@/components/OfflineProvider';

/**
 * OperatorLayout — Full-screen, app-like layout for shop floor workers
 * Bottom navigation, large tiles, no sidebar clutter
 * Used by: filling_operator, chamber_operator, labelling_supervisor, warehouse_ops, etc.
 */
export default function OperatorLayout({ children, currentPageName, user }) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <OfflineProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <style>{`
          :root { --factory-primary: #0f172a; }
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; -webkit-font-smoothing: antialiased; }
          * { -webkit-tap-highlight-color: transparent; }
          input, select, textarea { font-size: 16px !important; }
        `}</style>

        {/* ── Mobile Top Bar ──────────────────────────────────────────── */}
        <header className="bg-white border-b border-slate-200 flex items-center justify-between px-4 h-14 shadow-sm sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNavOpen(!navOpen)}
              className="w-11 h-11 rounded-lg flex items-center justify-center hover:bg-slate-100 active:bg-slate-200 transition-colors"
            >
              <Menu className="w-5 h-5 text-slate-700" />
            </button>
            <span className="font-bold text-slate-900 text-sm">K95 ERP</span>
          </div>
          <button
            onClick={() => base44.auth.logout()}
            className="w-11 h-11 rounded-lg flex items-center justify-center hover:bg-red-50 active:bg-red-100 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5 text-red-600" />
          </button>
        </header>

        {/* ── Nav Overlay ────────────────────────────────────────────── */}
        {navOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-30"
            onClick={() => setNavOpen(false)}
          />
        )}

        {/* ── Slide-in Nav ────────────────────────────────────────────── */}
        <div
          className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 z-40 transition-transform duration-200 ${
            navOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <span className="font-semibold text-slate-900">Menu</span>
            <button
              onClick={() => setNavOpen(false)}
              className="p-1 hover:bg-slate-100 rounded"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
          <nav className="p-3 space-y-1">
            <Link
              to="/Dashboard"
              onClick={() => setNavOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-900"
            >
              <Home className="w-4 h-4" />
              Home
            </Link>
          </nav>
          {user && (
            <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 p-3">
              <div className="text-xs text-slate-500 mb-2 truncate">{user.full_name || user.email}</div>
            </div>
          )}
        </div>

        {/* ── Main Content ────────────────────────────────────────────── */}
        <main className="flex-1 px-4 py-5 pb-20 max-w-screen-2xl w-full mx-auto">
          <OfflineBanner />
          {children}
        </main>

        {/* ── Bottom Nav (Future) ─────────────────────────────────────── */}
        {/* Can be extended for bottom navigation tabs */}
      </div>
    </OfflineProvider>
  );
}