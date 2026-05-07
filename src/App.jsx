import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { getAllRoutablePages } from '@/lib/registryConfig';

// Dynamic import for pages
import AlertsPage from './pages/AlertsPage';
import ApprovalsInbox from './pages/ApprovalsInbox';
import AuditLogPage from './pages/AuditLogPage';
import BoxLabelApprovals from './pages/BoxLabelApprovals';
import BoxLabelPrint from './pages/BoxLabelPrint';
import BoxPalletBuild from './pages/BoxPalletBuild';
import BoxTypeManager from './pages/BoxTypeManager';
import ChamberStation from './pages/ChamberStation';
import CustomizeDashboard from './pages/CustomizeDashboard';
import Dashboard from './pages/Dashboard';
import DispatchCrates from './pages/DispatchCrates';
import FGPalletizing from './pages/FGPalletizing';
import FGWarehouse from './pages/FGWarehouse';
import FeederKiosk from './pages/FeederKiosk';
import FillingStation from './pages/FillingStation';
import GRNReceive from './pages/GRNReceive';
import GateEntry from './pages/GateEntry';
import GateInbox from './pages/GateInbox';
import ItemMasterManager from './pages/ItemMasterManager';
import IngredientGroupManager from './pages/IngredientGroupManager';
import IngredientManager from './pages/IngredientManager';
import InvoiceCapture from './pages/InvoiceCapture';
import LabelArtworkManager from './pages/LabelArtworkManager';
import LabelRollManager from './pages/LabelRollManager';
import LabellingLine from './pages/LabellingLine';
import LiquidPlans from './pages/LiquidPlans';
import MasterData from './pages/MasterData';
import PaymentRequests from './pages/PaymentRequests';
import ProductTaxonomy from './pages/ProductTaxonomy';
import ProductionControl from './pages/ProductionControl';
import ProductionOrders from './pages/ProductionOrders';
import PullLists from './pages/PullLists';
import MaterialRequest from './pages/MaterialRequest';
import PurchaseOrders from './pages/PurchaseOrders';
import PurchaseReports from './pages/PurchaseReports';
import Putaway from './pages/Putaway';
import QCInbox from './pages/QCInbox';
import RecipeBuilder from './pages/RecipeBuilder';
import RecipeStation from './pages/RecipeStation';

