/**
 * ModuleHub — landing page for a module showing its sub-pages as cards.
 * Rendered when the user clicks a module tab and the current page is
 * the hub itself (no sub-page selected).
 */
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ModuleHub({ module: mod, role }) {
  if (!mod || mod.key === 'DASHBOARD') return null;

  const isAdmin = role === 'admin';
  const pages = mod.pages.filter(p => {
    if (p.adminOnly && !isAdmin) return false;
    return p.roles.includes(role) || isAdmin;
  });

  return (
    <div className="p-6 max-w-screen-lg mx-auto">
      <div className="mb-6">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${mod.bgColor} mb-3`}>
          <mod.icon className={`w-4 h-4 ${mod.color}`} />
          <span className={`text-sm font-semibold ${mod.color}`}>{mod.label}</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{mod.label}</h1>
        <p className="text-slate-500 text-sm mt-1">Select a section to get started</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {pages.map(page => {
          const Icon = page.icon;
          return (
            <Link
              key={page.key}
              to={createPageUrl(page.key)}
              className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-3 hover:shadow-md hover:border-slate-300 active:scale-95 transition-all"
            >
              <div className={`w-10 h-10 rounded-xl ${mod.bgColor} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${mod.color}`} />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm leading-tight">{page.label}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}