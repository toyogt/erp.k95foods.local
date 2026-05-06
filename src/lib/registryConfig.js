/**
 * Unified Page & Module Registry
 * Single source of truth for all routing, navigation, and permission configuration
 * 
 * Structure:
 * - pageRegistry: All pages with metadata
 * - moduleRegistry: Module groupings
 * - specialPages: Hidden system/special pages
 */

import {
  LayoutDashboard, Factory, Tag, Warehouse, ShoppingCart,
  PackageOpen, CreditCard, GitBranch, Settings,
  Droplets, Thermometer, Truck, Printer, ClipboardCheck,
  Layers, BarChart3, Upload, ListChecks, Bell, ScrollText,
  Search, PlayCircle, MonitorDot, Users, FlaskConical,
  PackageSearch, Zap, Box, TestTube2, ShieldCheck,
  Archive, FileText, ClipboardList, Shield, Zap as ZapIcon,
  Activity, BarChart4, AlertCircle, AlertTriangle,
  Store, MapPin, QrCode, ArrowLeftRight, TrendingDown,
  RotateCcw, SlidersHorizontal, CalendarDays, Eye,
} from 'lucide-react';

/**
 * MASTER PAGE REGISTRY
 * Every navigable page defined here with:
 * - pageKey: Route path & unique identifier
 * - title: Display name
 * - moduleKey: Which module it belongs to
 * - icon: lucide-react icon
 * - roles: Allowed user roles
 * - adminOnly: Only visible to admin
 * - mobileVisible: Show on mobile app
 * - description: What the page does
 */