import SKUSetup from './pages/SKUSetup';
import ShiftKPIDashboard from './pages/ShiftKPIDashboard';
import StoresIssue from './pages/StoresIssue';
import SupplierManager from './pages/SupplierManager';
import TemplateMappingManager from './pages/TemplateMappingManager';
import ThreeWayMatch from './pages/ThreeWayMatch';
import TraceInvestigation from './pages/TraceInvestigation';
import TransferReceiving from './pages/TransferReceiving';
import UOMManager from './pages/UOMManager';
import WarehouseBins from './pages/WarehouseBins';
import FMSMyTasks from './pages/FMSMyTasks';
import FMSProcesses from './pages/FMSProcesses';
import FMSActiveRuns from './pages/FMSActiveRuns';
import FMSMonitor from './pages/FMSMonitor';
import UserManagement from './pages/UserManagement';
import RoleManager from './pages/RoleManager';
import ApprovalRulesManager from './pages/ApprovalRulesManager';
import PermissionMatrix from './pages/PermissionMatrix';
import PermissionMatrixDashboard from './pages/PermissionMatrixDashboard';
import ApprovalWorkflowHub from './pages/ApprovalWorkflowHub';
import AccessAuditLog from './pages/AccessAuditLog';
import FMSHealthDashboard from './pages/FMSHealthDashboard';
import OperatorDashboardMobile from './pages/OperatorDashboardMobile';
import PermissionPolicyManager from './pages/PermissionPolicyManager';
import RoutesDiagnostics from './pages/RoutesDiagnostics';
import SyncCenter from './pages/SyncCenter';
import RulesManager from './pages/RulesManager';
import BlockedAttemptsViewer from './pages/BlockedAttemptsViewer';
import TraceabilityExplorer from './pages/TraceabilityExplorer';
import ReconciliationDashboard from './pages/ReconciliationDashboard';
import AuditLogViewer from './pages/AuditLogViewer';
import SLAConfigManager from './pages/SLAConfigManager';
import SLAEscalationDashboard from './pages/SLAEscalationDashboard';
import SalesOrders from './pages/SalesOrders';
import SalesCustomerManager from './pages/SalesCustomerManager';
import SalesPriceListView from './pages/SalesPriceListView';
import SalesOrderDetail from './pages/SalesOrderDetail';
import SalesPicklistDetail from './pages/SalesPicklistDetail';
import SalesDeliveryNoteDetail from './pages/SalesDeliveryNoteDetail';
import SalesInvoiceDetail from './pages/SalesInvoiceDetail';
import SalesDistributors from './pages/SalesDistributors';
import SalesRateListManager from './pages/SalesRateListManager';
import SalesSettingsPage from './pages/SalesSettingsPage';
import DistributorPortal from './pages/DistributorPortal';
import SalesGRNReconciliation from './pages/SalesGRNReconciliation';
import TransportRateCards from './pages/TransportRateCards';
import SalesPicklists from './pages/SalesPicklists';
import SalesInvoices from './pages/SalesInvoices';
import SalesSKUManagement from './pages/SalesSKUManagement';
import SMSDashboard from './pages/SMSDashboard';
import SMSLocationManager from './pages/SMSLocationManager';
import SMSLotManager from './pages/SMSLotManager';
import SMSPutaway from './pages/SMSPutaway';
import SMSStockOut from './pages/SMSStockOut';
import SMSTransfer from './pages/SMSTransfer';
// SMSOpeningStock removed — Opening Stock now handled via Item Master
import SMSReorderConfig from './pages/SMSReorderConfig';
import SMSCycleCount from './pages/SMSCycleCount';
import SMSAdjustments from './pages/SMSAdjustments';
import SMSReports from './pages/SMSReports';
import SMSItemMaster from './pages/SMSItemMaster';
import SKUBOMConfig from './pages/SKUBOMConfig';
import ScheduledTaskManager from './pages/ScheduledTaskManager';
import LblPlanningDashboard from './pages/LblPlanningDashboard';
import LblPlanCreate from './pages/LblPlanCreate';
import LblPlanDetail from './pages/LblPlanDetail';
import LblOperatorQueue from './pages/LblOperatorQueue';
import LblOperatorJob from './pages/LblOperatorJob';
import LblSupervisorApprovals from './pages/LblSupervisorApprovals';
import LblMonitorDashboard from './pages/LblMonitorDashboard';
import LblChecklistBuilder from './pages/LblChecklistBuilder';
import LblEventLogPage from './pages/LblEventLogPage';
import LblMasterData from './pages/LblMasterData';
import LblDocTypePermissions from './pages/LblDocTypePermissions';
<<<<<<< HEAD
import StoreItemCreator from './pages/StoreItemCreator';
import SMSOpeningStockManager from './pages/SMSOpeningStockManager';
import ItemModule from './pages/ItemModule';
import EADashboard from './pages/EADashboard';
import DirectorDashboard from './pages/DirectorDashboard';
import ProjectManager from './pages/ProjectManager';
import DelegationScore from './pages/DelegationScore';
import QuickAssignTask from './pages/QuickAssignTask';
import AllItemsIngredients from './pages/AllItemsIngredients';
import AllItemsUOM from './pages/AllItemsUOM';
import AllItemsBoxTypes from './pages/AllItemsBoxTypes';
import AllItemsLabelArtworks from './pages/AllItemsLabelArtworks';
import AllItemsContainers from './pages/AllItemsContainers';
import AllItemsCaps from './pages/AllItemsCaps';
import AllItemsFlavours from './pages/AllItemsFlavours';
import PurchaseOrderCreate from './pages/PurchaseOrderCreate';
import POFollowUpTracker from './pages/POFollowUpTracker';
import PurchaseRequestApprovals from './pages/PurchaseRequestApprovals';
import PurchaseOrderTimeline from './pages/PurchaseOrderTimeline';
import CentralItemHub from './pages/CentralItemHub';
import BulkPOCreate from './pages/BulkPOCreate';
import PurchaseRequestList from './pages/PurchaseRequestList';
import PurchaseOrderList from './pages/PurchaseOrderList';
import WhatsAppTemplateManager from './pages/WhatsAppTemplateManager';
=======
import RynanPrinterCenter from './pages/RynanPrinterCenter';
import LblPrintTemplateManager from './pages/LblPrintTemplateManager';
import PageFieldPermissions from './pages/PageFieldPermissions';
import BoxLabelTemplateManager from './pages/BoxLabelTemplateManager';
import BoxLabelTemplateBuilder from './pages/BoxLabelTemplateBuilder';
import PrintManagementDashboard from './pages/PrintManagementDashboard';
import PrintJobCreate from './pages/PrintJobCreate';
import PrintJobs from './pages/PrintJobs';
import PrintManagementAdmin from './pages/PrintManagementAdmin';
import HRAttendanceLogs from './pages/HRAttendanceLogs';
import HRAttendanceSummary from './pages/HRAttendanceSummary';
import HRShiftTimings from './pages/HRShiftTimings';
import HRHolidays from './pages/HRHolidays';
import HRManualPunchRequest from './pages/HRManualPunchRequest';
import HRManualPunchApprovals from './pages/HRManualPunchApprovals';
import HREmployeeDailyHours from './pages/HREmployeeDailyHours';
import HREmployees from './pages/HREmployees';
import HRDepartments from './pages/HRDepartments';
import HRDesignations from './pages/HRDesignations';
import HRBranches from './pages/HRBranches';
import HRCompanies from './pages/HRCompanies';
import HRLeaveTypes from './pages/HRLeaveTypes';
import HRNotificationSettings from './pages/HRNotificationSettings';
import HRAttendanceAlerts from './pages/HRAttendanceAlerts';
import HRCandidateLeads from './pages/HRCandidateLeads';
import HRAttritionDashboard from './pages/HRAttritionDashboard';
import HRTerminationForm from './pages/HRTerminationForm';
import ExitInterviewSurvey from './pages/ExitInterviewSurvey';
>>>>>>> kunal/main

