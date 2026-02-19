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
import Dashboard from './pages/Dashboard';
import AuditLogPage from './pages/AuditLogPage';
import MasterData from './pages/MasterData';
import StoresIssue from './pages/StoresIssue';
import RecipeStation from './pages/RecipeStation';
import FillingStation from './pages/FillingStation';
import ChamberStation from './pages/ChamberStation';
import TransferReceiving from './pages/TransferReceiving';
import LabellingLine from './pages/LabellingLine';
import FGPalletizing from './pages/FGPalletizing';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "AuditLogPage": AuditLogPage,
    "MasterData": MasterData,
    "StoresIssue": StoresIssue,
    "RecipeStation": RecipeStation,
    "FillingStation": FillingStation,
    "ChamberStation": ChamberStation,
    "TransferReceiving": TransferReceiving,
    "LabellingLine": LabellingLine,
    "FGPalletizing": FGPalletizing,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};