export const pageRegistry = [
  // ─── DASHBOARD ───
  { pageKey: 'Dashboard', title: 'Dashboard', moduleKey: 'DASHBOARD', icon: LayoutDashboard, roles: ['admin', 'user'], mobileVisible: true, description: 'Main dashboard' },

  // ─── PRODUCTION ───
  { pageKey: 'ProductionControl', title: 'Production Control', moduleKey: 'PRODUCTION', icon: Factory, roles: ['admin', 'production_manager', 'user'], mobileVisible: true },
  { pageKey: 'ProductionOrders', title: 'Production Orders', moduleKey: 'PRODUCTION', icon: ListChecks, roles: ['admin', 'production_manager', 'user'] },
  { pageKey: 'LiquidPlans', title: 'Liquid Plans', moduleKey: 'PRODUCTION', icon: Droplets, roles: ['admin', 'production_manager', 'user'] },
  { pageKey: 'FillingStation', title: 'Filling Station', moduleKey: 'PRODUCTION', icon: Droplets, roles: ['admin', 'production_manager', 'filling_operator', 'user'], mobileVisible: true },
  { pageKey: 'ChamberStation', title: 'Chamber Station', moduleKey: 'PRODUCTION', icon: Thermometer, roles: ['admin', 'production_manager', 'chamber_operator', 'user'], mobileVisible: true },
  { pageKey: 'RecipeStation', title: 'Recipe Station', moduleKey: 'PRODUCTION', icon: FlaskConical, roles: ['admin', 'recipe_operator', 'user'] },
  { pageKey: 'ShiftKPIDashboard', title: 'Shift KPIs', moduleKey: 'PRODUCTION', icon: BarChart3, roles: ['admin', 'production_manager', 'user'] },
  { pageKey: 'PullLists', title: 'Pull Lists', moduleKey: 'PRODUCTION', icon: ListChecks, roles: ['admin', 'production_manager', 'chamber_operator', 'labelling_receiver', 'labelling_supervisor', 'user'] },

  // ─── LABELLING & PACKING (Legacy) ───
  { pageKey: 'LabellingLine', title: 'Labelling Line', moduleKey: 'LABELLING', icon: Tag, roles: ['admin', 'line_operator', 'labelling_supervisor', 'production_manager', 'user'], mobileVisible: true },
  { pageKey: 'LabelRollManager', title: 'Label Roll Manager', moduleKey: 'LABELLING', icon: Printer, roles: ['admin', 'labelling_supervisor', 'production_manager', 'user'] },
  { pageKey: 'BoxLabelPrint', title: 'Box Label Print', moduleKey: 'LABELLING', icon: Printer, roles: ['admin', 'label_operator', 'label_supervisor', 'user'] },
  { pageKey: 'BoxLabelApprovals', title: 'Label Approvals', moduleKey: 'LABELLING', icon: ClipboardCheck, roles: ['admin', 'label_supervisor', 'production_manager', 'user'] },
  { pageKey: 'BoxPalletBuild', title: 'Pallet Build', moduleKey: 'LABELLING', icon: Layers, roles: ['admin', 'pallet_builder', 'label_operator', 'user'] },
  { pageKey: 'FeederKiosk', title: 'Feeder Kiosk', moduleKey: 'LABELLING', icon: Tag, roles: ['admin', 'line_operator', 'labelling_supervisor', 'production_manager', 'user'], mobileVisible: true },

  // ─── LABELLING DEPARTMENT (New Module) ───
  { pageKey: 'LblPlanningDashboard', title: 'Shift Planning', moduleKey: 'LBL_DEPT', icon: CalendarDays, roles: ['admin', 'lbl_supervisor', 'production_manager', 'user'], sortOrder: 1 },
  { pageKey: 'LblOperatorQueue', title: 'Operator Queue', moduleKey: 'LBL_DEPT', icon: ListChecks, roles: ['admin', 'lbl_supervisor', 'lbl_operator', 'lbl_helper', 'production_manager', 'user'], sortOrder: 2, mobileVisible: true },
  { pageKey: 'LblSupervisorApprovals', title: 'Demo Approvals', moduleKey: 'LBL_DEPT', icon: ClipboardCheck, roles: ['admin', 'lbl_supervisor', 'production_manager', 'user'], sortOrder: 3 },
  { pageKey: 'LblMonitorDashboard', title: 'Live Monitor', moduleKey: 'LBL_DEPT', icon: Eye, roles: ['admin', 'lbl_supervisor', 'production_manager', 'user'], sortOrder: 4 },
  { pageKey: 'LblChecklistBuilder', title: 'Checklist Builder', moduleKey: 'LBL_DEPT', icon: ClipboardList, roles: ['admin'], adminOnly: true, sortOrder: 10 },
  { pageKey: 'LblEventLogPage', title: 'Event Log', moduleKey: 'LBL_DEPT', icon: ScrollText, roles: ['admin', 'lbl_supervisor', 'production_manager'], sortOrder: 11 },
  { pageKey: 'LblMasterData', title: 'Lines & Printers', moduleKey: 'LBL_DEPT', icon: Settings, roles: ['admin', 'lbl_supervisor', 'production_manager'], sortOrder: 12 },
  { pageKey: 'LblDocTypePermissions', title: 'Document Permissions', moduleKey: 'LBL_DEPT', icon: ShieldCheck, roles: ['admin'], adminOnly: true, sortOrder: 13 },

  // ─── WAREHOUSE & FG ───
  { pageKey: 'TransferReceiving', title: 'Transfer / Receiving', moduleKey: 'WAREHOUSE', icon: Truck, roles: ['admin', 'labelling_receiver', 'labelling_supervisor', 'warehouse_ops', 'user'] },
  { pageKey: 'DispatchCrates', title: 'Dispatch Crates', moduleKey: 'WAREHOUSE', icon: Truck, roles: ['admin', 'dispatch_officer', 'user'] },
  { pageKey: 'FGWarehouse', title: 'FG Warehouse', moduleKey: 'WAREHOUSE', icon: Warehouse, roles: ['admin', 'warehouse_ops', 'warehouse', 'user'] },

  // ─── PURCHASE ───
   { pageKey: 'PurchaseRequestList', title: 'My Purchase Requests', moduleKey: 'PURCHASE', icon: ClipboardList, roles: ['admin', 'purchase_user', 'purchase_manager', 'production_manager', 'user'], sortOrder: 1 },
   { pageKey: 'PurchaseRequestApprovals', title: 'Request Approvals', moduleKey: 'PURCHASE', icon: ClipboardCheck, roles: ['admin', 'purchase_manager', 'production_manager', 'user'], sortOrder: 2 },
   { pageKey: 'PurchaseOrderList', title: 'Purchase Orders', moduleKey: 'PURCHASE', icon: ShoppingCart, roles: ['admin', 'purchase_user', 'purchase_manager', 'production_manager', 'user'], sortOrder: 3 },
   { pageKey: 'POFollowUpTracker', title: 'Follow-Up Tracker', moduleKey: 'PURCHASE', icon: Bell, roles: ['admin', 'purchase_manager', 'production_manager', 'user'], sortOrder: 4 },
   { pageKey: 'PurchaseReports', title: 'Purchase Reports', moduleKey: 'PURCHASE', icon: BarChart3, roles: ['admin', 'purchase_manager', 'production_manager', 'user'], sortOrder: 5 },
   { pageKey: 'SupplierManager', title: 'Suppliers', moduleKey: 'PURCHASE', icon: Truck, roles: ['admin', 'purchase_manager'], adminOnly: true, sortOrder: 6 },

  // GRN pages moved to STORE module above

  // ─── QUALITY ───
  { pageKey: 'QCInbox', title: 'QC Inbox', moduleKey: 'QUALITY', icon: TestTube2, roles: ['admin', 'qc_inspector', 'purchase_manager', 'user'] },

  // ─── ACCOUNTS ───
  { pageKey: 'InvoiceCapture', title: 'Invoice Capture', moduleKey: 'ACCOUNTS', icon: FileText, roles: ['admin', 'accounts_user', 'accounts_manager', 'user'] },
  { pageKey: 'ThreeWayMatch', title: '3-Way Match', moduleKey: 'ACCOUNTS', icon: Search, roles: ['admin', 'accounts_user', 'accounts_manager', 'user'] },
  { pageKey: 'PaymentRequests', title: 'Payment Requests', moduleKey: 'ACCOUNTS', icon: CreditCard, roles: ['admin', 'accounts_manager', 'user'] },

  // ─── PROCESS FLOW (FMS) ───
  { pageKey: 'FMSActiveRuns', title: 'Active Runs', moduleKey: 'FMS', icon: PlayCircle, roles: ['admin', 'process_controller', 'process_designer', 'user'] },
  { pageKey: 'FMSMonitor', title: 'Monitor', moduleKey: 'FMS', icon: MonitorDot, roles: ['admin', 'process_controller', 'user'] },
  { pageKey: 'FMSProcesses', title: 'FMS', moduleKey: 'FMS', icon: GitBranch, roles: ['admin', 'process_designer'], adminOnly: true },
  { pageKey: 'FMSHealthDashboard', title: 'FMS Health', moduleKey: 'FMS', icon: BarChart4, roles: ['admin'], adminOnly: true },
  { pageKey: 'ScheduledTaskManager', title: 'Scheduled Tasks', moduleKey: 'FMS', icon: ClipboardList, roles: ['admin', 'process_controller', 'process_designer', 'user'] },
  { pageKey: 'EADashboard', title: 'EA Dashboard', moduleKey: 'FMS', icon: ClipboardList, roles: ['admin', 'executive_assistant', 'user'], sortOrder: 7 },
  { pageKey: 'DirectorDashboard', title: 'Director Dashboard', moduleKey: 'FMS', icon: ClipboardList, roles: ['admin'], sortOrder: 8 },
  { pageKey: 'ProjectManager', title: 'Project Manager', moduleKey: 'FMS', icon: ClipboardList, roles: ['admin', 'executive_assistant', 'user'], sortOrder: 9 },
  { pageKey: 'DelegationScore', title: 'Delegation Score', moduleKey: 'FMS', icon: BarChart3, roles: ['admin', 'executive_assistant', 'user'], sortOrder: 10 },
  { pageKey: 'QuickAssignTask', title: 'Quick Assign Task', moduleKey: 'FMS', icon: ClipboardList, roles: ['admin', 'executive_assistant', 'director'], sortOrder: 11 },

  // ─── ADMIN / MASTER DATA ───
  { pageKey: 'MasterData', title: 'Master Data', moduleKey: 'ADMIN', icon: Settings, roles: ['admin', 'production_manager', 'user'] },
  { pageKey: 'SKUSetup', title: 'SKU Setup', moduleKey: 'ADMIN', icon: PackageSearch, roles: ['admin', 'production_manager', 'user'] },
  { pageKey: 'RecipeBuilder', title: 'Recipe Builder', moduleKey: 'ADMIN', icon: FlaskConical, roles: ['admin', 'production_manager', 'user'] },
  { pageKey: 'ItemMasterManager', title: 'Item Master', moduleKey: 'ADMIN', icon: PackageSearch, roles: ['admin', 'store_manager', 'purchase_manager', 'user'] },
  { pageKey: 'SKUBOMConfig', title: 'Material Planning Config', moduleKey: 'ADMIN', icon: PackageSearch, roles: ['admin', 'production_manager', 'user'] },
  // ItemModule removed — replaced by ALL_ITEMS module pages
  { pageKey: 'IngredientManager', title: 'Ingredients', moduleKey: 'ADMIN', icon: Zap, roles: ['admin', 'production_manager', 'user'] },
  // IngredientGroupManager is now a tab inside IngredientManager — not a standalone page
  { pageKey: 'UOMManager', title: 'UOMs', moduleKey: 'ADMIN', icon: Tag, roles: ['admin', 'production_manager', 'user'] },
  { pageKey: 'BoxTypeManager', title: 'Box Types', moduleKey: 'ADMIN', icon: Box, roles: ['admin', 'production_manager', 'user'] },
  { pageKey: 'LabelArtworkManager', title: 'Label Artworks', moduleKey: 'ADMIN', icon: Printer, roles: ['admin', 'production_manager', 'user'] },
  { pageKey: 'RyanTemplateManager', title: 'Ryan Templates', moduleKey: 'ADMIN', icon: Printer, roles: ['admin', 'production_manager', 'user'] },
  { pageKey: 'ProductTaxonomy', title: 'Product Taxonomy', moduleKey: 'ADMIN', icon: Layers, roles: ['admin', 'production_manager', 'user'] },
  { pageKey: 'WarehouseBins', title: 'Warehouses & Bins', moduleKey: 'ADMIN', icon: Warehouse, roles: ['admin', 'warehouse_ops', 'store_manager', 'user'] },
  { pageKey: 'TraceInvestigation', title: 'Trace Investigation', moduleKey: 'ADMIN', icon: Search, roles: ['admin', 'production_manager', 'user'] },
  { pageKey: 'AlertsPage', title: 'Alerts', moduleKey: 'ADMIN', icon: Bell, roles: ['admin', 'production_manager', 'label_supervisor', 'labelling_supervisor', 'user'] },
  { pageKey: 'AuditLogPage', title: 'Audit Log', moduleKey: 'ADMIN', icon: ScrollText, roles: ['admin', 'production_manager', 'qa', 'user'] },
  { pageKey: 'TraceabilityExplorer', title: 'Traceability Explorer', moduleKey: 'ADMIN', icon: Search, roles: ['admin', 'production_manager', 'qa', 'warehouse_ops', 'user'] },
  { pageKey: 'ReconciliationDashboard', title: 'Reconciliation Dashboard', moduleKey: 'ADMIN', icon: AlertTriangle, roles: ['admin', 'production_manager', 'warehouse_ops', 'supervisor', 'user'] },

  // ─── STORE MANAGEMENT ───
  { pageKey: 'SMSDashboard',       title: 'Store Dashboard',    moduleKey: 'STORE', icon: Store,           roles: ['admin', 'store_manager', 'store_receiver', 'user'], sortOrder: 1 },
  { pageKey: 'GateEntry',          title: 'Gate Entry',         moduleKey: 'STORE', icon: ShieldCheck,     roles: ['admin', 'security_guard', 'store_receiver', 'user'], sortOrder: 2 },
  { pageKey: 'GateInbox',          title: 'Gate Inbox',         moduleKey: 'STORE', icon: ClipboardList,   roles: ['admin', 'store_manager', 'store_receiver', 'security_guard', 'user'], sortOrder: 2.5 },
  { pageKey: 'GRNReceive',         title: 'Goods Received Note',moduleKey: 'STORE', icon: PackageOpen,     roles: ['admin', 'store_receiver', 'user'], sortOrder: 3 },
  { pageKey: 'StoresIssue',        title: 'Stores Issue',       moduleKey: 'STORE', icon: PackageOpen,     roles: ['admin', 'store_manager', 'user'], sortOrder: 5.5 },
  { pageKey: 'SMSPutaway',         title: 'Putaway',            moduleKey: 'STORE', icon: Archive,         roles: ['admin', 'store_manager', 'store_receiver', 'user'], sortOrder: 4 },
  { pageKey: 'SMSStockOut',        title: 'Stock Issue',        moduleKey: 'STORE', icon: PackageOpen,     roles: ['admin', 'store_manager', 'user'], sortOrder: 5 },
  { pageKey: 'SMSItemMaster',      title: 'Item Master',        moduleKey: 'STORE', icon: PackageSearch,   roles: ['admin', 'store_manager', 'user'], sortOrder: 10 },
  // StoreItemCreator removed — items are created directly in All Items module pages
  { pageKey: 'SMSLotManager',      title: 'Lot Manager',        moduleKey: 'STORE', icon: QrCode,          roles: ['admin', 'store_manager', 'store_receiver', 'qc_inspector', 'user'], sortOrder: 11 },
  { pageKey: 'SMSLocationManager', title: 'Locations',          moduleKey: 'STORE', icon: MapPin,          roles: ['admin', 'store_manager'], sortOrder: 25 },
  { pageKey: 'SMSTransfer',        title: 'Internal Transfer',  moduleKey: 'STORE', icon: ArrowLeftRight,  roles: ['admin', 'store_manager', 'store_receiver', 'user'], sortOrder: 20 },
  { pageKey: 'SMSReorderConfig',   title: 'Reorder Alerts',     moduleKey: 'STORE', icon: TrendingDown,    roles: ['admin', 'store_manager'], sortOrder: 21 },
  { pageKey: 'SMSCycleCount',      title: 'Cycle Count',        moduleKey: 'STORE', icon: ClipboardCheck,  roles: ['admin', 'store_manager', 'user'], sortOrder: 22 },
  { pageKey: 'SMSAdjustments',     title: 'Adjustments',        moduleKey: 'STORE', icon: SlidersHorizontal, roles: ['admin', 'store_manager', 'user'], sortOrder: 23 },
  { pageKey: 'SMSReports',         title: 'Store Reports',      moduleKey: 'STORE', icon: BarChart3,       roles: ['admin', 'store_manager', 'user'], sortOrder: 24 },
  { pageKey: 'SMSOpeningStockManager', title: 'Opening Stock',   moduleKey: 'STORE', icon: PackageOpen,     roles: ['admin', 'store_manager', 'user'], sortOrder: 12 },

  // ─── SALES ───
  { pageKey: 'SalesOrders',         title: 'Sales Orders',    moduleKey: 'SALES', icon: ShoppingCart, roles: ['admin', 'sales_manager', 'sales_user', 'user'] },
  { pageKey: 'SalesCustomerManager',title: 'Customers',       moduleKey: 'SALES', icon: Users,        roles: ['admin', 'sales_manager', 'sales_user', 'user'] },
  { pageKey: 'SalesPriceListView',  title: 'Price Lists',     moduleKey: 'SALES', icon: Tag,          roles: ['admin', 'sales_manager', 'sales_user', 'user'] },
  { pageKey: 'SalesDistributors',   title: 'Distributors',    moduleKey: 'SALES', icon: Users,        roles: ['admin', 'sales_manager'] },
  { pageKey: 'SalesRateListManager',title: 'Rate List',        moduleKey: 'SALES', icon: Tag,          roles: ['admin', 'sales_manager'], adminOnly: false },
  { pageKey: 'SalesSettingsPage',   title: 'Sales & Tally Settings',  moduleKey: 'SALES', icon: Settings,     roles: ['admin', 'sales_manager', 'accounts_manager', 'user'], adminOnly: false },
  { pageKey: 'DistributorPortal',    title: 'Distributor Portal', moduleKey: 'SALES', icon: Users,       roles: ['admin', 'user', 'distributor', 'sales_manager', 'sales_user'] },
  { pageKey: 'SalesGRNReconciliation', title: 'GRN Reconciliation', moduleKey: 'SALES', icon: PackageOpen, roles: ['admin', 'sales_manager', 'accounts_manager', 'user'] },
  { pageKey: 'TransportRateCards',     title: 'Transport Rate Cards', moduleKey: 'SALES', icon: Truck,       roles: ['admin', 'sales_manager'], adminOnly: false },
  { pageKey: 'SalesPicklists',         title: 'Picklists',            moduleKey: 'SALES', icon: ClipboardList, roles: ['admin', 'sales_manager', 'sales_user', 'user'] },
  { pageKey: 'SalesInvoices',          title: 'Invoices',             moduleKey: 'SALES', icon: FileText,     roles: ['admin', 'sales_manager', 'sales_user', 'user'] },
  { pageKey: 'SalesSKUManagement',      title: 'Products (SKU)',        moduleKey: 'SALES', icon: PackageSearch, roles: ['admin', 'sales_manager', 'sales_user', 'user'] },

  // ─── ALL ITEMS ───
  { pageKey: 'AllItemsIngredients',   title: 'Ingredients',      moduleKey: 'ALL_ITEMS', icon: Zap,           roles: ['admin', 'store_manager', 'production_manager', 'user'], sortOrder: 1 },
  { pageKey: 'AllItemsUOM',           title: 'Units of Measure', moduleKey: 'ALL_ITEMS', icon: Tag,           roles: ['admin', 'store_manager', 'production_manager', 'user'], sortOrder: 2 },
  { pageKey: 'AllItemsBoxTypes',      title: 'Box Types',        moduleKey: 'ALL_ITEMS', icon: Box,           roles: ['admin', 'store_manager', 'production_manager', 'user'], sortOrder: 3 },
  { pageKey: 'AllItemsLabelArtworks', title: 'Label Artworks',   moduleKey: 'ALL_ITEMS', icon: Printer,       roles: ['admin', 'store_manager', 'production_manager', 'user'], sortOrder: 4 },
  { pageKey: 'AllItemsContainers',    title: 'Containers',       moduleKey: 'ALL_ITEMS', icon: PackageSearch,  roles: ['admin', 'store_manager', 'production_manager', 'user'], sortOrder: 5 },
  { pageKey: 'AllItemsCaps',          title: 'Caps',             moduleKey: 'ALL_ITEMS', icon: Archive,        roles: ['admin', 'store_manager', 'production_manager', 'user'], sortOrder: 6 },
  { pageKey: 'AllItemsFlavours',      title: 'Flavours',         moduleKey: 'ALL_ITEMS', icon: Droplets,       roles: ['admin', 'store_manager', 'production_manager', 'user'], sortOrder: 7 },

  // ─── USER MANAGEMENT ───
  { pageKey: 'UserManagement', title: 'Users', moduleKey: 'USER_MANAGEMENT', icon: Users, roles: ['admin'], adminOnly: true },
  { pageKey: 'RoleManager', title: 'Roles', moduleKey: 'USER_MANAGEMENT', icon: Shield, roles: ['admin'], adminOnly: true },
  { pageKey: 'PermissionMatrix', title: 'Document Access', moduleKey: 'USER_MANAGEMENT', icon: ShieldCheck, roles: ['admin'], adminOnly: true },
  { pageKey: 'PermissionPolicyManager', title: 'Permission Policies', moduleKey: 'USER_MANAGEMENT', icon: Shield, roles: ['admin'], adminOnly: true },
  { pageKey: 'AccessAuditLog', title: 'Access Audit Log', moduleKey: 'USER_MANAGEMENT', icon: ScrollText, roles: ['admin'], adminOnly: true },
  { pageKey: 'PermissionMatrixDashboard', title: 'Permission Dashboard', moduleKey: 'USER_MANAGEMENT', icon: ShieldCheck, roles: ['admin'], adminOnly: true },
  { pageKey: 'ApprovalRulesManager', title: 'Approval Rules', moduleKey: 'USER_MANAGEMENT', icon: GitBranch, roles: ['admin'], adminOnly: true },
  { pageKey: 'ApprovalWorkflowHub', title: 'Approval Workflow Hub', moduleKey: 'USER_MANAGEMENT', icon: ClipboardCheck, roles: ['admin'], adminOnly: true },

  // ─── ADMIN / SYSTEM ───
  { pageKey: 'SyncCenter', title: 'Sync Center', moduleKey: 'ADMIN', icon: Activity, roles: ['admin', 'user'] },
  { pageKey: 'RulesManager', title: 'Rules Manager', moduleKey: 'ADMIN', icon: ShieldCheck, roles: ['admin', 'user'] },
  { pageKey: 'BlockedAttemptsViewer', title: 'Blocked Attempts', moduleKey: 'ADMIN', icon: AlertCircle, roles: ['admin', 'user'] },
  { pageKey: 'AuditLogViewer', title: 'Audit Log Viewer', moduleKey: 'ADMIN', icon: ScrollText, roles: ['admin', 'production_manager', 'user'] },
  { pageKey: 'SLAConfigManager', title: 'SLA Configuration', moduleKey: 'ADMIN', icon: Settings, roles: ['admin'], adminOnly: true },
  { pageKey: 'SLAEscalationDashboard', title: 'SLA Escalations', moduleKey: 'ADMIN', icon: AlertTriangle, roles: ['admin'], adminOnly: true },
  { pageKey: 'SystemSettings', title: 'System Settings', moduleKey: 'ADMIN', icon: Settings, roles: ['admin', 'accounts_manager', 'sales_manager', 'user'] },
  { pageKey: 'RoutesDiagnostics', title: 'Routes Diagnostics', moduleKey: 'ADMIN', icon: Activity, roles: ['admin', 'user'] },
];

