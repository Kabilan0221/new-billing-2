import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Receipt,
  ShoppingCart,
  Boxes,
  AlertTriangle,
  PackageX,
  Users,
  CreditCard,
  Banknote,
  RefreshCw,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { db } from '../services/dbEngine';
import { DashboardMetrics } from '../types';

interface DashboardViewProps {
  onNavigate: (sectionKey: string) => void;
  onRefreshData?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onRefreshData }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const reloadMetrics = () => {
    setIsRefreshing(true);
    try {
      const data = db.getDashboardMetrics();
      setMetrics(data);
      if (onRefreshData) onRefreshData();
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

  useEffect(() => {
    reloadMetrics();
  }, []);

  if (!metrics) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f0f2f5] text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
        <span>Loading SQLite Executive Dashboard...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f0f2f5] overflow-y-auto select-none">
      {/* Top Banner */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Executive Dashboard & Store Overview</h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
              Live SQLite WAL
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time transaction aggregates across 50,000 catalog items, GST invoices, customer ledgers, and inventory.
          </p>
        </div>

        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          <button
            onClick={reloadMetrics}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#106ebe] hover:bg-[#005a9e] text-white text-xs font-semibold rounded shadow-xs cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Metrics</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* 9 Summary Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
          {/* Card 1: Today's Sales */}
          <div
            onClick={() => onNavigate('history')}
            className="bg-white p-4 rounded border border-slate-200 border-l-4 border-l-blue-600 shadow-xs hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Today's Sales</span>
              <TrendingUp className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              ₹{metrics.todaySales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span>{metrics.todayBillsCount} confirmed bills today</span>
              <ArrowUpRight className="w-3 h-3 text-emerald-600 inline" />
            </div>
          </div>

          {/* Card 2: Today's Bill Count */}
          <div
            onClick={() => onNavigate('pos')}
            className="bg-white p-4 rounded border border-slate-200 border-l-4 border-l-sky-500 shadow-xs hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Today's Bills Count</span>
              <Receipt className="w-5 h-5 text-sky-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{metrics.todayBillsCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">POS Billing active terminal #01</div>
          </div>

          {/* Card 3: Today's Purchases */}
          <div
            onClick={() => onNavigate('inbound')}
            className="bg-white p-4 rounded border border-slate-200 border-l-4 border-l-purple-600 shadow-xs hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Today's Purchases</span>
              <ShoppingCart className="w-5 h-5 text-purple-600 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              ₹{metrics.todayPurchaseTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Inbound stock receipt vouchers</div>
          </div>

          {/* Card 4: Total Products */}
          <div
            onClick={() => onNavigate('products')}
            className="bg-white p-4 rounded border border-slate-200 border-l-4 border-l-teal-600 shadow-xs hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Products Master</span>
              <Boxes className="w-5 h-5 text-teal-600 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              {metrics.totalProducts.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Fast B-Tree hash indexed catalogue</div>
          </div>

          {/* Card 5: Low-Stock Product Count */}
          <div
            onClick={() => onNavigate('stock')}
            className="bg-white p-4 rounded border border-slate-200 border-l-4 border-l-amber-500 shadow-xs hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Low Stock Alert</span>
              <AlertTriangle className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-black text-amber-700 mt-2">{metrics.lowStockProductCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Items at or below reorder threshold</div>
          </div>

          {/* Card 6: Out-of-Stock Product Count */}
          <div
            onClick={() => onNavigate('stock')}
            className="bg-white p-4 rounded border border-slate-200 border-l-4 border-l-rose-600 shadow-xs hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Out of Stock</span>
              <PackageX className="w-5 h-5 text-rose-600 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-black text-rose-700 mt-2">{metrics.outOfStockProductCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Inventory depleted; PO reorder needed</div>
          </div>

          {/* Card 7: Total Customer Count */}
          <div
            onClick={() => onNavigate('customers')}
            className="bg-white p-4 rounded border border-slate-200 border-l-4 border-l-indigo-600 shadow-xs hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Customers</span>
              <Users className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{metrics.totalCustomerCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Retail accounts & Walk-in directory</div>
          </div>

          {/* Card 8: Outstanding Customer Balance */}
          <div
            onClick={() => onNavigate('customers')}
            className="bg-white p-4 rounded border border-slate-200 border-l-4 border-l-pink-600 shadow-xs hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Customer Outstanding</span>
              <CreditCard className="w-5 h-5 text-pink-600 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              ₹{metrics.outstandingCustomerBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Pending credit balance to collect</div>
          </div>

          {/* Card 9: Payments Received Today */}
          <div
            onClick={() => onNavigate('history')}
            className="bg-white p-4 rounded border border-slate-200 border-l-4 border-l-emerald-600 shadow-xs hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Payments Received Today</span>
              <Banknote className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-black text-emerald-800 mt-2">
              ₹{metrics.paymentsReceivedToday.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Tender collections (Cash, UPI, Card)</div>
          </div>
        </div>

        {/* Quick Action Navigation Bar */}
        <div className="bg-white p-4 rounded border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Fast Keyboard Shortcuts & Core Retail Modules:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'F1: POS Billing', nav: 'pos', color: 'hover:bg-blue-50 text-blue-800 border-blue-300' },
              { label: 'F2: Products', nav: 'products', color: 'hover:bg-emerald-50 text-emerald-800 border-emerald-300' },
              { label: 'F3: Inbound Goods', nav: 'inbound', color: 'hover:bg-purple-50 text-purple-800 border-purple-300' },
              { label: 'F4: Barcode Studio', nav: 'barcode', color: 'hover:bg-indigo-50 text-indigo-800 border-indigo-300' },
              { label: 'F5: Bill History', nav: 'history', color: 'hover:bg-cyan-50 text-cyan-800 border-cyan-300' },
              { label: 'F6: Customers', nav: 'customers', color: 'hover:bg-amber-50 text-amber-800 border-amber-300' },
              { label: 'F7: Suppliers', nav: 'suppliers', color: 'hover:bg-slate-100 text-slate-800 border-slate-300' },
              { label: 'F8: Stock', nav: 'stock', color: 'hover:bg-teal-50 text-teal-800 border-teal-300' },
              { label: 'F9: Estimates', nav: 'invoices', color: 'hover:bg-rose-50 text-rose-800 border-rose-300' },
              { label: 'F10: Reports', nav: 'reports', color: 'hover:bg-orange-50 text-orange-800 border-orange-300' },
            ].map((btn) => (
              <button
                key={btn.nav}
                onClick={() => onNavigate(btn.nav)}
                className={`px-3 py-1.5 text-xs font-bold rounded border bg-white shadow-2xs cursor-pointer transition-all ${btn.color}`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
