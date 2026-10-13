import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Search,
  Calendar,
  Printer,
  TrendingUp,
  Boxes,
  ShoppingCart,
  Users,
  CreditCard,
  RefreshCw,
} from 'lucide-react';
import { db } from '../services/dbEngine';
import {
  SalesReportRow,
  ProductWiseSalesReportRow,
  PurchaseReportRow,
  StockReportRow,
  CustomerReportRow,
  PaymentCollectionReportRow,
} from '../types';

interface ReportsViewProps {
  onRefreshData?: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ onRefreshData }) => {
  const [reportType, setReportType] = useState<
    'sales' | 'product_sales' | 'purchases' | 'stock' | 'customers' | 'payments'
  >('sales');

  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Confirmed' | 'Cancelled'>('Confirmed');

  // Report Data States
  const [salesRows, setSalesRows] = useState<SalesReportRow[]>([]);
  const [prodSalesRows, setProdSalesRows] = useState<ProductWiseSalesReportRow[]>([]);
  const [purchaseRows, setPurchaseRows] = useState<PurchaseReportRow[]>([]);
  const [stockRows, setStockRows] = useState<StockReportRow[]>([]);
  const [customerRows, setCustomerRows] = useState<CustomerReportRow[]>([]);
  const [paymentRows, setPaymentRows] = useState<PaymentCollectionReportRow[]>([]);

  // Load report data
  const runReport = () => {
    const filter = {
      fromDate,
      toDate: toDate + 'T23:59:59.999Z',
      searchTerm,
      status: statusFilter,
    };

    if (reportType === 'sales') {
      setSalesRows(db.getSalesReport(filter));
    } else if (reportType === 'product_sales') {
      setProdSalesRows(db.getProductWiseSalesReport(filter));
    } else if (reportType === 'purchases') {
      setPurchaseRows(db.getPurchaseReport(filter));
    } else if (reportType === 'stock') {
      setStockRows(db.getStockReport(filter));
    } else if (reportType === 'customers') {
      setCustomerRows(db.getCustomerReport(filter));
    } else if (reportType === 'payments') {
      setPaymentRows(db.getPaymentCollectionReport(filter));
    }

    if (onRefreshData) onRefreshData();
  };

  useEffect(() => {
    runReport();
  }, [reportType, fromDate, toDate, statusFilter]);

  // Quick Date Range Helpers
  const setQuickRange = (range: 'today' | '7days' | 'month' | '30days') => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (range === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (range === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      setFromDate(d.toISOString().slice(0, 10));
      setToDate(todayStr);
    } else if (range === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(start.toISOString().slice(0, 10));
      setToDate(todayStr);
    } else if (range === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      setFromDate(d.toISOString().slice(0, 10));
      setToDate(todayStr);
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = `Report_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;

    const escapeCsv = (val: string | number | undefined) => {
      if (val === undefined || val === null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    if (reportType === 'sales') {
      headers = [
        'Invoice #',
        'Date',
        'Customer',
        'Payment Mode',
        'Status',
        'Items',
        'Quantity',
        'Gross Amount',
        'Discount',
        'Taxable',
        'GST',
        'Grand Total',
      ];
      rows = salesRows.map((r) => [
        escapeCsv(r.documentNumber),
        escapeCsv(r.documentDate),
        escapeCsv(r.customerName),
        escapeCsv(r.paymentMethod),
        escapeCsv(r.status),
        escapeCsv(r.totalItems),
        escapeCsv(r.totalQuantity),
        escapeCsv(r.grossAmount.toFixed(2)),
        escapeCsv(r.discountAmount.toFixed(2)),
        escapeCsv(r.taxableAmount.toFixed(2)),
        escapeCsv(r.totalTax.toFixed(2)),
        escapeCsv(r.grandTotal.toFixed(2)),
      ]);
    } else if (reportType === 'product_sales') {
      headers = [
        'Product Code',
        'Barcode',
        'Product Name',
        'Unit',
        'Qty Sold',
        'Bills Count',
        'Total Discount',
        'Total GST',
        'Total Revenue',
      ];
      rows = prodSalesRows.map((r) => [
        escapeCsv(r.productCode),
        escapeCsv(r.barcode),
        escapeCsv(r.productName),
        escapeCsv(r.unit),
        escapeCsv(r.quantitySold),
        escapeCsv(r.billCount),
        escapeCsv(r.totalDiscount.toFixed(2)),
        escapeCsv(r.totalTax.toFixed(2)),
        escapeCsv(r.totalRevenue.toFixed(2)),
      ]);
    } else if (reportType === 'purchases') {
      headers = [
        'Purchase #',
        'Date',
        'Supplier',
        'Supplier Bill #',
        'Payment Type',
        'Quantity',
        'Taxable',
        'Tax',
        'Grand Total',
        'Amount Paid',
        'Balance Due',
      ];
      rows = purchaseRows.map((r) => [
        escapeCsv(r.purchaseNumber),
        escapeCsv(r.purchaseDate),
        escapeCsv(r.supplierName),
        escapeCsv(r.supplierInvoiceNumber),
        escapeCsv(r.paymentType),
        escapeCsv(r.totalQuantity),
        escapeCsv(r.taxableAmount.toFixed(2)),
        escapeCsv(r.taxAmount.toFixed(2)),
        escapeCsv(r.grandTotal.toFixed(2)),
        escapeCsv(r.amountPaid.toFixed(2)),
        escapeCsv(r.balanceDue.toFixed(2)),
      ]);
    } else if (reportType === 'stock') {
      headers = [
        'Product Code',
        'Barcode',
        'Product Name',
        'Category',
        'Unit',
        'Current Stock',
        'Reorder Level',
        'Status',
        'Purchase Rate',
        'Sale Rate',
        'Valuation @ Cost',
        'Valuation @ Sale',
      ];
      rows = stockRows.map((r) => [
        escapeCsv(r.productCode),
        escapeCsv(r.barcode),
        escapeCsv(r.productName),
        escapeCsv(r.categoryName),
        escapeCsv(r.unit),
        escapeCsv(r.currentStock),
        escapeCsv(r.reorderLevel),
        escapeCsv(r.stockStatus),
        escapeCsv(r.purchaseRate.toFixed(2)),
        escapeCsv(r.saleRate.toFixed(2)),
        escapeCsv(r.stockValueAtCost.toFixed(2)),
        escapeCsv(r.stockValueAtSale.toFixed(2)),
      ]);
    } else if (reportType === 'customers') {
      headers = ['Code', 'Name', 'Mobile', 'GSTIN', 'Invoices', 'Total Billed', 'Total Paid', 'Outstanding Balance'];
      rows = customerRows.map((r) => [
        escapeCsv(r.customerCode),
        escapeCsv(r.customerName),
        escapeCsv(r.mobile),
        escapeCsv(r.gstin),
        escapeCsv(r.invoicesCount),
        escapeCsv(r.totalBilledAmount.toFixed(2)),
        escapeCsv(r.totalPaidAmount.toFixed(2)),
        escapeCsv(r.outstandingBalance.toFixed(2)),
      ]);
    } else if (reportType === 'payments') {
      headers = ['Payment ID', 'Date', 'Invoice #', 'Customer', 'Tender Mode', 'Reference #', 'Amount'];
      rows = paymentRows.map((r) => [
        escapeCsv(r.paymentId),
        escapeCsv(r.paymentDate),
        escapeCsv(r.invoiceNumber),
        escapeCsv(r.customerName),
        escapeCsv(r.paymentMode),
        escapeCsv(r.referenceNumber),
        escapeCsv(r.amount.toFixed(2)),
      ]);
    }

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Summary Metrics Bar
  const summaryText = useMemo(() => {
    if (reportType === 'sales') {
      const totalSales = salesRows.reduce((sum, r) => sum + r.grandTotal, 0);
      const totalTax = salesRows.reduce((sum, r) => sum + r.totalTax, 0);
      const totalQty = salesRows.reduce((sum, r) => sum + r.totalQuantity, 0);
      return `Total Bills: ${salesRows.length}  |  Total Billed Qty: ${totalQty} units  |  Total GST: ₹${totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}  |  Gross Sales: ₹${totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    } else if (reportType === 'product_sales') {
      const totalRev = prodSalesRows.reduce((sum, r) => sum + r.totalRevenue, 0);
      const totalQty = prodSalesRows.reduce((sum, r) => sum + r.quantitySold, 0);
      return `Distinct Products Sold: ${prodSalesRows.length}  |  Total Qty Sold: ${totalQty}  |  Revenue: ₹${totalRev.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    } else if (reportType === 'purchases') {
      const totalPur = purchaseRows.reduce((sum, r) => sum + r.grandTotal, 0);
      const totalDue = purchaseRows.reduce((sum, r) => sum + r.balanceDue, 0);
      return `Purchases: ${purchaseRows.length} vouchers  |  Total Purchases: ₹${totalPur.toLocaleString('en-IN', { minimumFractionDigits: 2 })}  |  Balance Due: ₹${totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    } else if (reportType === 'stock') {
      const totalVal = stockRows.reduce((sum, r) => sum + r.stockValueAtCost, 0);
      const totalUnits = stockRows.reduce((sum, r) => sum + r.currentStock, 0);
      return `Catalog Items: ${stockRows.length}  |  Total Stock: ${totalUnits} units  |  Valuation @ Cost: ₹${totalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    } else if (reportType === 'customers') {
      const totalOut = customerRows.reduce((sum, r) => sum + r.outstandingBalance, 0);
      return `Total Customers: ${customerRows.length}  |  Net Outstanding Balance: ₹${totalOut.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    } else {
      const totalCollected = paymentRows.reduce((sum, r) => sum + r.amount, 0);
      return `Receipts: ${paymentRows.length} transactions  |  Total Tender Collected: ₹${totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    }
  }, [reportType, salesRows, prodSalesRows, purchaseRows, stockRows, customerRows, paymentRows]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f0f2f5] select-none overflow-hidden">
      {/* Top Header & Report Navigation Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-700" />
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Statutory & Business Intelligence Reports (F10)
              </h1>
            </div>
            <p className="text-xs text-slate-500">
              Aggregated from persisted SQLite transactions with RFC 4180 CSV export and GST reporting.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold rounded shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Preview</span>
            </button>
          </div>
        </div>

        {/* Module Selection Pills */}
        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
          {[
            { key: 'sales', label: 'Sales (Bill Wise)', icon: TrendingUp },
            { key: 'product_sales', label: 'Sales (Product Wise)', icon: Boxes },
            { key: 'purchases', label: 'Purchases & Inbound', icon: ShoppingCart },
            { key: 'stock', label: 'Stock Valuation & Status', icon: Boxes },
            { key: 'customers', label: 'Customers & Balances', icon: Users },
            { key: 'payments', label: 'Payment Collections', icon: CreditCard },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = reportType === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setReportType(tab.key as any)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Pickers */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> From:
            </span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded text-xs bg-slate-50 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded text-xs bg-slate-50 focus:bg-white"
            />
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1">
            {[
              { label: 'Today', key: 'today' },
              { label: '7 Days', key: '7days' },
              { label: 'This Month', key: 'month' },
              { label: '30 Days', key: '30days' },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => setQuickRange(p.key as any)}
                className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] text-slate-700 cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          {reportType === 'sales' && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2 py-1 border border-slate-300 rounded text-xs bg-slate-50 focus:bg-white"
              >
                <option value="Confirmed">Confirmed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="All">All Vouchers</option>
              </select>
            </div>
          )}

          {/* Search Term */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
            <input
              type="text"
              placeholder="Search keyword..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runReport()}
              className="pl-7 pr-2 py-1 border border-slate-300 rounded text-xs w-44 bg-slate-50 focus:bg-white"
            />
          </div>

          <button
            onClick={runReport}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold cursor-pointer transition-colors"
          >
            Run
          </button>
        </div>
      </div>

      {/* Main Grid Content Area */}
      <div className="flex-1 overflow-auto bg-white p-4">
        {reportType === 'sales' && (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold sticky top-0">
                <th className="py-2 px-3">Invoice #</th>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Customer</th>
                <th className="py-2 px-3">Payment</th>
                <th className="py-2 px-3 text-center">Items</th>
                <th className="py-2 px-3 text-center">Qty</th>
                <th className="py-2 px-3 text-right">Gross</th>
                <th className="py-2 px-3 text-right">Discount</th>
                <th className="py-2 px-3 text-right">Taxable</th>
                <th className="py-2 px-3 text-right">GST</th>
                <th className="py-2 px-3 text-right font-black">Grand Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salesRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400 font-medium">
                    No confirmed sales invoices found in the selected date range.
                  </td>
                </tr>
              ) : (
                salesRows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-semibold text-blue-700">{r.documentNumber}</td>
                    <td className="py-2 px-3 text-slate-600">{r.documentDate.slice(0, 16).replace('T', ' ')}</td>
                    <td className="py-2 px-3 text-slate-800">{r.customerName}</td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-medium">
                        {r.paymentMethod}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">{r.totalItems}</td>
                    <td className="py-2 px-3 text-center">{r.totalQuantity}</td>
                    <td className="py-2 px-3 text-right text-slate-600">₹{r.grossAmount.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right text-amber-600">₹{r.discountAmount.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right text-slate-600">₹{r.taxableAmount.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right text-slate-600">₹{r.totalTax.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">₹{r.grandTotal.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {reportType === 'product_sales' && (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold sticky top-0">
                <th className="py-2 px-3">Product Code</th>
                <th className="py-2 px-3">Barcode</th>
                <th className="py-2 px-3">Product Name</th>
                <th className="py-2 px-3 text-center">Unit</th>
                <th className="py-2 px-3 text-center">Qty Sold</th>
                <th className="py-2 px-3 text-center">Bills Count</th>
                <th className="py-2 px-3 text-right">Total Discount</th>
                <th className="py-2 px-3 text-right">Total GST</th>
                <th className="py-2 px-3 text-right font-black">Revenue (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {prodSalesRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                    No product sales transactions recorded for this period.
                  </td>
                </tr>
              ) : (
                prodSalesRows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-semibold text-slate-800">{r.productCode}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{r.barcode}</td>
                    <td className="py-2 px-3 font-medium text-slate-900">{r.productName}</td>
                    <td className="py-2 px-3 text-center text-slate-600">{r.unit}</td>
                    <td className="py-2 px-3 text-center font-bold text-blue-800">{r.quantitySold}</td>
                    <td className="py-2 px-3 text-center">{r.billCount}</td>
                    <td className="py-2 px-3 text-right text-amber-600">₹{r.totalDiscount.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right text-slate-600">₹{r.totalTax.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-800">₹{r.totalRevenue.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {reportType === 'purchases' && (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold sticky top-0">
                <th className="py-2 px-3">Purchase #</th>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Supplier Name</th>
                <th className="py-2 px-3">Supplier Bill #</th>
                <th className="py-2 px-3 text-center">Type</th>
                <th className="py-2 px-3 text-center">Qty</th>
                <th className="py-2 px-3 text-right">Taxable</th>
                <th className="py-2 px-3 text-right">Tax</th>
                <th className="py-2 px-3 text-right font-bold">Grand Total</th>
                <th className="py-2 px-3 text-right">Amount Paid</th>
                <th className="py-2 px-3 text-right text-rose-700 font-bold">Balance Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchaseRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400 font-medium">
                    No confirmed purchase entries found.
                  </td>
                </tr>
              ) : (
                purchaseRows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-semibold text-purple-700">{r.purchaseNumber}</td>
                    <td className="py-2 px-3 text-slate-600">{r.purchaseDate.slice(0, 10)}</td>
                    <td className="py-2 px-3 text-slate-900 font-medium">{r.supplierName}</td>
                    <td className="py-2 px-3 text-slate-600">{r.supplierInvoiceNumber || '-'}</td>
                    <td className="py-2 px-3 text-center">{r.paymentType}</td>
                    <td className="py-2 px-3 text-center">{r.totalQuantity}</td>
                    <td className="py-2 px-3 text-right text-slate-600">₹{r.taxableAmount.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right text-slate-600">₹{r.taxAmount.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">₹{r.grandTotal.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right text-emerald-700">₹{r.amountPaid.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right text-rose-700 font-bold">₹{r.balanceDue.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {reportType === 'stock' && (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold sticky top-0">
                <th className="py-2 px-3">Product Code</th>
                <th className="py-2 px-3">Barcode</th>
                <th className="py-2 px-3">Product Name</th>
                <th className="py-2 px-3">Category</th>
                <th className="py-2 px-3 text-center">In-Hand Stock</th>
                <th className="py-2 px-3 text-center">Status</th>
                <th className="py-2 px-3 text-right">Cost Price</th>
                <th className="py-2 px-3 text-right">Sale Price</th>
                <th className="py-2 px-3 text-right font-bold">Valuation @ Cost</th>
                <th className="py-2 px-3 text-right font-bold">Valuation @ Sale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stockRows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-semibold text-slate-800">{r.productCode}</td>
                  <td className="py-2 px-3 font-mono text-slate-600">{r.barcode}</td>
                  <td className="py-2 px-3 font-medium text-slate-900">{r.productName}</td>
                  <td className="py-2 px-3 text-slate-600">{r.categoryName}</td>
                  <td className="py-2 px-3 text-center font-bold text-slate-900">
                    {r.currentStock} {r.unit}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        r.stockStatus === 'Out of Stock'
                          ? 'bg-rose-100 text-rose-800'
                          : r.stockStatus === 'Low Stock'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {r.stockStatus}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right text-slate-600">₹{r.purchaseRate.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right text-slate-600">₹{r.saleRate.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right font-bold text-blue-900">₹{r.stockValueAtCost.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right font-bold text-emerald-900">₹{r.stockValueAtSale.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {reportType === 'customers' && (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold sticky top-0">
                <th className="py-2 px-3">Code</th>
                <th className="py-2 px-3">Customer Name</th>
                <th className="py-2 px-3">Mobile</th>
                <th className="py-2 px-3">GSTIN</th>
                <th className="py-2 px-3 text-center">Invoices</th>
                <th className="py-2 px-3 text-right">Total Billed</th>
                <th className="py-2 px-3 text-right">Total Paid</th>
                <th className="py-2 px-3 text-right text-rose-700 font-bold">Outstanding Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customerRows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-semibold text-indigo-700">{r.customerCode}</td>
                  <td className="py-2 px-3 font-medium text-slate-900">{r.customerName}</td>
                  <td className="py-2 px-3 text-slate-600">{r.mobile || '-'}</td>
                  <td className="py-2 px-3 text-slate-600 font-mono">{r.gstin || '-'}</td>
                  <td className="py-2 px-3 text-center">{r.invoicesCount}</td>
                  <td className="py-2 px-3 text-right text-slate-600">₹{r.totalBilledAmount.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right text-emerald-700">₹{r.totalPaidAmount.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right font-bold text-rose-700">
                    ₹{r.outstandingBalance.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {reportType === 'payments' && (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold sticky top-0">
                <th className="py-2 px-3">Receipt ID</th>
                <th className="py-2 px-3">Payment Date</th>
                <th className="py-2 px-3">Invoice #</th>
                <th className="py-2 px-3">Customer</th>
                <th className="py-2 px-3">Tender Mode</th>
                <th className="py-2 px-3">Reference / UTR</th>
                <th className="py-2 px-3 text-right font-bold">Amount Collected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paymentRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                    No payment receipts found in selected range.
                  </td>
                </tr>
              ) : (
                paymentRows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono text-slate-600">#{r.paymentId}</td>
                    <td className="py-2 px-3 text-slate-600">{r.paymentDate.slice(0, 16).replace('T', ' ')}</td>
                    <td className="py-2 px-3 font-semibold text-blue-700">{r.invoiceNumber}</td>
                    <td className="py-2 px-3 text-slate-900">{r.customerName}</td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-800 font-bold">
                        {r.paymentMode}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600">{r.referenceNumber || '-'}</td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-800">₹{r.amount.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Summary Status Strip at Bottom */}
      <div className="bg-[#e2e8f0] border-t border-slate-300 px-6 py-2 flex items-center justify-between text-xs text-slate-800 font-semibold select-none">
        <div>{summaryText}</div>
        <div className="text-[11px] text-slate-500">ShopBilling Reporting Engine • SQLite WAL Mode</div>
      </div>
    </div>
  );
};
