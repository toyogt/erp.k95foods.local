import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import OfflineProvider, { OfflineBanner } from '@/components/OfflineProvider';
import useModuleAccess from '@/components/modules/useModuleAccess';
import {
  LayoutDashboard, ScrollText, Settings, ChevronLeft,
  Factory, LogOut, Menu, X,
  Droplets, Thermometer, Truck, Tag,
  ListChecks, Bell, Printer, ClipboardCheck, Layers, Warehouse, BarChart3, Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const ALL_NAV_ITEMS = [
  { label: 'Dashboard',          page: 'Dashboard',          icon: LayoutDashboard },
  { label: 'Production',         page: 'ProductionControl',  icon: Factory         },
  { label: 'Filling Station',    page: 'FillingStation',     icon: Droplets        },
  { label: 'Chamber Station',    page: 'ChamberStation',     icon: Thermometer     },
  { label: 'Transfer/Receiving', page: 'TransferReceiving',  icon: Truck           },
  { label: 'Labelling Line',     page: 'LabellingLine',      icon: Tag             },
  { label: 'Label Roll Mgr',     page: 'LabelRollManager',   icon: Printer         },
  { label: 'Box Label Print',    page: 'BoxLabelPrint',      icon: Printer         },
  { label: 'Label Approvals',    page: 'BoxLabelApprovals',  icon: ClipboardCheck  },
  { label: 'Pallet Build',       page: 'BoxPalletBuild',     icon: Layers          },
  { label: 'Warehouse Ops',      page: 'WarehouseOps',       icon: Warehouse       },
  { label: 'Box Stock',          page: 'BoxStockDashboard',  icon: BarChart3       },
  { label: 'Opening Stock',      page: 'OpeningStockImport', icon: Upload          },
  { label: 'Pull Lists',         page: 'PullLists',          icon: ListChecks      },
  { label: 'Alerts',             page: 'AlertsPage',         icon: Bell            },
  { label: 'Shift KPIs',         page: 'ShiftKPIDashboard',  icon: BarChart3       },
  { label: 'Feeder Kiosk',       page: 'FeederKiosk',        icon: Tag             },
  { label: 'Trace Investigation',page: 'TraceInvestigation', icon: Search          },
  { label: 'Audit Log',          page: 'AuditLogPage',       icon: ScrollText      },
  { label: 'Template Mapping',   page: 'TemplateMappingManager', icon: Settings    },
  { label: 'Master Data',        page: 'MasterData',         icon: Settings        },
];

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { isEnabled } = useModuleAccess(user);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [currentPageName]);

  const isDashboard = currentPageName === 'Dashboard';
  // Only filter nav once user is loaded to avoid flashing admin items
  const NAV_ITEMS = user ? ALL_NAV_ITEMS.filter(n => isEnabled(n.page)) : [];
  const pageTitle = ALL_NAV_ITEMS.find(n => n.page === currentPageName)?.label || currentPageName?.replace(/([A-Z])/g, ' $1').trim();

  return (
    <OfflineProvider>
      <div className="min-h-screen bg-slate-50 overflow-x-hidden max-w-full">
        <style>{`
          :root { --factory-primary: #0f172a; --factory-accent: #2563eb; }
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; -webkit-font-smoothing: antialiased; }
          * { -webkit-tap-highlight-color: transparent; }
          /* Prevent iOS auto-zoom on input focus (requires font-size >= 16px on inputs) */
          input, select, textarea { font-size: 16px !important; }
          /* Larger touch targets for header buttons */
          .touch-target { min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center; }
        `}</style>
        <OfflineBanner />
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
          <div className="max-w-screen-2xl mx-auto flex items-center justify-between px-3 h-14">
            <div className="flex items-center gap-2">
              {!isDashboard && (
                <Link to={createPageUrl('Dashboard')} className="w-12 h-12 -ml-1 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors flex items-center justify-center">
                  <ChevronLeft className="w-7 h-7 text-slate-700" />
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
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-12 h-12 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors flex items-center justify-center"
            >
              {menuOpen ? <X className="w-7 h-7 text-slate-700" /> : <Menu className="w-7 h-7 text-slate-700" />}
            </button>
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