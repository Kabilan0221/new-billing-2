import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Truck,
  Barcode,
  FileClock,
  Users,
  Layers,
  FileSpreadsheet,
  BarChart3,
  Trash2,
  Settings,
  Building,
  HardDriveDownload,
  CreditCard,
  Database,
} from 'lucide-react';

export interface NavItem {
  id: number;
  key: string;
  label: string;
  shortcut?: string;
  icon: React.ComponentType<{ className?: string }>;
  isPhase1Active: boolean;
}

export const SIDEBAR_ITEMS: NavItem[] = [
  { id: 1, key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, isPhase1Active: true },
  { id: 2, key: 'pos', label: 'POS Billing', shortcut: 'F1', icon: ShoppingCart, isPhase1Active: true },
  { id: 3, key: 'products', label: 'Products', shortcut: 'F2', icon: Boxes, isPhase1Active: true },
  { id: 4, key: 'inbound', label: 'Inbound Goods', shortcut: 'F3', icon: Truck, isPhase1Active: true },
  { id: 5, key: 'barcode', label: 'Barcode Studio', shortcut: 'F4', icon: Barcode, isPhase1Active: true },
  { id: 6, key: 'payments', label: 'Payments', shortcut: 'F5', icon: CreditCard, isPhase1Active: true },
  { id: 7, key: 'history', label: 'Bill History', shortcut: 'F6', icon: FileClock, isPhase1Active: true },
  { id: 8, key: 'customers', label: 'Customers', shortcut: 'F7', icon: Users, isPhase1Active: true },
  { id: 9, key: 'suppliers', label: 'Suppliers', icon: Building, isPhase1Active: true },
  { id: 10, key: 'stock', label: 'Stock', shortcut: 'F8', icon: Layers, isPhase1Active: true },
  { id: 11, key: 'invoices', label: 'Estimates & Invoices', shortcut: 'F11', icon: FileSpreadsheet, isPhase1Active: true },
  { id: 12, key: 'reports', label: 'Reports', shortcut: 'F10', icon: BarChart3, isPhase1Active: true },
  { id: 13, key: 'data', label: 'Data Management', icon: Database, isPhase1Active: true },
  { id: 14, key: 'settings', label: 'Settings', icon: Settings, isPhase1Active: true },
  { id: 15, key: 'backup', label: 'Backup & Restore', icon: HardDriveDownload, isPhase1Active: true },
];

interface Win7SidebarProps {
  activeNav: string;
  onSelectNav: (key: string) => void;
  productCount: number;
  lowStockCount: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Win7Sidebar: React.FC<Win7SidebarProps> = ({
  activeNav,
  onSelectNav,
  productCount,
  lowStockCount,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  return (
    <aside
      className={`no-print transition-all duration-200 shrink-0 bg-[#212b36] border-r border-[#19212a] flex flex-col justify-between text-slate-200 select-none ${
        isCollapsed ? 'w-13' : 'w-56'
      }`}
    >
      {/* Menu List */}
      <div className="py-2 overflow-y-auto max-h-[calc(100vh-120px)] custom-scrollbar">
        <div className={`px-2.5 pb-2 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} text-[10px] font-bold uppercase tracking-wider text-slate-400`}>
          {!isCollapsed && <span>Navigation</span>}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1 hover:bg-slate-700/60 rounded text-slate-400 hover:text-white cursor-pointer transition-colors"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar (Full Width)"}
            >
              {isCollapsed ? (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
              ) : (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
              )}
            </button>
          )}
        </div>
        <nav className="space-y-0.5 px-1">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onSelectNav(item.key)}
                title={`${item.label} ${item.shortcut ? `(${item.shortcut})` : ''}`}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center px-1.5 py-2' : 'justify-between px-2.5 py-1.5'
                } rounded text-xs transition-colors text-left group ${
                  isActive
                    ? 'bg-[#106ebe] text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:bg-[#304050] hover:text-white'
                }`}
              >
                <div className={`flex items-center gap-2 ${isCollapsed ? 'justify-center' : 'truncate'}`}>
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>
                {!isCollapsed && item.shortcut && (
                  <span
                    className={`text-[10px] px-1 py-0.2 rounded font-mono shrink-0 ml-1 ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-700/60 text-slate-400'
                    }`}
                  >
                    {item.shortcut}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Terminal status pill at bottom */}
      {!isCollapsed ? (
        <div className="p-2.5 bg-[#171f28] border-t border-[#101720] text-[11px] text-slate-400 space-y-1">
          <div className="flex justify-between items-center">
            <span>Active Catalog:</span>
            <span className="font-semibold text-slate-200 font-mono">{productCount.toLocaleString()}</span>
          </div>
          {lowStockCount > 0 && (
            <div className="flex justify-between items-center text-rose-400">
              <span>Low Stock Items:</span>
              <span className="font-semibold font-mono">{lowStockCount.toLocaleString()}</span>
            </div>
          )}
          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-700/50">
            SQLite 3.39 · WAL Mode · Win 7 SP1
          </div>
        </div>
      ) : (
        <div className="p-1.5 bg-[#171f28] border-t border-[#101720] text-center" title={`Active: ${productCount.toLocaleString()} items`}>
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
        </div>
      )}
    </aside>
  );
};
