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
import AuditLogPage from './pages/AuditLogPage';
import ChamberStation from './pages/ChamberStation';
import CustomizeDashboard from './pages/CustomizeDashboard';
import Dashboard from './pages/Dashboard';
import FGPalletizing from './pages/FGPalletizing';
import FillingStation from './pages/FillingStation';
import LabellingLine from './pages/LabellingLine';
import MasterData from './pages/MasterData';
import PullLists from './pages/PullLists';
import RecipeStation from './pages/RecipeStation';
import StoresIssue from './pages/StoresIssue';
import TransferReceiving from './pages/TransferReceiving';
import BoxLabelPrint from './pages/BoxLabelPrint';
import BoxLabelApprovals from './pages/BoxLabelApprovals';
import BoxPalletBuild from './pages/BoxPalletBuild';
import WarehouseOps from './pages/WarehouseOps';
import BoxStockDashboard from './pages/BoxStockDashboard';
import OpeningStockImport from './pages/OpeningStockImport';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AlertsPage": AlertsPage,
    "AuditLogPage": AuditLogPage,
    "ChamberStation": ChamberStation,
    "CustomizeDashboard": CustomizeDashboard,
    "Dashboard": Dashboard,
    "FGPalletizing": FGPalletizing,
    "FillingStation": FillingStation,
    "LabellingLine": LabellingLine,
    "MasterData": MasterData,
    "PullLists": PullLists,
    "RecipeStation": RecipeStation,
    "StoresIssue": StoresIssue,
    "TransferReceiving": TransferReceiving,
    "BoxLabelPrint": BoxLabelPrint,
    "BoxLabelApprovals": BoxLabelApprovals,
    "BoxPalletBuild": BoxPalletBuild,
    "WarehouseOps": WarehouseOps,
    "BoxStockDashboard": BoxStockDashboard,
    "OpeningStockImport": OpeningStockImport,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};