/**
 * MODULE REGISTRY
 * Groups pages logically for navigation & permission checking
 */
export const moduleRegistry = [
  {
    moduleKey: 'DASHBOARD',
    label: 'Dashboard',
    icon: LayoutDashboard,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    adminOnly: false,
    sortOrder: 1,
  },
  {
    moduleKey: 'PRODUCTION',
    label: 'Production',
    icon: Factory,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    adminOnly: false,
    sortOrder: 2,
  },
  {
    moduleKey: 'LABELLING',
    label: 'Labelling & Packing',
    icon: Tag,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    adminOnly: false,
    sortOrder: 3,
  },
  {
    moduleKey: 'LBL_DEPT',
    label: 'Labelling Department',
    icon: Printer,
    color: 'text-fuchsia-600',
    bgColor: 'bg-fuchsia-50',
    adminOnly: false,
    sortOrder: 3.5,
  },
  {
    moduleKey: 'WAREHOUSE',
    label: 'Warehouse & FG',
    icon: Warehouse,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    adminOnly: false,
    sortOrder: 4,
  },
  {
    moduleKey: 'PURCHASE',
    label: 'Purchase',
    icon: ShoppingCart,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    adminOnly: false,
    sortOrder: 5,
  },
  {
    moduleKey: 'STORE',
    label: 'Store Management',
    icon: Store,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    adminOnly: false,
    sortOrder: 6,
  },
  {
    moduleKey: 'QUALITY',
    label: 'Quality',
    icon: TestTube2,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    adminOnly: false,
    sortOrder: 7,
  },
  {
    moduleKey: 'ACCOUNTS',
    label: 'Accounts',
    icon: CreditCard,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    adminOnly: false,
    sortOrder: 8,
  },
  {
    moduleKey: 'FMS',
    label: 'Process Flow',
    icon: GitBranch,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    adminOnly: false,
    sortOrder: 9,
  },
  {
    moduleKey: 'USER_MANAGEMENT',
    label: 'User Management',
    icon: Users,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    adminOnly: true,
    sortOrder: 99,
  },
  {
    moduleKey: 'SALES',
    label: 'Sales',
    icon: ShoppingCart,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    adminOnly: false,
    sortOrder: 45,
  },
  {
    moduleKey: 'ALL_ITEMS',
    label: 'All Items',
    icon: PackageSearch,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    adminOnly: false,
    sortOrder: 5.5,
  },
  {
    moduleKey: 'ADMIN',
    label: 'System',
    icon: Settings,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    adminOnly: false,
    sortOrder: 100,
  },
];

