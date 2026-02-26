import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import OfflineProvider, { OfflineBanner } from '@/components/OfflineProvider';
import useModuleAccess from '@/components/modules/useModuleAccess';
import {
  LayoutDashboard, ScrollText, Settings, ChevronLeft,
  Factory, LogOut, Menu, X,
  Store, Beaker, Droplets, Thermometer, Truck, Tag,
  ListChecks, Bell, Printer, ClipboardCheck, Layers, Warehouse, BarChart3, Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const ALL_NAV_ITEMS = [
  { label: 'Dashboard',          page: 'Dashboard',          icon: LayoutDashboard },
  { label: 'Stores Issue',       page: 'StoresIssue',        icon: Store           },
  { label: 'Recipe Station',     page: 'RecipeStation',      icon: Beaker          },
  { label: 'Filling Station',    page: 'FillingStation',     icon: Droplets        },
  { label: 'Chamber Station',    page: 'ChamberStation',     icon: Thermometer     },
  { label: 'Transfer/Receiving', page: 'TransferReceiving',  icon: Truck           },
  { label: 'Labelling Line',     page: 'LabellingLine',      icon: Tag             },
  { label: 'Box Label Print',    page: 'BoxLabelPrint',      icon: Printer         },
  { label: 'Label Approvals',    page: 'BoxLabelApprovals',  icon: ClipboardCheck  },
  { label: 'Pallet Build',       page: 'BoxPalletBuild',     icon: Layers          },
  { label: 'Warehouse Ops',      page: 'WarehouseOps',       icon: Warehouse       },
  { label: 'Box Stock',          page: 'BoxStockDashboard',  icon: BarChart3       },
  { label: 'Opening Stock',      page: 'OpeningStockImport', icon: Upload          },
  { label: 'Pull Lists',         page: 'PullLists',          icon: ListChecks      },
  { label: 'Alerts',             page: 'AlertsPage',         icon: Bell            },
  { label: 'Audit Log',          page: 'AuditLogPage',       icon: ScrollText      },
  { label: 'Master Data',        page: 'MasterData',         icon: Settings        },
];

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { isEnabled } = useModuleAccess(user);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isDashboard = currentPageName === 'Dashboard';
  const NAV_ITEMS = ALL_NAV_ITEMS.filter(n => isEnabled(n.page));
  const pageTitle = ALL_NAV_ITEMS.find(n => n.page === currentPageName)?.label || currentPageName?.replace(/([A-Z])/g, ' $1').trim();

  return (
    <OfflineProvider>
      <div className="min-h-screen bg-slate-50">
        <style>{`
          :root { --factory-primary: #0f172a; --factory-accent: #2563eb; }
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; -webkit-font-smoothing: antialiased; }
          * { -webkit-tap-highlight-color: transparent; }
        `}</style>
        <OfflineBanner />
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
          <div className="max-w-screen-2xl mx-auto flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-2">
              {!isDashboard && (
                <Link to={createPageUrl('Dashboard')} className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                  <ChevronLeft className="w-5 h-5 text-slate-600" />
                </Link>
              )}
              {isDashboard && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                    <Factory className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-slate-900 text-sm tracking-tight">Factory Exec</span>
                </div>
              )}
              {!isDashboard && (
                <h1 className="font-semibold text-slate-900 text-base">{pageTitle}</h1>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setMenuOpen(!menuOpen)} className="rounded-lg">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
          {menuOpen && (
            <div className="absolute top-14 left-0 right-0 bg-white border-b border-slate-200 shadow-lg z-50">
              <div className="max-w-screen-2xl mx-auto p-3 space-y-1">
                {NAV_ITEMS.map(item => {
                  const Icon = item.icon;
                  const isActive = currentPageName === item.page;
                  return (
                    <Link key={item.page} to={createPageUrl(item.page)} onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
                      <Icon className="w-5 h-5" />
                      <span className="font-medium text-sm">{item.label}</span>
                    </Link>
                  );
                })}
                {user && (
                  <div className="border-t border-slate-100 pt-2 mt-2">
                    <div className="px-4 py-2 text-xs text-slate-400">
                      {user.full_name || user.email}
                      {user.role && <span className="ml-1 uppercase">· {user.role}</span>}
                    </div>
                    <button onClick={() => base44.auth.logout()}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 w-full transition-all">
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