// Page component lookup table
const PAGE_COMPONENTS = {
  AlertsPage, ApprovalsInbox, AuditLogPage, BoxLabelApprovals, BoxLabelPrint, BoxPalletBuild, BoxTypeManager,
  ChamberStation, CustomizeDashboard, Dashboard, DispatchCrates, FGPalletizing, FGWarehouse, FeederKiosk, FillingStation,
  GRNReceive, GateEntry, GateInbox, ItemMasterManager, IngredientGroupManager, IngredientManager, InvoiceCapture, LabelArtworkManager,
  LabelRollManager, LabellingLine, LiquidPlans, MasterData, PaymentRequests, ProductTaxonomy,
  ProductionControl, ProductionOrders, PullLists, Putaway, QCInbox, RecipeBuilder,
  MaterialRequest, PurchaseOrders, PurchaseReports,
  RecipeStation, SKUSetup, ShiftKPIDashboard, StoresIssue, SupplierManager, TemplateMappingManager,
  ThreeWayMatch, TraceInvestigation, TransferReceiving, UOMManager, WarehouseBins,
  FMSMyTasks, FMSProcesses, FMSActiveRuns, FMSMonitor, UserManagement, RoleManager, ApprovalRulesManager,
  PermissionMatrix, PermissionMatrixDashboard, ApprovalWorkflowHub, AccessAuditLog, FMSHealthDashboard,
  OperatorDashboardMobile, PermissionPolicyManager, SyncCenter, RulesManager, BlockedAttemptsViewer, TraceabilityExplorer, ReconciliationDashboard, RoutesDiagnostics, AuditLogViewer,
  SLAConfigManager, SLAEscalationDashboard,
  SalesOrders, SalesDistributors, SalesRateListManager, SalesSettingsPage, DistributorPortal,
  SalesPicklistDetail, SalesDeliveryNoteDetail, SalesInvoiceDetail,
  SalesCustomerManager, SalesPriceListView, SalesGRNReconciliation, TransportRateCards,
  SalesPicklists, SalesInvoices, SalesSKUManagement,
  SMSDashboard, SMSLocationManager, SMSLotManager, SMSPutaway, SMSStockOut,
      SMSTransfer, SMSReorderConfig, SMSCycleCount, SMSAdjustments, SMSReports, SMSItemMaster,
  SKUBOMConfig, ScheduledTaskManager,
  LblPlanningDashboard, LblPlanCreate, LblPlanDetail, LblOperatorQueue, LblOperatorJob,
  LblSupervisorApprovals, LblMonitorDashboard, LblChecklistBuilder, LblEventLogPage,
  LblMasterData,
  LblDocTypePermissions,
<<<<<<< HEAD
  StoreItemCreator,
  SMSOpeningStockManager,
  ItemModule,
  EADashboard,
  DirectorDashboard,
  ProjectManager,
  DelegationScore,
  QuickAssignTask,
  AllItemsIngredients,
  AllItemsUOM,
  AllItemsBoxTypes,
  AllItemsLabelArtworks,
  AllItemsContainers,
  AllItemsCaps,
  AllItemsFlavours,
  PurchaseOrderCreate,
  POFollowUpTracker,
  PurchaseRequestApprovals,
  PurchaseOrderTimeline,
  CentralItemHub,
  BulkPOCreate,
  PurchaseRequestList,
  PurchaseOrderList,
  WhatsAppTemplateManager,
=======
  RynanPrinterCenter,
  PrintManagementDashboard, PrintJobCreate, PrintJobs, PrintManagementAdmin,
  HRDepartments, HRDesignations, HRBranches, HRCompanies, HRLeaveTypes,
  HRNotificationSettings, HRAttendanceAlerts,
>>>>>>> kunal/main
};

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app with auto-generated routes from registry
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName="FMSMyTasks">
          <FMSMyTasks />
        </LayoutWrapper>
      } />
      
      {/* Labelling Department */}
      <Route path="/LblPrintTemplateManager" element={<LayoutWrapper currentPageName="LblPrintTemplateManager"><LblPrintTemplateManager /></LayoutWrapper>} />

      {/* Explicit route for Audit Log Viewer */}
      <Route
        path="/AuditLogViewer"
        element={
          <LayoutWrapper currentPageName="AuditLogViewer">
            <AuditLogViewer />
          </LayoutWrapper>
        }
      />

      {/* Transfer Receiving with params */}
      <Route
        path="/TransferReceiving/:transferId"
        element={
          <LayoutWrapper currentPageName="TransferReceiving">
            <TransferReceiving />
          </LayoutWrapper>
        }
      />

      {/* SLA Routes */}
      <Route
        path="/SLAConfigManager"
        element={
          <LayoutWrapper currentPageName="SLAConfigManager">
            <SLAConfigManager />
          </LayoutWrapper>
        }
      />
      <Route
        path="/SLAEscalationDashboard"
        element={
          <LayoutWrapper currentPageName="SLAEscalationDashboard">
            <SLAEscalationDashboard />
          </LayoutWrapper>
        }
      />

      {/* Distributor Portal */}
      <Route
        path="/DistributorPortal"
        element={
          <LayoutWrapper currentPageName="DistributorPortal">
            <DistributorPortal />
          </LayoutWrapper>
        }
      />

      {/* Sales Order Detail — not in auto-registry loop */}
      <Route
        path="/SalesOrderDetail"
        element={
          <LayoutWrapper currentPageName="SalesOrderDetail">
            <SalesOrderDetail />
          </LayoutWrapper>
        }
      />

      {/* Sales document detail pages */}
      <Route
        path="/SalesCustomerManager"
        element={<LayoutWrapper currentPageName="SalesCustomerManager"><SalesCustomerManager /></LayoutWrapper>}
      />
      <Route
        path="/SalesPriceListView"
        element={<LayoutWrapper currentPageName="SalesPriceListView"><SalesPriceListView /></LayoutWrapper>}
      />
      <Route
        path="/SalesPicklistDetail"
        element={
          <LayoutWrapper currentPageName="SalesPicklistDetail">
            <SalesPicklistDetail />
          </LayoutWrapper>
        }
      />
      <Route
        path="/SalesDeliveryNoteDetail"
        element={
          <LayoutWrapper currentPageName="SalesDeliveryNoteDetail">
            <SalesDeliveryNoteDetail />
          </LayoutWrapper>
        }
      />
      <Route
        path="/SalesGRNReconciliation"
        element={<LayoutWrapper currentPageName="SalesGRNReconciliation"><SalesGRNReconciliation /></LayoutWrapper>}
      />
      <Route
        path="/SalesPicklists"
        element={<LayoutWrapper currentPageName="SalesPicklists"><SalesPicklists /></LayoutWrapper>}
      />
      <Route
        path="/SalesInvoices"
        element={<LayoutWrapper currentPageName="SalesInvoices"><SalesInvoices /></LayoutWrapper>}
      />
      <Route
        path="/SalesInvoiceDetail"
        element={
          <LayoutWrapper currentPageName="SalesInvoiceDetail">
            <SalesInvoiceDetail />
          </LayoutWrapper>
        }
      />

      {/* Material Planning Configuration */}
      <Route
        path="/SKUBOMConfig"
        element={<LayoutWrapper currentPageName="SKUBOMConfig"><SKUBOMConfig /></LayoutWrapper>}
      />

      {/* Scheduled Tasks */}
      <Route
        path="/ScheduledTaskManager"
        element={<LayoutWrapper currentPageName="ScheduledTaskManager"><ScheduledTaskManager /></LayoutWrapper>}
      />

      {/* Labelling Department Module */}
      <Route path="/LblPlanningDashboard" element={<LayoutWrapper currentPageName="LblPlanningDashboard"><LblPlanningDashboard /></LayoutWrapper>} />
      <Route path="/LblPlanCreate" element={<LayoutWrapper currentPageName="LblPlanCreate"><LblPlanCreate /></LayoutWrapper>} />
      <Route path="/LblPlanDetail" element={<LayoutWrapper currentPageName="LblPlanDetail"><LblPlanDetail /></LayoutWrapper>} />
      <Route path="/LblOperatorQueue" element={<LayoutWrapper currentPageName="LblOperatorQueue"><LblOperatorQueue /></LayoutWrapper>} />
      <Route path="/LblOperatorJob" element={<LayoutWrapper currentPageName="LblOperatorJob"><LblOperatorJob /></LayoutWrapper>} />
      <Route path="/LblSupervisorApprovals" element={<LayoutWrapper currentPageName="LblSupervisorApprovals"><LblSupervisorApprovals /></LayoutWrapper>} />
      <Route path="/LblMonitorDashboard" element={<LayoutWrapper currentPageName="LblMonitorDashboard"><LblMonitorDashboard /></LayoutWrapper>} />
      <Route path="/LblChecklistBuilder" element={<LayoutWrapper currentPageName="LblChecklistBuilder"><LblChecklistBuilder /></LayoutWrapper>} />
      <Route path="/LblEventLogPage" element={<LayoutWrapper currentPageName="LblEventLogPage"><LblEventLogPage /></LayoutWrapper>} />
      <Route path="/LblMasterData" element={<LayoutWrapper currentPageName="LblMasterData"><LblMasterData /></LayoutWrapper>} />
      <Route path="/LblDocTypePermissions" element={<LayoutWrapper currentPageName="LblDocTypePermissions"><LblDocTypePermissions /></LayoutWrapper>} />
      <Route path="/RynanPrinterCenter" element={<LayoutWrapper currentPageName="RynanPrinterCenter"><RynanPrinterCenter /></LayoutWrapper>} />
      <Route path="/PageFieldPermissions" element={<LayoutWrapper currentPageName="PageFieldPermissions"><PageFieldPermissions /></LayoutWrapper>} />
      <Route path="/BoxLabelTemplateManager" element={<LayoutWrapper currentPageName="BoxLabelTemplateManager"><BoxLabelTemplateManager /></LayoutWrapper>} />
      <Route path="/BoxLabelTemplateBuilder" element={<LayoutWrapper currentPageName="BoxLabelTemplateBuilder"><BoxLabelTemplateBuilder /></LayoutWrapper>} />

      {/* Print Management Module */}
      <Route path="/PrintManagementDashboard" element={<LayoutWrapper currentPageName="PrintManagementDashboard"><PrintManagementDashboard /></LayoutWrapper>} />
      <Route path="/PrintJobCreate" element={<LayoutWrapper currentPageName="PrintJobCreate"><PrintJobCreate /></LayoutWrapper>} />
      <Route path="/PrintJobs" element={<LayoutWrapper currentPageName="PrintJobs"><PrintJobs /></LayoutWrapper>} />
      <Route path="/PrintManagementAdmin" element={<LayoutWrapper currentPageName="PrintManagementAdmin"><PrintManagementAdmin /></LayoutWrapper>} />

      {/* HR Module */}
      <Route path="/HRAttendanceLogs" element={<LayoutWrapper currentPageName="HRAttendanceLogs"><HRAttendanceLogs /></LayoutWrapper>} />
      <Route path="/HRAttendanceSummary" element={<LayoutWrapper currentPageName="HRAttendanceSummary"><HRAttendanceSummary /></LayoutWrapper>} />
      <Route path="/HRShiftTimings" element={<LayoutWrapper currentPageName="HRShiftTimings"><HRShiftTimings /></LayoutWrapper>} />
      <Route path="/HRHolidays" element={<LayoutWrapper currentPageName="HRHolidays"><HRHolidays /></LayoutWrapper>} />
      <Route path="/HRManualPunchRequest" element={<LayoutWrapper currentPageName="HRManualPunchRequest"><HRManualPunchRequest /></LayoutWrapper>} />
      <Route path="/HRManualPunchApprovals" element={<LayoutWrapper currentPageName="HRManualPunchApprovals"><HRManualPunchApprovals /></LayoutWrapper>} />
      <Route path="/HREmployeeDailyHours" element={<LayoutWrapper currentPageName="HREmployeeDailyHours"><HREmployeeDailyHours /></LayoutWrapper>} />
      <Route path="/HREmployees" element={<LayoutWrapper currentPageName="HREmployees"><HREmployees /></LayoutWrapper>} />
      <Route path="/HRDepartments" element={<LayoutWrapper currentPageName="HRDepartments"><HRDepartments /></LayoutWrapper>} />
      <Route path="/HRDesignations" element={<LayoutWrapper currentPageName="HRDesignations"><HRDesignations /></LayoutWrapper>} />
      <Route path="/HRBranches" element={<LayoutWrapper currentPageName="HRBranches"><HRBranches /></LayoutWrapper>} />
      <Route path="/HRCompanies" element={<LayoutWrapper currentPageName="HRCompanies"><HRCompanies /></LayoutWrapper>} />
      <Route path="/HRLeaveTypes" element={<LayoutWrapper currentPageName="HRLeaveTypes"><HRLeaveTypes /></LayoutWrapper>} />
      <Route path="/HRNotificationSettings" element={<LayoutWrapper currentPageName="HRNotificationSettings"><HRNotificationSettings /></LayoutWrapper>} />
      <Route path="/HRAttendanceAlerts" element={<LayoutWrapper currentPageName="HRAttendanceAlerts"><HRAttendanceAlerts /></LayoutWrapper>} />
      <Route path="/HRCandidateLeads" element={<LayoutWrapper currentPageName="HRCandidateLeads"><HRCandidateLeads /></LayoutWrapper>} />
      <Route path="/HRAttritionDashboard" element={<LayoutWrapper currentPageName="HRAttritionDashboard"><HRAttritionDashboard /></LayoutWrapper>} />
      <Route path="/HRTerminationForm" element={<LayoutWrapper currentPageName="HRTerminationForm"><HRTerminationForm /></LayoutWrapper>} />
      {/* Public exit interview survey — no layout, no auth gate (token-validated) */}
      <Route path="/ExitInterviewSurvey" element={<ExitInterviewSurvey />} />

      {/* ItemModule removed — replaced by All Items module pages */}

      {/* EA Dashboard */}
      <Route path="/EADashboard" element={<LayoutWrapper currentPageName="EADashboard"><EADashboard /></LayoutWrapper>} />
      
      {/* Director Dashboard */}
      <Route path="/DirectorDashboard" element={<LayoutWrapper currentPageName="DirectorDashboard"><DirectorDashboard /></LayoutWrapper>} />

      {/* Project Manager */}
      <Route path="/ProjectManager" element={<LayoutWrapper currentPageName="ProjectManager"><ProjectManager /></LayoutWrapper>} />

      {/* Delegation Score */}
      <Route path="/DelegationScore" element={<LayoutWrapper currentPageName="DelegationScore"><DelegationScore /></LayoutWrapper>} />

      {/* Quick Assign Task — standalone, no layout wrapper */}
      <Route path="/QuickAssignTask" element={<QuickAssignTask />} />

      {/* Purchase Module Extended */}
      <Route path="/PurchaseOrderCreate" element={<LayoutWrapper currentPageName="PurchaseOrderCreate"><PurchaseOrderCreate /></LayoutWrapper>} />
      <Route path="/POFollowUpTracker" element={<LayoutWrapper currentPageName="POFollowUpTracker"><POFollowUpTracker /></LayoutWrapper>} />
      <Route path="/PurchaseRequestApprovals" element={<LayoutWrapper currentPageName="PurchaseRequestApprovals"><PurchaseRequestApprovals /></LayoutWrapper>} />

      <Route path="/CentralItemHub" element={<LayoutWrapper currentPageName="CentralItemHub"><CentralItemHub /></LayoutWrapper>} />
      <Route path="/BulkPOCreate" element={<LayoutWrapper currentPageName="BulkPOCreate"><BulkPOCreate /></LayoutWrapper>} />
      <Route path="/PurchaseRequestList" element={<LayoutWrapper currentPageName="PurchaseRequestList"><PurchaseRequestList /></LayoutWrapper>} />
      <Route path="/PurchaseOrderList" element={<LayoutWrapper currentPageName="PurchaseOrderList"><PurchaseOrderList /></LayoutWrapper>} />

      {/* WhatsApp Template Manager */}
      <Route path="/WhatsAppTemplateManager" element={<LayoutWrapper currentPageName="WhatsAppTemplateManager"><WhatsAppTemplateManager /></LayoutWrapper>} />

      {/* All Items Module */}
      <Route path="/AllItemsIngredients" element={<LayoutWrapper currentPageName="AllItemsIngredients"><AllItemsIngredients /></LayoutWrapper>} />
      <Route path="/AllItemsUOM" element={<LayoutWrapper currentPageName="AllItemsUOM"><AllItemsUOM /></LayoutWrapper>} />
      <Route path="/AllItemsBoxTypes" element={<LayoutWrapper currentPageName="AllItemsBoxTypes"><AllItemsBoxTypes /></LayoutWrapper>} />
      <Route path="/AllItemsLabelArtworks" element={<LayoutWrapper currentPageName="AllItemsLabelArtworks"><AllItemsLabelArtworks /></LayoutWrapper>} />
      <Route path="/AllItemsContainers" element={<LayoutWrapper currentPageName="AllItemsContainers"><AllItemsContainers /></LayoutWrapper>} />
      <Route path="/AllItemsCaps" element={<LayoutWrapper currentPageName="AllItemsCaps"><AllItemsCaps /></LayoutWrapper>} />
      <Route path="/AllItemsFlavours" element={<LayoutWrapper currentPageName="AllItemsFlavours"><AllItemsFlavours /></LayoutWrapper>} />

      {/* Store Management System Routes */}
      {[
        ['SMSDashboard', SMSDashboard], ['SMSLocationManager', SMSLocationManager],
        ['SMSLotManager', SMSLotManager], ['SMSPutaway', SMSPutaway],
        ['SMSStockOut', SMSStockOut], ['SMSTransfer', SMSTransfer],
        // StoreItemCreator removed — items created directly in All Items module
        ['SMSReorderConfig', SMSReorderConfig],
        ['SMSCycleCount', SMSCycleCount], ['SMSAdjustments', SMSAdjustments],
        ['SMSReports', SMSReports], ['SMSItemMaster', SMSItemMaster],
        ['SMSOpeningStockManager', SMSOpeningStockManager],
      ].map(([key, Comp]) => (
        <Route key={key} path={`/${key}`} element={<LayoutWrapper currentPageName={key}><Comp /></LayoutWrapper>} />
      ))}

      {/* Auto-generated routes from unified registry */}
      {getAllRoutablePages().map((pageEntry) => {
        const Component = PAGE_COMPONENTS[pageEntry.pageKey];
        if (!Component) {
          console.warn(`Page component not found for ${pageEntry.pageKey}`);
          return null;
        }
        return (
          <Route
            key={pageEntry.pageKey}
            path={`/${pageEntry.pageKey}`}
            element={
              <LayoutWrapper currentPageName={pageEntry.pageKey}>
                <Component />
              </LayoutWrapper>
            }
          />
        );
      })}
      
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App