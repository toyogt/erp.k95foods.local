/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AlertsPage from './pages/AlertsPage';
import ApprovalsInbox from './pages/ApprovalsInbox';
import AuditLogPage from './pages/AuditLogPage';
import BoxLabelApprovals from './pages/BoxLabelApprovals';
import BoxLabelPrint from './pages/BoxLabelPrint';
import BoxPalletBuild from './pages/BoxPalletBuild';
import BoxStockDashboard from './pages/BoxStockDashboard';
import BoxTypeManager from './pages/BoxTypeManager';
import ChamberStation from './pages/ChamberStation';
import CustomizeDashboard from './pages/CustomizeDashboard';
import Dashboard from './pages/Dashboard';
import FGPalletizing from './pages/FGPalletizing';
import FeederKiosk from './pages/FeederKiosk';
import FillingStation from './pages/FillingStation';
import GRNReceive from './pages/GRNReceive';
import GateEntry from './pages/GateEntry';
import GateInbox from './pages/GateInbox';
import IngredientGroupManager from './pages/IngredientGroupManager';
import IngredientManager from './pages/IngredientManager';
import InvoiceCapture from './pages/InvoiceCapture';
import LabelArtworkManager from './pages/LabelArtworkManager';
import LabelRollManager from './pages/LabelRollManager';
import LabellingLine from './pages/LabellingLine';
import LiquidPlans from './pages/LiquidPlans';
import MasterData from './pages/MasterData';
import OpeningStockImport from './pages/OpeningStockImport';
import PaymentRequests from './pages/PaymentRequests';
import ProductionControl from './pages/ProductionControl';
import ProductionOrders from './pages/ProductionOrders';
import PullLists from './pages/PullLists';
import PurchaseOps from './pages/PurchaseOps';
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
import WarehouseOps from './pages/WarehouseOps';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AlertsPage": AlertsPage,
    "ApprovalsInbox": ApprovalsInbox,
    "AuditLogPage": AuditLogPage,
    "BoxLabelApprovals": BoxLabelApprovals,
    "BoxLabelPrint": BoxLabelPrint,
    "BoxPalletBuild": BoxPalletBuild,
    "BoxStockDashboard": BoxStockDashboard,
    "BoxTypeManager": BoxTypeManager,
    "ChamberStation": ChamberStation,
    "CustomizeDashboard": CustomizeDashboard,
    "Dashboard": Dashboard,
    "FGPalletizing": FGPalletizing,
    "FeederKiosk": FeederKiosk,
    "FillingStation": FillingStation,
    "GRNReceive": GRNReceive,
    "GateEntry": GateEntry,
    "GateInbox": GateInbox,
    "IngredientGroupManager": IngredientGroupManager,
    "IngredientManager": IngredientManager,
    "InvoiceCapture": InvoiceCapture,
    "LabelArtworkManager": LabelArtworkManager,
    "LabelRollManager": LabelRollManager,
    "LabellingLine": LabellingLine,
    "LiquidPlans": LiquidPlans,
    "MasterData": MasterData,
    "OpeningStockImport": OpeningStockImport,
    "PaymentRequests": PaymentRequests,
    "ProductionControl": ProductionControl,
    "ProductionOrders": ProductionOrders,
    "PullLists": PullLists,
    "PurchaseOps": PurchaseOps,
    "Putaway": Putaway,
    "QCInbox": QCInbox,
    "RecipeBuilder": RecipeBuilder,
    "RecipeStation": RecipeStation,
    "RyanTemplateManager": RyanTemplateManager,
    "SKUSetup": SKUSetup,
    "ShiftKPIDashboard": ShiftKPIDashboard,
    "StoresIssue": StoresIssue,
    "SupplierManager": SupplierManager,
    "TemplateMappingManager": TemplateMappingManager,
    "ThreeWayMatch": ThreeWayMatch,
    "TraceInvestigation": TraceInvestigation,
    "TransferReceiving": TransferReceiving,
    "UOMManager": UOMManager,
    "WarehouseBins": WarehouseBins,
    "WarehouseOps": WarehouseOps,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};