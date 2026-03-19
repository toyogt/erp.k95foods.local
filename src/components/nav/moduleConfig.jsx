import {
  LayoutDashboard, Factory, Tag, Warehouse, ShoppingCart,
  PackageOpen, CreditCard, GitBranch, Settings,
  Droplets, Thermometer, Truck, Printer, ClipboardCheck,
  Layers, BarChart3, Upload, ListChecks, Bell, ScrollText,
  Search, PlayCircle, MonitorDot, Users, FlaskConical,
  PackageSearch, Zap, Box, TestTube2, ShieldCheck,
  Archive, FileText, GitMerge, ClipboardList,
} from 'lucide-react';

/**
 * Central module + page navigation registry.
 * Each module has: key, label, icon, color, pages[]
 * Each page has: key (matches route), label, icon, roles[], adminOnly?
 */
export const MODULES = [
  {
    key: 'DASHBOARD',
    label: 'Dashboard',
    icon: LayoutDashboard,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    pages: [], // Dashboard is top-level, no sub-pages in nav
  },
  {
    key: 'PRODUCTION',
    label: 'Production',
    icon: Factory,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    pages: [
      { key: 'ProductionControl',  label: 'Production Control', icon: Factory,     roles: ['admin','production_manager','user'] },
      { key: 'ProductionOrders',   label: 'Production Orders',  icon: ListChecks,  roles: ['admin','production_manager','user'] },
      { key: 'LiquidPlans',        label: 'Liquid Plans',       icon: Droplets,    roles: ['admin','production_manager','user'] },
      { key: 'FillingStation',     label: 'Filling Station',    icon: Droplets,    roles: ['admin','production_manager','filling_operator','user'] },
      { key: 'ChamberStation',     label: 'Chamber Station',    icon: Thermometer, roles: ['admin','production_manager','chamber_operator','user'] },
      { key: 'RecipeStation',      label: 'Recipe Station',     icon: FlaskConical,roles: ['admin','recipe_operator','user'] },
      { key: 'ShiftKPIDashboard',  label: 'Shift KPIs',         icon: BarChart3,   roles: ['admin','production_manager','user'] },
      { key: 'PullLists',          label: 'Pull Lists',         icon: ListChecks,  roles: ['admin','production_manager','chamber_operator','labelling_receiver','labelling_supervisor','user'] },
    ],
  },
  {
    key: 'LABELLING',
    label: 'Labelling & Packing',
    icon: Tag,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    pages: [
      { key: 'LabellingLine',     label: 'Labelling Line',     icon: Tag,          roles: ['admin','line_operator','labelling_supervisor','production_manager','user'] },
      { key: 'LabelRollManager',  label: 'Label Roll Manager', icon: Printer,      roles: ['admin','labelling_supervisor','production_manager','user'] },
      { key: 'BoxLabelPrint',     label: 'Box Label Print',    icon: Printer,      roles: ['admin','label_operator','label_supervisor','user'] },
      { key: 'BoxLabelApprovals', label: 'Label Approvals',    icon: ClipboardCheck, roles: ['admin','label_supervisor','production_manager','user'] },
      { key: 'BoxPalletBuild',    label: 'Pallet Build',       icon: Layers,       roles: ['admin','pallet_builder','label_operator','user'] },
      { key: 'FeederKiosk',       label: 'Feeder Kiosk',       icon: Tag,          roles: ['admin','line_operator','labelling_supervisor','production_manager','user'] },
    ],
  },
  {
    key: 'WAREHOUSE',
    label: 'Warehouse & FG',
    icon: Warehouse,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    pages: [
      { key: 'TransferReceiving', label: 'Transfer / Receiving', icon: Truck,     roles: ['admin','labelling_receiver','labelling_supervisor','warehouse_ops','user'] },
      { key: 'DispatchCrates',    label: 'Dispatch Crates',      icon: Truck,     roles: ['admin','dispatch_officer','user'] },
      { key: 'FGWarehouse',       label: 'FG Warehouse',         icon: Warehouse, roles: ['admin','warehouse_ops','warehouse','user'] },
      { key: 'WarehouseOps',      label: 'Warehouse Ops',        icon: Warehouse, roles: ['admin','warehouse_ops','user'] },
      { key: 'BoxStockDashboard', label: 'Box Stock',            icon: BarChart3, roles: ['admin','pallet_builder','warehouse_ops','user'] },
      { key: 'OpeningStockImport',label: 'Opening Stock Import', icon: Upload,    roles: ['admin','warehouse_ops','user'] },
    ],
  },
  {
    key: 'PURCHASE',
    label: 'Purchase',
    icon: ShoppingCart,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    pages: [
      { key: 'PurchaseOps',    label: 'Purchase Requests & Orders', icon: ShoppingCart, roles: ['admin','purchase_user','purchase_manager','production_manager','user'] },
      { key: 'SupplierManager',label: 'Suppliers',                  icon: Truck,        roles: ['admin','purchase_manager'], adminOnly: true },
      { key: 'ApprovalsInbox', label: 'Approvals Inbox',            icon: ClipboardCheck, roles: ['admin','purchase_manager','accounts_manager','production_manager','user'] },
      { key: 'PurchaseGRNHub', label: 'Purchase & GRN Hub',        icon: BarChart2,    roles: ['admin','purchase_user','purchase_manager','user'] },
    ],
  },
  {
    key: 'GRN',
    label: 'Goods Receipt',
    icon: PackageOpen,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    pages: [
      { key: 'GateEntry',  label: 'Gate Entry',   icon: ShieldCheck,  roles: ['admin','security_guard','purchase_manager','user'] },
      { key: 'GateInbox',  label: 'Gate Inbox',   icon: Truck,        roles: ['admin','store_receiver','purchase_manager','user'] },
      { key: 'GRNReceive', label: 'GRN Receive',  icon: PackageOpen,  roles: ['admin','store_receiver','purchase_manager','user'] },
      { key: 'Putaway',    label: 'Putaway',      icon: Archive,      roles: ['admin','store_receiver','purchase_manager','user'] },
    ],
  },
  {
    key: 'QUALITY',
    label: 'Quality',
    icon: TestTube2,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    pages: [
      { key: 'QCInbox', label: 'QC Inbox', icon: TestTube2, roles: ['admin','qc_inspector','purchase_manager','user'] },
    ],
  },
  {
    key: 'ACCOUNTS',
    label: 'Accounts',
    icon: CreditCard,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    pages: [
      { key: 'InvoiceCapture',  label: 'Invoice Capture',  icon: FileText,      roles: ['admin','accounts_user','accounts_manager','user'] },
      { key: 'ThreeWayMatch',   label: '3-Way Match',      icon: GitMerge,      roles: ['admin','accounts_user','accounts_manager','user'] },
      { key: 'PaymentRequests', label: 'Payment Requests', icon: CreditCard,    roles: ['admin','accounts_manager','user'] },
    ],
  },
  {
    key: 'FMS',
    label: 'Process Flow',
    icon: GitBranch,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    pages: [
      { key: 'FMSMyTasks',   label: 'My Tasks',     icon: ClipboardList, roles: ['admin','process_designer','process_controller','user'] },
      { key: 'FMSActiveRuns',label: 'Active Runs',  icon: PlayCircle,    roles: ['admin','process_controller','process_designer','user'] },
      { key: 'FMSMonitor',   label: 'Monitor',      icon: MonitorDot,    roles: ['admin','process_controller','user'] },
      { key: 'FMSProcesses', label: 'Processes',    icon: GitBranch,     roles: ['admin','process_designer'], adminOnly: true },
      { key: 'FMSUsers',     label: 'FMS Users',    icon: Users,         roles: ['admin'], adminOnly: true },
    ],
  },
  {
    key: 'ADMIN',
    label: 'Admin',
    icon: Settings,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    adminOnly: true,
    pages: [
      { key: 'MasterData',           label: 'Master Data',        icon: Settings,      roles: ['admin','production_manager','user'] },
      { key: 'SKUSetup',             label: 'SKU Setup',          icon: PackageSearch, roles: ['admin'], adminOnly: true },
      { key: 'RecipeBuilder',        label: 'Recipe Builder',     icon: FlaskConical,  roles: ['admin'], adminOnly: true },
      { key: 'IngredientManager',    label: 'Ingredients',        icon: Zap,           roles: ['admin'], adminOnly: true },
      { key: 'IngredientGroupManager',label:'Ingredient Groups',  icon: Zap,           roles: ['admin'], adminOnly: true },
      { key: 'UOMManager',           label: 'UOMs',               icon: Tag,           roles: ['admin'], adminOnly: true },
      { key: 'BoxTypeManager',       label: 'Box Types',          icon: Box,           roles: ['admin'], adminOnly: true },
      { key: 'LabelArtworkManager',  label: 'Label Artworks',     icon: Printer,       roles: ['admin'], adminOnly: true },
      { key: 'RyanTemplateManager',  label: 'Ryan Templates',     icon: Printer,       roles: ['admin'], adminOnly: true },
      { key: 'ProductTaxonomy',      label: 'Product Taxonomy',   icon: Layers,        roles: ['admin'], adminOnly: true },
      { key: 'WarehouseBins',        label: 'Warehouses & Bins',  icon: Warehouse,     roles: ['admin'], adminOnly: true },
      { key: 'TraceInvestigation',   label: 'Trace Investigation',icon: Search,        roles: ['admin','production_manager','user'] },
      { key: 'AlertsPage',           label: 'Alerts',             icon: Bell,          roles: ['admin','production_manager','label_supervisor','labelling_supervisor','user'] },
      { key: 'AuditLogPage',         label: 'Audit Log',          icon: ScrollText,    roles: ['admin','production_manager','qa','user'] },
    ],
  },
];

/**
 * Given a page key, find which module it belongs to.
 */
export function getModuleForPage(pageKey) {
  for (const mod of MODULES) {
    if (mod.pages.find(p => p.key === pageKey)) return mod;
  }
  return null;
}

/**
 * Filter MODULES to only those containing pages accessible by this role.
 */
export function getVisibleModules(role) {
  const isAdmin = role === 'admin';
  return MODULES.filter(mod => {
    if (mod.adminOnly && !isAdmin) return false;
    if (mod.key === 'DASHBOARD') return true;
    const visiblePages = mod.pages.filter(p => {
      if (p.adminOnly && !isAdmin) return false;
      return p.roles.includes(role) || p.roles.includes('user');
    });
    return visiblePages.length > 0;
  });
}

/**
 * Get visible pages within a module for a role.
 */
export function getVisiblePages(mod, role) {
  const isAdmin = role === 'admin';
  return mod.pages.filter(p => {
    if (p.adminOnly && !isAdmin) return false;
    return p.roles.includes(role) || isAdmin;
  });
}