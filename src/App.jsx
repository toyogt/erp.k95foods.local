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
import RyanTemplateManager from './pages/RyanTemplateManager';
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
import SalesOrderDetail from './pages/SalesOrderDetail';
import SalesPicklistDetail from './pages/SalesPicklistDetail';
import SalesDeliveryNoteDetail from './pages/SalesDeliveryNoteDetail';
import SalesInvoiceDetail from './pages/SalesInvoiceDetail';
import SalesDistributors from './pages/SalesDistributors';
import SalesRateListManager from './pages/SalesRateListManager';
import SalesSettingsPage from './pages/SalesSettingsPage';
import DistributorPortal from './pages/DistributorPortal';

// Page component lookup table
const PAGE_COMPONENTS = {
  AlertsPage, ApprovalsInbox, AuditLogPage, BoxLabelApprovals, BoxLabelPrint, BoxPalletBuild, BoxTypeManager,
  ChamberStation, CustomizeDashboard, Dashboard, DispatchCrates, FGPalletizing, FGWarehouse, FeederKiosk, FillingStation,
  GRNReceive, GateEntry, GateInbox, ItemMasterManager, IngredientGroupManager, IngredientManager, InvoiceCapture, LabelArtworkManager,
  LabelRollManager, LabellingLine, LiquidPlans, MasterData, PaymentRequests, ProductTaxonomy,
  ProductionControl, ProductionOrders, PullLists, Putaway, QCInbox, RecipeBuilder,
  MaterialRequest, PurchaseOrders, PurchaseReports,
  RecipeStation, RyanTemplateManager, SKUSetup, ShiftKPIDashboard, StoresIssue, SupplierManager, TemplateMappingManager,
  ThreeWayMatch, TraceInvestigation, TransferReceiving, UOMManager, WarehouseBins,
  FMSMyTasks, FMSProcesses, FMSActiveRuns, FMSMonitor, UserManagement, RoleManager, ApprovalRulesManager,
  PermissionMatrix, PermissionMatrixDashboard, ApprovalWorkflowHub, AccessAuditLog, FMSHealthDashboard,
  OperatorDashboardMobile, PermissionPolicyManager, SyncCenter, RulesManager, BlockedAttemptsViewer, TraceabilityExplorer, ReconciliationDashboard, RoutesDiagnostics, AuditLogViewer,
  SLAConfigManager, SLAEscalationDashboard,
  SalesOrders, SalesDistributors, SalesRateListManager, SalesSettingsPage, DistributorPortal,
  SalesPicklistDetail, SalesDeliveryNoteDetail, SalesInvoiceDetail,
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
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      
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
        path="/SalesInvoiceDetail"
        element={
          <LayoutWrapper currentPageName="SalesInvoiceDetail">
            <SalesInvoiceDetail />
          </LayoutWrapper>
        }
      />

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