/**
 * SPECIAL HIDDEN PAGES
 * System pages not shown in navigation but still routable
 */
export const specialPages = [
  { pageKey: 'CustomizeDashboard', title: 'Customize Dashboard', roles: ['admin'], system: true },
  { pageKey: 'OperatorDashboardMobile', title: 'Operator Dashboard', roles: ['admin', 'user'], system: true },
];

/**
 * Get all navigable pages (exclude special/system pages)
 */
export function getAllPages() {
  return pageRegistry;
}

/**
 * Get page by key
 */
export function getPageByKey(pageKey) {
  return pageRegistry.find(p => p.pageKey === pageKey);
}

/**
 * Get all pages in a module
 */
export function getPagesInModule(moduleKey) {
  return pageRegistry.filter(p => p.moduleKey === moduleKey);
}

/**
 * Get module by key
 */
export function getModuleByKey(moduleKey) {
  return moduleRegistry.find(m => m.moduleKey === moduleKey);
}

/**
 * Get module for a page
 */
export function getModuleForPage(pageKey) {
  const page = getPageByKey(pageKey);
  return page ? getModuleByKey(page.moduleKey) : null;
}

/**
 * Get visible pages for a role in a module
 */
export function getVisiblePagesInModule(moduleKey, userRole) {
  const pages = getPagesInModule(moduleKey);
  const isAdmin = userRole === 'admin';
  
  return pages.filter(p => {
    if (p.adminOnly && !isAdmin) return false;
    return p.roles.includes(userRole) || p.roles.includes('user');
  }).sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99));
}

/**
 * Get visible modules for a role
 */
export function getVisibleModules(userRole) {
  const isAdmin = userRole === 'admin';
  
  return moduleRegistry
    .filter(m => {
      if (m.adminOnly && !isAdmin) return false;
      // Module visible if it has at least one visible page
      const visiblePages = getVisiblePagesInModule(m.moduleKey, userRole);
      return visiblePages.length > 0 || m.moduleKey === 'DASHBOARD';
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Check if user can access a page
 */
export function canAccessPage(pageKey, userRole) {
  const page = getPageByKey(pageKey);
  if (!page) return false;
  const isAdmin = userRole === 'admin';
  if (page.adminOnly && !isAdmin) return false;
  return page.roles.includes(userRole) || page.roles.includes('user');
}

/**
 * Get all pages (including special) for routing
 */
export function getAllRoutablePages() {
  return [...pageRegistry, ...specialPages];
}