import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Search,
  Plus,
  Printer,
  ArrowRightLeft,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Eye,
  Edit,
  Trash2,
  Receipt,
  RotateCw,
  Info,
} from 'lucide-react';
import { db } from '../services/dbEngine';
import { EstimateHeader, Customer, Product, InvoiceHeader, InvoiceItem } from '../types';
import { SVTLogo } from './SVTLogo';
import { A4DotMatrixInvoice } from './A4DotMatrixInvoice';
import { printHtmlDirectly } from '../services/printService';
import { generateA4DotMatrixHtml, generateThermalReceiptHtml, generateThermalEstimateHtml } from '../services/a4InvoiceHtmlGenerator';

interface EstimatesAndInvoicesProps {
  onRefreshData?: () => void;
  onNavigateToPOS?: () => void;
  onNavigateToHistory?: (invoiceNum?: string) => void;
}

export const EstimatesAndInvoices: React.FC<EstimatesAndInvoicesProps> = ({
  onRefreshData,
  onNavigateToHistory,
}) => {
  // Main Tab: 'estimates' or 'invoices'
  const [activeMainTab, setActiveMainTab] = useState<'estimates' | 'invoices'>('estimates');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Draft' | 'Confirmed' | 'Converted' | 'Cancelled'>('All');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'All' | 'Confirmed' | 'Cancelled'>('All');

  // Estimates list & selection
  const [estimates, setEstimates] = useState<EstimateHeader[]>(() => db.getEstimates().items);
  const [invoices, setInvoices] = useState<InvoiceHeader[]>(() => db.getAllInvoices());

  // Active Modals state
  const [isNewEstimateOpen, setIsNewEstimateOpen] = useState(false);
  const [editingEstimate, setEditingEstimate] = useState<EstimateHeader | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceHeader | null>(null);

  // Conversion Modal
  const [convertingEstimate, setConvertingEstimate] = useState<EstimateHeader | null>(null);
  const [convertPaymentMethod, setConvertPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Credit'>('Cash');
  const [convertAmountPaid, setConvertAmountPaid] = useState<string>('');

  // Delete Confirmation Modal
  const [itemToDelete, setItemToDelete] = useState<{ type: 'estimate' | 'invoice'; id: number; number: string; total: number } | null>(null);

  // View Items Modal (on-demand inspection)
  const [viewingDocument, setViewingDocument] = useState<{
    type: 'estimate' | 'invoice';
    number: string;
    customer: string;
    date: string;
    items: any[];
    taxable: number;
    tax: number;
    grandTotal: number;
    notes?: string;
  } | null>(null);

  // Print Modals
  const [printEstimate, setPrintEstimate] = useState<EstimateHeader | null>(null);
  const [estimatePrintFormat, setEstimatePrintFormat] = useState<'thermal-80mm' | 'thermal-104mm' | 'a4' | 'a5'>('thermal-80mm');
  const [printInvoice, setPrintInvoice] = useState<InvoiceHeader | null>(null);
  const [invoicePrintFormat, setInvoicePrintFormat] = useState<'thermal-80mm' | 'thermal-104mm' | 'a4'>('thermal-80mm');

  // Notification Toast
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showNotification = (type: 'success' | 'error' | 'info', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  // Reload data
  const reloadData = () => {
    const estRes = db.getEstimates({ searchTerm, status: statusFilter });
    setEstimates(estRes.items);
    setInvoices(db.getAllInvoices());
  };

  useEffect(() => {
    reloadData();
  }, [searchTerm, statusFilter, invoiceStatusFilter]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    let list = [...invoices];
    if (invoiceStatusFilter !== 'All') {
      list = list.filter((i) => i.status === invoiceStatusFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (i) =>
          i.invoiceNumber.toLowerCase().includes(q) ||
          i.customerName.toLowerCase().includes(q) ||
          (i.customerMobile && i.customerMobile.includes(q))
      );
    }
    return list.sort((a, b) => new Date(b.invoiceDate || b.createdAt).getTime() - new Date(a.invoiceDate || a.createdAt).getTime());
  }, [invoices, invoiceStatusFilter, searchTerm]);

  // Handle Estimate Deletion
  const handleConfirmDelete = () => {
    if (!itemToDelete) return;

    if (itemToDelete.type === 'estimate') {
      const res = db.deleteEstimate(itemToDelete.id);
      if (res.success) {
        setItemToDelete(null);
        reloadData();
        onRefreshData?.();
        showNotification('success', `Estimate #${itemToDelete.number} has been deleted.`);
      } else {
        showNotification('error', res.errors.join(' '));
      }
    } else {
      const res = db.deleteInvoice(itemToDelete.id, true);
      if (res.success) {
        setItemToDelete(null);
        reloadData();
        onRefreshData?.();
        showNotification('success', `Invoice #${itemToDelete.number} deleted! Physical stock has been restored to inventory.`);
      } else {
        showNotification('error', res.errors.join(' '));
      }
    }
  };

  // Convert estimate to invoice action
  const handleConfirmConversion = () => {
    if (!convertingEstimate) return;

    const amt = convertAmountPaid !== '' ? parseFloat(convertAmountPaid) : convertingEstimate.grandTotal;

    const res = db.convertEstimateToInvoice(convertingEstimate.id, {
      paymentMethod: convertPaymentMethod,
      amountPaid: isNaN(amt) ? convertingEstimate.grandTotal : amt,
    });

    if (res.success && res.invoice) {
      setConvertingEstimate(null);
      reloadData();
      onRefreshData?.();
      showNotification(
        'success',
        `Estimate #${convertingEstimate.estimateNumber} converted to Confirmed Invoice #${res.invoice.invoiceNumber}! Stock deducted.`
      );
    } else {
      showNotification('error', res.errors.join(' '));
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (activeMainTab === 'estimates') {
      const rows = estimates.map((e) => ({
        'Estimate No': e.estimateNumber,
        Date: new Date(e.estimateDate).toLocaleDateString(),
        Customer: e.customerName,
        Phone: e.customerMobile || '',
        Status: e.status,
        'Total Items': e.totalItems,
        'Total Qty': e.totalQty,
        'Taxable (₹)': e.taxableAmount,
        'Total Tax (₹)': e.totalTaxAmount,
        'Grand Total (₹)': e.grandTotal,
        'Converted Invoice': e.convertedInvoiceNumber || 'N/A',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Estimates');
      XLSX.writeFile(wb, `ShopBilling_Estimates_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } else {
      const rows = filteredInvoices.map((inv) => ({
        'Invoice No': inv.invoiceNumber,
        Date: new Date(inv.invoiceDate || inv.createdAt).toLocaleDateString(),
        Customer: inv.customerName,
        Phone: inv.customerMobile || '',
        Status: inv.status,
        'Payment Status': inv.paymentStatus,
        'Payment Mode': inv.paymentMode || inv.payments?.[0]?.paymentMethod || 'Cash',
        'Total Items': inv.totalItems,
        'Total Qty': inv.totalQty,
        'Taxable (₹)': inv.taxableAmount,
        'Total Tax (₹)': inv.totalTaxAmount,
        'Grand Total (₹)': inv.grandTotal,
        'Amount Paid (₹)': inv.amountPaid,
        'Balance Due (₹)': inv.balanceDue,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
      XLSX.writeFile(wb, `ShopBilling_Invoices_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f0f2f5] overflow-hidden select-none text-xs">
      {/* Header Banner */}
      <div className="bg-[#182b49] text-white px-4 py-2.5 border-b border-[#0f1d33] flex items-center justify-between shadow-xs shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide flex items-center gap-2">
              <span>ESTIMATES & TAX INVOICES (F11)</span>
              <span className="text-[10px] bg-amber-500/30 text-amber-200 border border-amber-400/30 px-1.5 py-0.2 rounded font-semibold">
                Quotations & Sales Bills
              </span>
            </h1>
            <p className="text-[11px] text-slate-300">
              Manage pre-billing commercial estimates and confirmed GST sales invoices with direct Print, Edit, and Delete actions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeMainTab === 'estimates' && (
            <button
              onClick={() => setIsNewEstimateOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-xs cursor-pointer text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Estimate (Alt+N)</span>
            </button>
          )}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded text-xs cursor-pointer"
            title="Export to formatted Excel"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Excel Export</span>
          </button>
        </div>
      </div>

      {/* Main Mode Sub-Tabs (Estimates vs Invoices) */}
      <div className="bg-[#e4e8ef] px-4 pt-2 border-b border-slate-300 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveMainTab('estimates')}
            className={`px-4 py-2 font-bold text-xs rounded-t border-t border-x cursor-pointer transition-colors flex items-center gap-2 ${
              activeMainTab === 'estimates'
                ? 'bg-white text-blue-900 border-slate-300 border-b-transparent shadow-xs'
                : 'bg-slate-200/80 text-slate-600 border-transparent hover:bg-slate-300'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            <span>Estimates & Quotations</span>
            <span className="bg-blue-100 text-blue-800 text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold">
              {estimates.length}
            </span>
          </button>

          <button
            onClick={() => setActiveMainTab('invoices')}
            className={`px-4 py-2 font-bold text-xs rounded-t border-t border-x cursor-pointer transition-colors flex items-center gap-2 ${
              activeMainTab === 'invoices'
                ? 'bg-white text-blue-900 border-slate-300 border-b-transparent shadow-xs'
                : 'bg-slate-200/80 text-slate-600 border-transparent hover:bg-slate-300'
            }`}
          >
            <Receipt className="w-4 h-4 text-emerald-600" />
            <span>Confirmed Tax Invoices</span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold">
              {invoices.length}
            </span>
          </button>
        </div>

        <button
          onClick={reloadData}
          className="text-slate-600 hover:text-slate-900 flex items-center gap-1 text-[11px] mb-1 hover:bg-slate-300/60 px-2 py-1 rounded"
          title="Reload records"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`px-4 py-1.5 text-xs font-semibold flex items-center gap-2 shrink-0 ${
            notification.type === 'success'
              ? 'bg-emerald-100 text-emerald-800 border-b border-emerald-300'
              : notification.type === 'error'
              ? 'bg-rose-100 text-rose-800 border-b border-rose-300'
              : 'bg-blue-100 text-blue-800 border-b border-blue-300'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Toolbar Filter */}
      <div className="bg-white p-2.5 border-b border-slate-300 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder={
                activeMainTab === 'estimates'
                  ? 'Search estimate #, customer name, mobile...'
                  : 'Search invoice #, customer name, mobile...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded text-xs focus:outline-blue-500 font-medium"
            />
          </div>

          {activeMainTab === 'estimates' ? (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700"
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Converted">Converted</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          ) : (
            <select
              value={invoiceStatusFilter}
              onChange={(e) => setInvoiceStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700"
            >
              <option value="All">All Invoices</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          )}
        </div>

        <div className="text-slate-500 text-[11px] font-medium">
          Showing{' '}
          <strong className="text-slate-900 font-mono">
            {activeMainTab === 'estimates' ? estimates.length : filteredInvoices.length}
          </strong>{' '}
          records
        </div>
      </div>

      {/* Main Full-Height Workspace (Clean Grid without bottom split) */}
      <div className="flex-1 bg-white border border-[#c0c6cf] m-2 rounded shadow-xs flex flex-col overflow-hidden">
        {activeMainTab === 'estimates' ? (
          /* ================= ESTIMATES MASTER LIST ================= */
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-separate border-spacing-0">
              <thead className="sticky top-0 z-20 select-none shadow-xs">
                <tr>
                  <th className="py-2 px-3 w-32 sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">
                    Estimate No
                  </th>
                  <th className="py-2 px-3 w-36 sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">
                    Date
                  </th>
                  <th className="py-2 px-3 w-44 sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">
                    Customer
                  </th>
                  <th className="py-2 px-3 w-28 sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">
                    Mobile
                  </th>
                  <th className="py-2 px-2.5 w-16 text-center sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">
                    Items
                  </th>
                  <th className="py-2 px-2.5 w-16 text-center sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">
                    Qty
                  </th>
                  <th className="py-2 px-3 w-24 text-right sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">
                    Taxable
                  </th>
                  <th className="py-2 px-3 w-20 text-right sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">
                    GST
                  </th>
                  <th className="py-2 px-3 w-28 text-right font-black sticky top-0 z-20 bg-[#e9eef4] text-slate-900 border-b border-r border-[#cbd5e1] whitespace-nowrap">
                    Grand Total
                  </th>
                  <th className="py-2 px-3 w-24 text-center sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">
                    Status
                  </th>
                  <th className="py-2 px-3 w-36 sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">
                    Converted Invoice #
                  </th>
                  <th className="py-2 px-3 sticky top-0 z-20 bg-[#e9eef4] text-slate-800 font-black border-b border-[#cbd5e1] text-center min-w-[200px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {estimates.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-16 text-center text-slate-400 italic">
                      No estimates found. Click &quot;New Estimate (Alt+N)&quot; to create a commercial quotation.
                    </td>
                  </tr>
                ) : (
                  estimates.map((est) => (
                    <tr key={est.id} className="hover:bg-blue-50/70 transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-blue-900">{est.estimateNumber}</td>
                      <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                        {new Date(est.estimateDate).toLocaleDateString()} {new Date(est.estimateDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800">{est.customerName}</td>
                      <td className="py-2 px-3 font-mono text-slate-500">{est.customerMobile || '—'}</td>
                      <td className="py-2 px-2.5 text-center">{est.totalItems}</td>
                      <td className="py-2 px-2.5 text-center">{est.totalQty}</td>
                      <td className="py-2 px-3 text-right font-mono">₹{est.taxableAmount.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-700">₹{est.totalTaxAmount.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono font-black text-slate-950 text-sm">₹{est.grandTotal.toFixed(2)}</td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            est.status === 'Converted'
                              ? 'bg-purple-100 text-purple-800 border border-purple-300'
                              : est.status === 'Confirmed'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : est.status === 'Cancelled'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {est.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">
                        {est.convertedInvoiceNumber ? (
                          <span
                            onClick={() => onNavigateToHistory?.(est.convertedInvoiceNumber)}
                            className="text-blue-700 hover:underline font-bold cursor-pointer"
                          >
                            {est.convertedInvoiceNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Pending conversion</span>
                        )}
                      </td>

                      {/* ACTIONS COLUMN: Print, Edit, Delete, View */}
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* 1. Direct Thermal Print */}
                          <button
                            type="button"
                            onClick={() => {
                              const settings = db.getAppSettings();
                              printHtmlDirectly(
                                generateThermalEstimateHtml(est, settings, 80),
                                `Thermal_Estimate_${est.estimateNumber}`,
                                80
                              );
                              showNotification('success', `Estimate sent to 80mm thermal printer for #${est.estimateNumber}`);
                            }}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="Direct 3-Inch (80mm) Thermal POS Print"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Thermal</span>
                          </button>

                          {/* 2. Print Preview Modal */}
                          <button
                            type="button"
                            onClick={() => setPrintEstimate(est)}
                            className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded font-semibold text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="Print Quotation Preview"
                          >
                            <Printer className="w-3.5 h-3.5 text-blue-600" />
                            <span>Print</span>
                          </button>

                          {/* 2. Edit Estimate */}
                          {est.status !== 'Converted' && (
                            <button
                              type="button"
                              onClick={() => setEditingEstimate(est)}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded font-semibold text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Edit Estimate"
                            >
                              <Edit className="w-3.5 h-3.5 text-amber-700" />
                              <span>Edit</span>
                            </button>
                          )}

                          {/* 3. Delete Estimate */}
                          <button
                            type="button"
                            onClick={() =>
                              setItemToDelete({
                                type: 'estimate',
                                id: est.id,
                                number: est.estimateNumber,
                                total: est.grandTotal,
                              })
                            }
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded font-semibold text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="Delete Estimate"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Delete</span>
                          </button>

                          {/* 4. Convert to Invoice (if pending) */}
                          {est.status !== 'Converted' && est.status !== 'Cancelled' && (
                            <button
                              type="button"
                              onClick={() => {
                                setConvertingEstimate(est);
                                setConvertAmountPaid(est.grandTotal.toString());
                              }}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer"
                              title="Convert to Invoice"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              <span>Convert</span>
                            </button>
                          )}

                          {/* 5. View Items on demand */}
                          <button
                            type="button"
                            onClick={() =>
                              setViewingDocument({
                                type: 'estimate',
                                number: est.estimateNumber,
                                customer: est.customerName,
                                date: est.estimateDate,
                                items: est.items,
                                taxable: est.taxableAmount,
                                tax: est.totalTaxAmount,
                                grandTotal: est.grandTotal,
                                notes: est.notes,
                              })
                            }
                            className="px-1.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded text-[11px]"
                            title="View line items"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* ================= INVOICES MASTER LIST ================= */
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-separate border-spacing-0">
              <thead className="sticky top-0 z-20 select-none shadow-xs">
                <tr>
                  <th className="py-2 px-3 w-32 sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">
                    Invoice No
                  </th>
                  <th className="py-2 px-3 w-36 sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">
                    Date
                  </th>
                  <th className="py-2 px-3 w-44 sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">
                    Customer
                  </th>
                  <th className="py-2 px-3 w-28 sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">
                    Mobile
                  </th>
                  <th className="py-2 px-2.5 w-16 text-center sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">
                    Items
                  </th>
                  <th className="py-2 px-2.5 w-16 text-center sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">
                    Qty
                  </th>
                  <th className="py-2 px-3 w-24 text-right sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">
                    Taxable
                  </th>
                  <th className="py-2 px-3 w-20 text-right sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">
                    GST
                  </th>
                  <th className="py-2 px-3 w-28 text-right font-black sticky top-0 z-20 bg-[#e9eef4] text-slate-900 border-b border-r border-[#cbd5e1] whitespace-nowrap">
                    Grand Total
                  </th>
                  <th className="py-2 px-3 w-24 text-center sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">
                    Payment Status
                  </th>
                  <th className="py-2 px-3 w-24 text-center sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">
                    Tender Mode
                  </th>
                  <th className="py-2 px-3 sticky top-0 z-20 bg-[#e9eef4] text-slate-800 font-black border-b border-[#cbd5e1] text-center min-w-[200px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-16 text-center text-slate-400 italic">
                      No tax invoices found. Invoices are generated from POS Billing (F1) or converted from approved Estimates.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-emerald-50/60 transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                      <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                        {new Date(inv.invoiceDate || inv.createdAt).toLocaleDateString()} {new Date(inv.invoiceDate || inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800">{inv.customerName}</td>
                      <td className="py-2 px-3 font-mono text-slate-500">{inv.customerMobile || '—'}</td>
                      <td className="py-2 px-2.5 text-center">{inv.totalItems}</td>
                      <td className="py-2 px-2.5 text-center">{inv.totalQty}</td>
                      <td className="py-2 px-3 text-right font-mono">₹{inv.taxableAmount.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-700">₹{inv.totalTaxAmount.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono font-black text-slate-950 text-sm">₹{inv.grandTotal.toFixed(2)}</td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inv.paymentStatus === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : inv.paymentStatus === 'Partial'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {inv.paymentStatus}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center font-medium text-slate-600">
                        {inv.paymentMode || inv.payments?.[0]?.paymentMethod || 'Cash'}
                      </td>

                      {/* ACTIONS COLUMN: Print, Edit, Delete, View */}
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* 1. Direct Thermal Print (F9) */}
                          <button
                            type="button"
                            onClick={() => {
                              const settings = db.getAppSettings();
                              printHtmlDirectly(
                                generateThermalReceiptHtml(inv, settings, 80),
                                `Thermal_Receipt_${inv.invoiceNumber}`,
                                80
                              );
                              showNotification('success', `Receipt sent to 80mm thermal printer for #${inv.invoiceNumber}`);
                            }}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="Direct 3-Inch (80mm) Thermal POS Print - F9"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Thermal (F9)</span>
                          </button>

                          {/* 2. Print A4 Bill Preview */}
                          <button
                            type="button"
                            onClick={() => {
                              setInvoicePrintFormat('a4');
                              setPrintInvoice(inv);
                            }}
                            className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded font-semibold text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="Print A4 Tax Invoice / Preview Formats"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            <span>A4</span>
                          </button>

                          {/* 2. Edit Invoice */}
                          <button
                            type="button"
                            onClick={() => setEditingInvoice(inv)}
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded font-semibold text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="Edit Invoice"
                          >
                            <Edit className="w-3.5 h-3.5 text-amber-700" />
                            <span>Edit</span>
                          </button>

                          {/* 3. Delete Invoice */}
                          <button
                            type="button"
                            onClick={() =>
                              setItemToDelete({
                                type: 'invoice',
                                id: inv.id,
                                number: inv.invoiceNumber,
                                total: inv.grandTotal,
                              })
                            }
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded font-semibold text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="Delete Invoice and Restore Stock"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Delete</span>
                          </button>

                          {/* 4. View Items */}
                          <button
                            type="button"
                            onClick={() =>
                              setViewingDocument({
                                type: 'invoice',
                                number: inv.invoiceNumber,
                                customer: inv.customerName,
                                date: inv.invoiceDate || inv.createdAt,
                                items: inv.items,
                                taxable: inv.taxableAmount,
                                tax: inv.totalTaxAmount,
                                grandTotal: inv.grandTotal,
                                notes: inv.notes,
                              })
                            }
                            className="px-1.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded text-[11px]"
                            title="View line items"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------------- NEW / EDIT ESTIMATE MODAL ---------------- */}
      {(isNewEstimateOpen || editingEstimate) && (
        <EstimateEditorDialog
          initialEstimate={editingEstimate || undefined}
          onClose={() => {
            setIsNewEstimateOpen(false);
            setEditingEstimate(null);
          }}
          onSaved={() => {
            setIsNewEstimateOpen(false);
            setEditingEstimate(null);
            reloadData();
            onRefreshData?.();
            showNotification('success', editingEstimate ? 'Estimate updated successfully!' : 'New estimate created successfully!');
          }}
        />
      )}

      {/* ---------------- EDIT INVOICE MODAL ---------------- */}
      {editingInvoice && (
        <InvoiceEditorDialog
          invoice={editingInvoice}
          onClose={() => setEditingInvoice(null)}
          onSaved={() => {
            setEditingInvoice(null);
            reloadData();
            onRefreshData?.();
            showNotification('success', 'Invoice details updated successfully!');
          }}
        />
      )}

      {/* ---------------- DELETE CONFIRMATION MODAL ---------------- */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md border border-slate-300 overflow-hidden text-xs">
            <div className="bg-rose-900 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-300" />
                <h3 className="font-bold text-sm">
                  DELETE {itemToDelete.type === 'estimate' ? 'ESTIMATE' : 'TAX INVOICE'} #{itemToDelete.number}
                </h3>
              </div>
              <button onClick={() => setItemToDelete(null)} className="text-white font-bold p-1">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-slate-700 leading-relaxed">
                Are you sure you want to permanently delete{' '}
                <strong className="text-slate-900">
                  {itemToDelete.type === 'estimate' ? 'Estimate' : 'Tax Invoice'} #{itemToDelete.number}
                </strong>{' '}
                worth <strong className="text-slate-900">₹{itemToDelete.total.toFixed(2)}</strong>?
              </p>
              {itemToDelete.type === 'invoice' && (
                <div className="p-2.5 bg-amber-50 border border-amber-300 rounded text-amber-900 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Stock Safety:</strong> Deleting this invoice will automatically revert and restore physical stock to warehouse inventory.
                  </span>
                </div>
              )}
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-3.5 py-1.5 bg-white border border-slate-300 rounded font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Permanently Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- VIEW ITEMS MODAL (On-Demand) ---------------- */}
      {viewingDocument && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-slate-300 overflow-hidden text-xs">
            <div className="bg-[#182b49] text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-300" />
                <h3 className="font-bold text-sm">
                  LINE ITEMS — {viewingDocument.type === 'estimate' ? 'ESTIMATE' : 'INVOICE'} #{viewingDocument.number}
                </h3>
              </div>
              <button onClick={() => setViewingDocument(null)} className="text-white font-bold p-1">✕</button>
            </div>

            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-slate-700">
              <div>Customer: <strong className="text-slate-900">{viewingDocument.customer}</strong></div>
              <div>Date: <strong className="text-slate-900">{new Date(viewingDocument.date).toLocaleDateString()}</strong></div>
            </div>

            <div className="flex-1 overflow-auto p-3">
              <table className="w-full text-left text-xs border border-slate-200 rounded">
                <thead className="bg-[#e9eef4] text-slate-700 font-bold border-b border-slate-300">
                  <tr>
                    <th className="py-1.5 px-2.5 w-10 text-center">#</th>
                    <th className="py-1.5 px-2.5">Product Description</th>
                    <th className="py-1.5 px-2.5 w-16 text-center">Qty</th>
                    <th className="py-1.5 px-2.5 w-20 text-right">Rate</th>
                    <th className="py-1.5 px-2.5 w-16 text-center">GST %</th>
                    <th className="py-1.5 px-2.5 w-20 text-right">Tax (₹)</th>
                    <th className="py-1.5 px-2.5 w-24 text-right font-bold">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingDocument.items.map((it: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-1.5 px-2.5 text-center text-slate-400">{idx + 1}</td>
                      <td className="py-1.5 px-2.5 font-medium text-slate-900">
                        {it.productName} <span className="font-mono text-slate-400 text-[10px]">({it.productCode})</span>
                      </td>
                      <td className="py-1.5 px-2.5 text-center font-bold">
                        {it.quantity} {it.unit || 'PCS'}
                      </td>
                      <td className="py-1.5 px-2.5 text-right font-mono">₹{it.rate?.toFixed(2)}</td>
                      <td className="py-1.5 px-2.5 text-center">{it.taxRate}%</td>
                      <td className="py-1.5 px-2.5 text-right text-emerald-700 font-mono">₹{it.taxAmount?.toFixed(2)}</td>
                      <td className="py-1.5 px-2.5 text-right font-bold font-mono text-slate-900">₹{it.lineTotal?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between font-medium text-slate-700">
              <span className="text-[11px] text-slate-500">
                Notes: <em>{viewingDocument.notes || 'None'}</em>
              </span>
              <div className="flex items-center gap-4">
                <span>Taxable: ₹{viewingDocument.taxable.toFixed(2)}</span>
                <span>GST: ₹{viewingDocument.tax.toFixed(2)}</span>
                <span className="text-sm font-black text-slate-950">
                  Total: ₹{viewingDocument.grandTotal.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-white border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setViewingDocument(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 rounded text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- CONVERT TO INVOICE MODAL ---------------- */}
      {convertingEstimate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg border border-slate-300 overflow-hidden text-xs">
            <div className="bg-[#182b49] text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">CONVERT ESTIMATE TO CONFIRMED TAX INVOICE</h3>
              </div>
              <button onClick={() => setConvertingEstimate(null)} className="text-white font-bold p-1">✕</button>
            </div>

            <div className="p-4 space-y-3.5">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-900">
                <p className="font-bold mb-1">
                  Converting #{convertingEstimate.estimateNumber} for {convertingEstimate.customerName}
                </p>
                <p className="text-[11px] text-blue-800">
                  This action will validate stock, deduct warehouse inventory, register the customer receivable, and create an official tax invoice.
                </p>
              </div>

              {/* Items stock check preview */}
              <div className="border border-slate-200 rounded p-2.5 max-h-36 overflow-y-auto bg-slate-50">
                <span className="font-bold text-slate-700 block mb-1">Stock Availability Preview:</span>
                <div className="space-y-1">
                  {convertingEstimate.items.map((it) => {
                    const prod = db.getAllProducts().find((p) => p.id === it.productId);
                    const hasStock = prod && prod.currentStock >= it.quantity;
                    return (
                      <div key={it.productId} className="flex items-center justify-between text-[11px]">
                        <span className="truncate max-w-[220px]">{it.productName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">
                            Req: {it.quantity} | Available: {prod?.currentStock ?? 0}
                          </span>
                          {hasStock ? (
                            <span className="text-emerald-700 font-bold">✓ OK</span>
                          ) : (
                            <span className="text-rose-700 font-bold">✗ Short Stock</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payment Settlement */}
              <div className="border border-slate-200 rounded p-3 space-y-2 bg-white">
                <span className="font-bold text-slate-800 block">Payment Method & Settlement</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-1">Payment Tender</label>
                    <select
                      value={convertPaymentMethod}
                      onChange={(e) => setConvertPaymentMethod(e.target.value as any)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-semibold"
                    >
                      <option value="Cash">Cash Counter</option>
                      <option value="UPI">UPI / QR Code</option>
                      <option value="Card">Debit / Credit Card</option>
                      <option value="Bank Transfer">Bank Transfer / NEFT</option>
                      <option value="Credit">Credit (Debtor Account)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-1">Amount Collected (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={convertAmountPaid}
                      onChange={(e) => setConvertAmountPaid(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-bold text-emerald-800"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                  <span className="text-slate-600">Invoice Total:</span>
                  <span className="text-base font-black text-slate-900 font-mono">₹{convertingEstimate.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setConvertingEstimate(null)}
                className="px-4 py-1.5 bg-white border border-slate-300 text-slate-700 font-bold rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmConversion}
                className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Deduct Stock</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- PRINT ESTIMATE MODAL ---------------- */}
      {printEstimate && (() => {
        const storeSettings = db.getAppSettings();
        const estWidthMm = estimatePrintFormat === 'thermal-104mm' ? 104 : estimatePrintFormat === 'thermal-80mm' ? 80 : 210;

        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <style>{`
              @media print {
                @page {
                  size: ${estimatePrintFormat === 'a5' ? '210mm 148mm' : estimatePrintFormat.startsWith('thermal') ? `${estWidthMm}mm auto` : 'A4 portrait'};
                  margin: ${estimatePrintFormat.startsWith('thermal') ? '0mm' : estimatePrintFormat === 'a5' ? '4mm 6mm' : '8mm 6mm'};
                }
                body * { visibility: hidden !important; }
                #printable-estimate, #printable-estimate * { visibility: visible !important; }
                #printable-estimate {
                  position: absolute !important; left: 0 !important; top: 0 !important;
                  width: 100% !important; max-width: ${estimatePrintFormat.startsWith('thermal') ? `${estWidthMm}mm` : '198mm'} !important; margin: 0 auto !important;
                  padding: ${estimatePrintFormat.startsWith('thermal') ? '2mm 3mm' : '6mm 8mm'} !important; border: ${estimatePrintFormat.startsWith('thermal') ? 'none' : '1px solid #000000'} !important;
                  background: #ffffff !important; color: #000000 !important; display: block !important;
                }
              }
            `}</style>
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-slate-300 overflow-hidden">
              <div className="bg-[#182b49] text-white px-4 py-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-bold text-xs">PRINT PREVIEW — ESTIMATE / QUOTATION ({printEstimate.estimateNumber})</h3>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={estimatePrintFormat}
                    onChange={(e) => setEstimatePrintFormat(e.target.value as any)}
                    className="bg-white/10 hover:bg-white/20 text-white border border-white/30 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="thermal-80mm" className="text-slate-900 font-medium">🧾 3" Thermal (80mm POS Roll)</option>
                    <option value="thermal-104mm" className="text-slate-900 font-medium">🧾 4" Thermal (104mm POS Roll)</option>
                    <option value="a4" className="text-slate-900 font-medium">📄 A4 Full Sheet (210×297mm)</option>
                    <option value="a5" className="text-slate-900 font-medium">📄 A5 Half Sheet (210×148mm)</option>
                  </select>
                  <button onClick={() => setPrintEstimate(null)} className="text-slate-300 hover:text-white font-bold p-1">
                    ✕
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 flex justify-center items-start">
                {estimatePrintFormat.startsWith('thermal') ? (
                  <div
                    className={`${estimatePrintFormat === 'thermal-104mm' ? 'w-[420px]' : 'w-[320px]'} bg-white p-3 sm:p-4 pb-4 shadow-md border border-slate-300 font-mono text-xs`}
                    dangerouslySetInnerHTML={{
                      __html: generateThermalEstimateHtml(printEstimate, storeSettings, estWidthMm),
                    }}
                  />
                ) : (
                  <div id="printable-estimate" className="bg-white p-8 w-full max-w-[760px] shadow-md border border-slate-300 text-xs text-slate-900 space-y-4">
                    <div className="bg-amber-100 border border-amber-300 p-2 text-center text-amber-900 font-bold text-xs uppercase tracking-wider">
                      ESTIMATE / QUOTATION — NOT A TAX INVOICE
                    </div>

                    <div className="text-center space-y-1 border-b border-slate-300 pb-3">
                      <div className="flex items-center justify-center gap-2.5">
                        <SVTLogo size={32} />
                        <div className="text-left">
                          <h2 className="text-base font-black tracking-wide text-slate-900 leading-tight">
                            ஸ்ரீ வெங்கடேஸ்வரா பர்னிச்சர் & ஸ்டோர் | SRI VENKATESWARA FURNITURE AND STORE
                          </h2>
                          <p className="text-[10px] text-slate-600 font-semibold">
                            சாமிமில் • டிம்பர்ஸ் • பர்னிச்சர்ஸ் • ஸ்டீல்டோர்ஸ்
                          </p>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        மடம் தெரு, அண்ணா விளையாட்டு பூங்கா அருகில், காஞ்சிபுரம் - 631 502
                      </p>
                      <p className="text-[11px] font-mono text-slate-600">
                        📱 WhatsApp: 8143 84 8143 | Ph: 9941333457 / 044 2723 1947 | GSTIN/UIN: 33AGOPV5229Q1ZH
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="font-bold block text-slate-700">QUOTATION TO:</span>
                        <p className="font-bold text-sm text-slate-900">{printEstimate.customerName}</p>
                        <p>Phone: {printEstimate.customerMobile || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold block text-slate-700">DOCUMENT DETAILS:</span>
                        <p className="font-bold text-sm font-mono text-blue-900">{printEstimate.estimateNumber}</p>
                        <p>Date: {new Date(printEstimate.estimateDate).toLocaleDateString()}</p>
                        {printEstimate.validUntil && (
                          <p>Valid Until: {new Date(printEstimate.validUntil).toLocaleDateString()}</p>
                        )}
                        <p>Status: <strong className="uppercase">{printEstimate.status}</strong></p>
                      </div>
                    </div>

                    <table className="w-full text-left border-collapse border border-slate-300 text-[11px]">
                      <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                        <tr>
                          <th className="p-1.5 border-r border-slate-300 text-center w-8">#</th>
                          <th className="p-1.5 border-r border-slate-300">Description</th>
                          <th className="p-1.5 border-r border-slate-300 text-right w-14">Qty</th>
                          <th className="p-1.5 border-r border-slate-300 text-right w-16">Rate</th>
                          <th className="p-1.5 border-r border-slate-300 text-right w-14">Disc</th>
                          <th className="p-1.5 border-r border-slate-300 text-center w-12">GST</th>
                          <th className="p-1.5 text-right w-20">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {printEstimate.items.map((it, idx) => (
                          <tr key={idx}>
                            <td className="p-1.5 text-center border-r border-slate-200">{idx + 1}</td>
                            <td className="p-1.5 border-r border-slate-200 font-medium">
                              {it.productName} <span className="font-mono text-slate-400">({it.productCode})</span>
                            </td>
                            <td className="p-1.5 text-right border-r border-slate-200">
                              {it.quantity} {it.unit}
                            </td>
                            <td className="p-1.5 text-right border-r border-slate-200">₹{it.rate.toFixed(2)}</td>
                            <td className="p-1.5 text-right border-r border-slate-200">
                              {it.discountAmount > 0 ? `₹${it.discountAmount.toFixed(2)}` : '-'}
                            </td>
                            <td className="p-1.5 text-center border-r border-slate-200">{it.taxRate}%</td>
                            <td className="p-1.5 text-right font-bold">₹{it.lineTotal.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="flex justify-between items-start pt-2">
                      <div className="w-3/5 text-[10px] text-slate-600 space-y-1">
                        <span className="font-bold text-slate-800 block text-[11px]">TERMS:</span>
                        <p>1. Prices are valid for 15 days from date of quotation.</p>
                        <p>2. Applicable GST charged as per statutory regulations.</p>
                      </div>
                      <div className="w-2/5 space-y-1 text-right text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Taxable:</span>
                          <span>₹{printEstimate.taxableAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">GST Total:</span>
                          <span>₹{printEstimate.totalTaxAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-black text-sm border-t border-slate-300 pt-1 text-slate-950">
                          <span>Grand Total:</span>
                          <span>₹{printEstimate.grandTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 bg-white border-t border-slate-200 flex justify-between items-center shrink-0">
                <span className="text-[11px] text-slate-500 font-medium">
                  {estimatePrintFormat.startsWith('thermal') ? 'Thermal Estimate (Continuous POS Roll)' : 'A4/A5 Commercial Quotation'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPrintEstimate(null)}
                    className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (estimatePrintFormat.startsWith('thermal')) {
                        printHtmlDirectly(
                          generateThermalEstimateHtml(printEstimate, storeSettings, estWidthMm),
                          `Thermal_Estimate_${printEstimate.estimateNumber}`,
                          estWidthMm
                        );
                        showNotification('success', `Thermal estimate sent to printer for #${printEstimate.estimateNumber}`);
                      } else {
                        window.print();
                      }
                    }}
                    className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Direct Thermal Print (F9)"
                  >
                    <Printer className="w-4 h-4" />
                    <span>
                      {estimatePrintFormat.startsWith('thermal') ? 'Print Thermal (F9)' : 'Print Document'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ---------------- PRINT INVOICE MODAL ---------------- */}
      {printInvoice && (() => {
        const storeSettings = db.getAppSettings();
        const widthMm = invoicePrintFormat === 'thermal-104mm' ? 104 : invoicePrintFormat === 'thermal-80mm' ? 80 : 210;

        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-slate-300 overflow-hidden">
              <div className="bg-[#182b49] text-white px-4 py-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-bold text-xs">PRINT PREVIEW — TAX INVOICE ({printInvoice.invoiceNumber})</h3>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={invoicePrintFormat}
                    onChange={(e) => setInvoicePrintFormat(e.target.value as any)}
                    className="bg-white/10 hover:bg-white/20 text-white border border-white/30 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="thermal-80mm" className="text-slate-900 font-medium">🧾 3" Thermal (80mm POS Roll)</option>
                    <option value="thermal-104mm" className="text-slate-900 font-medium">🧾 4" Thermal (104mm POS Roll)</option>
                    <option value="a4" className="text-slate-900 font-medium">📄 A4 Full Sheet Tax Invoice</option>
                  </select>
                  <button onClick={() => setPrintInvoice(null)} className="text-slate-300 hover:text-white font-bold p-1">
                    ✕
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex justify-center">
                {invoicePrintFormat.startsWith('thermal') ? (
                  <div
                    className={`${invoicePrintFormat === 'thermal-104mm' ? 'w-[420px]' : 'w-[320px]'} bg-white p-4 shadow-md border border-slate-300 font-mono text-xs`}
                    dangerouslySetInnerHTML={{
                      __html: generateThermalReceiptHtml(printInvoice, storeSettings, widthMm),
                    }}
                  />
                ) : (
                  <div className="bg-white p-6 w-full max-w-[760px] shadow-md border border-slate-300">
                    <A4DotMatrixInvoice invoice={printInvoice} />
                  </div>
                )}
              </div>

              <div className="p-3 bg-white border-t border-slate-200 flex justify-between items-center shrink-0">
                <span className="text-[11px] text-slate-500 font-medium">
                  {invoicePrintFormat.startsWith('thermal') ? 'Thermal Receipt (Continuous POS Roll)' : 'A4 Tax Invoice (Laser / Dot-Matrix)'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPrintInvoice(null)}
                    className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      printHtmlDirectly(
                        generateThermalReceiptHtml(printInvoice, storeSettings, widthMm),
                        `Thermal_Receipt_${printInvoice.invoiceNumber}`,
                        widthMm
                      );
                      showNotification('success', `Thermal receipt sent to printer for #${printInvoice.invoiceNumber}`);
                    }}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Direct Thermal Receipt Print (F9)"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Thermal (F9)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      printHtmlDirectly(
                        generateA4DotMatrixHtml(printInvoice, storeSettings),
                        `Tax_Invoice_${printInvoice.invoiceNumber}`,
                        210
                      );
                      showNotification('success', `A4 Invoice sent to printer for #${printInvoice.invoiceNumber}`);
                    }}
                    className="px-4 py-1.5 bg-[#106ebe] hover:bg-[#005a9e] active:bg-blue-800 text-white font-bold rounded text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Direct A4 Full Sheet Print"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Print A4</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// -------------------------------------------------------------
// Estimate Editor Dialog Component (Create or Edit existing)
// -------------------------------------------------------------
interface EstimateEditorDialogProps {
  initialEstimate?: EstimateHeader;
  onClose: () => void;
  onSaved: () => void;
}

const EstimateEditorDialog: React.FC<EstimateEditorDialogProps> = ({ initialEstimate, onClose, onSaved }) => {
  const [customers] = useState<Customer[]>(() => db.getCustomers());
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(initialEstimate?.customerId || 1);
  const [isInterstate, setIsInterstate] = useState<boolean>(initialEstimate?.isInterstate || false);
  const [notes, setNotes] = useState<string>(initialEstimate?.notes || '');
  const [validDays, setValidDays] = useState<number>(15);

  const [cartItems, setCartItems] = useState<
    Array<{
      productId: number;
      productCode: string;
      barcode: string;
      productName: string;
      unit: string;
      quantity: number;
      rate: number;
      discountPercent: number;
      taxRate: number;
    }>
  >(() => {
    if (initialEstimate?.items) {
      return initialEstimate.items.map((it) => ({
        productId: it.productId,
        productCode: it.productCode,
        barcode: it.barcode,
        productName: it.productName,
        unit: it.unit,
        quantity: it.quantity,
        rate: it.rate,
        discountPercent: it.discountPercent,
        taxRate: it.taxRate,
      }));
    }
    return [];
  });

  const [productSearch, setProductSearch] = useState('');
  const [matchingProducts, setMatchingProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (productSearch.trim().length >= 2) {
      const res = db.searchProducts({ searchTerm: productSearch, pageSize: 6 });
      setMatchingProducts(res.items);
    } else {
      setMatchingProducts([]);
    }
  }, [productSearch]);

  const handleAddProduct = (prod: Product) => {
    const existing = cartItems.find((c) => c.productId === prod.id);
    if (existing) {
      setCartItems((prev) =>
        prev.map((c) => (c.productId === prod.id ? { ...c, quantity: c.quantity + 1 } : c))
      );
    } else {
      setCartItems((prev) => [
        ...prev,
        {
          productId: prod.id,
          productCode: prod.productCode,
          barcode: prod.barcode,
          productName: prod.nameEn,
          unit: prod.unit,
          quantity: 1,
          rate: prod.saleRate,
          discountPercent: 0,
          taxRate: prod.taxRate,
        },
      ]);
    }
    setProductSearch('');
    setMatchingProducts([]);
  };

  const handleRemoveItem = (productId: number) => {
    setCartItems((prev) => prev.filter((c) => c.productId !== productId));
  };

  const handleUpdateItem = (productId: number, field: 'quantity' | 'rate' | 'discountPercent', val: number) => {
    setCartItems((prev) =>
      prev.map((c) => (c.productId === productId ? { ...c, [field]: Math.max(0, val) } : c))
    );
  };

  // Preview calculations
  const calculatedEstimate = useMemo(() => {
    const cust = customers.find((c) => c.id === selectedCustomerId) || customers[0];
    const itemsDraft = cartItems.map((c) => {
      const lineGross = c.quantity * c.rate;
      const lineDisc = lineGross * (c.discountPercent / 100);
      const taxable = Math.max(0, lineGross - lineDisc);
      const taxAmt = taxable * (c.taxRate / 100);
      return {
        ...c,
        discountAmount: lineDisc,
        taxableAmount: taxable,
        taxAmount: taxAmt,
        lineTotal: taxable + taxAmt,
      };
    });

    return db.calculateEstimate({
      id: initialEstimate?.id,
      estimateNumber: initialEstimate?.estimateNumber,
      customerId: cust?.id || 1,
      customerName: cust?.name || 'Walk-in Customer',
      customerMobile: cust?.mobile || '',
      stateCode: '33',
      stateName: 'Tamil Nadu',
      isInterstate,
      validUntil: new Date(Date.now() + validDays * 86400000).toISOString(),
      items: itemsDraft as any,
      notes,
    });
  }, [cartItems, selectedCustomerId, isInterstate, validDays, notes, customers, initialEstimate]);

  const handleSave = () => {
    if (cartItems.length === 0) {
      alert('Please add at least one product item to save the estimate.');
      return;
    }

    const res = db.saveEstimateDraft(calculatedEstimate);
    if (res.success) {
      onSaved();
    } else {
      alert(res.errors.join('\n'));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-slate-300 overflow-hidden text-xs">
        {/* Header */}
        <div className="bg-[#182b49] text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm">
              {initialEstimate ? `EDIT ESTIMATE #${initialEstimate.estimateNumber}` : 'NEW COMMERCIAL ESTIMATE / QUOTATION'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white font-bold p-1">✕</button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-900 flex items-center gap-2 text-xs">
            <Info className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              <strong>Inventory Notice:</strong> Estimates do not deduct warehouse stock. Stock deduction occurs only upon conversion to a confirmed invoice.
            </span>
          </div>

          {/* Customer & Document Meta */}
          <div className="grid grid-cols-4 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Customer</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(parseInt(e.target.value, 10))}
                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.mobile || 'No Phone'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Tax Scheme</label>
              <select
                value={isInterstate ? 'inter' : 'intra'}
                onChange={(e) => setIsInterstate(e.target.value === 'inter')}
                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold"
              >
                <option value="intra">Intra-State (CGST + SGST)</option>
                <option value="inter">Inter-State (IGST)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Validity Period</label>
              <select
                value={validDays}
                onChange={(e) => setValidDays(parseInt(e.target.value, 10))}
                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs"
              >
                <option value={7}>Valid 7 Days</option>
                <option value={15}>Valid 15 Days (Standard)</option>
                <option value={30}>Valid 30 Days</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Operational Notes</label>
              <input
                type="text"
                placeholder="Remarks / Inquiry notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs"
              />
            </div>
          </div>

          {/* Product Lookup */}
          <div className="relative">
            <label className="font-bold text-slate-800 block mb-1">Add Product to Estimate:</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Scan barcode or type product name/SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded text-xs focus:outline-blue-500 font-medium"
              />
            </div>

            {/* Dropdown autocomplete */}
            {matchingProducts.length > 0 && (
              <div className="absolute left-0 right-0 top-14 bg-white border border-slate-300 shadow-lg rounded z-20 max-h-48 overflow-y-auto divide-y divide-slate-100">
                {matchingProducts.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleAddProduct(p)}
                    className="p-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-slate-800">{p.nameEn}</span>
                      <span className="text-[11px] text-slate-500 ml-2 font-mono">({p.productCode} | {p.barcode})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500">Stock: {p.currentStock} {p.unit}</span>
                      <span className="font-bold text-blue-700">₹{p.saleRate.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#e9eef4] border-b border-slate-300 text-slate-700 font-bold">
                <tr>
                  <th className="py-1.5 px-2.5 w-10 text-center">#</th>
                  <th className="py-1.5 px-2.5">Product Description</th>
                  <th className="py-1.5 px-2.5 w-20 text-center">Qty</th>
                  <th className="py-1.5 px-2.5 w-24 text-right">Rate (₹)</th>
                  <th className="py-1.5 px-2.5 w-20 text-center">Disc %</th>
                  <th className="py-1.5 px-2.5 w-16 text-center">GST %</th>
                  <th className="py-1.5 px-2.5 w-24 text-right font-bold">Line Total</th>
                  <th className="py-1.5 px-2.5 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cartItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                      No products added yet. Use the search box above to add items.
                    </td>
                  </tr>
                ) : (
                  cartItems.map((item, idx) => (
                    <tr key={item.productId} className="hover:bg-slate-50">
                      <td className="py-1.5 px-2.5 text-center text-slate-400">{idx + 1}</td>
                      <td className="py-1.5 px-2.5 font-semibold text-slate-800">
                        {item.productName} <span className="font-mono text-slate-400 text-[10px]">({item.productCode})</span>
                      </td>
                      <td className="py-1.5 px-2.5 text-center">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(item.productId, 'quantity', parseFloat(e.target.value) || 1)}
                          className="w-14 px-1 py-0.5 border border-slate-300 rounded text-center font-bold"
                        />
                      </td>
                      <td className="py-1.5 px-2.5 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) => handleUpdateItem(item.productId, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-20 px-1 py-0.5 border border-slate-300 rounded text-right font-semibold"
                        />
                      </td>
                      <td className="py-1.5 px-2.5 text-center">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={item.discountPercent}
                          onChange={(e) => handleUpdateItem(item.productId, 'discountPercent', parseFloat(e.target.value) || 0)}
                          className="w-14 px-1 py-0.5 border border-slate-300 rounded text-center"
                        />
                      </td>
                      <td className="py-1.5 px-2.5 text-center font-medium text-slate-600">{item.taxRate}%</td>
                      <td className="py-1.5 px-2.5 text-right font-bold text-slate-900">
                        ₹
                        {(
                          (item.quantity * item.rate - item.quantity * item.rate * (item.discountPercent / 100)) *
                          (1 + item.taxRate / 100)
                        ).toFixed(2)}
                      </td>
                      <td className="py-1.5 px-2.5 text-center">
                        <button
                          onClick={() => handleRemoveItem(item.productId)}
                          className="text-rose-500 hover:text-rose-700 font-bold"
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Financial Breakdown Panel */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded flex justify-between items-center text-xs">
            <div className="space-y-1 text-slate-600">
              <div>Total Line Items: <strong>{calculatedEstimate.totalItems}</strong></div>
              <div>Total Quoted Units: <strong>{calculatedEstimate.totalQty}</strong></div>
            </div>

            <div className="text-right space-y-1">
              <div>Gross Amount: <strong>₹{calculatedEstimate.grossAmount.toFixed(2)}</strong></div>
              <div>Taxable Value: <strong>₹{calculatedEstimate.taxableAmount.toFixed(2)}</strong></div>
              <div>GST Tax: <strong className="text-emerald-700">₹{calculatedEstimate.totalTaxAmount.toFixed(2)}</strong></div>
              <div className="text-sm font-black text-slate-950 pt-1 border-t border-slate-200 font-mono">
                Estimate Total: ₹{calculatedEstimate.grandTotal.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-white border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={cartItems.length === 0}
            className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{initialEstimate ? 'Save Estimate Changes' : 'Save New Estimate'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Invoice Editor Dialog Component
// -------------------------------------------------------------
interface InvoiceEditorDialogProps {
  invoice: InvoiceHeader;
  onClose: () => void;
  onSaved: () => void;
}

const InvoiceEditorDialog: React.FC<InvoiceEditorDialogProps> = ({ invoice, onClose, onSaved }) => {
  const [customerName, setCustomerName] = useState(invoice.customerName);
  const [customerMobile, setCustomerMobile] = useState(invoice.customerMobile || '');
  const [notes, setNotes] = useState(invoice.notes || '');
  const [amountPaid, setAmountPaid] = useState<number>(invoice.amountPaid || 0);

  const handleSave = () => {
    const updatedPayments = [
      {
        paymentMethod: (invoice.paymentMode as any) || 'Cash',
        amount: amountPaid,
      },
    ];

    const res = db.updateInvoice({
      id: invoice.id,
      customerName,
      customerMobile,
      notes,
      amountPaid,
      payments: updatedPayments as any,
    });

    if (res.success) {
      onSaved();
    } else {
      alert(res.errors.join('\n'));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg border border-slate-300 overflow-hidden text-xs">
        <div className="bg-[#182b49] text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm">EDIT TAX INVOICE #{invoice.invoiceNumber}</h3>
          </div>
          <button onClick={onClose} className="text-white font-bold p-1">✕</button>
        </div>

        <div className="p-4 space-y-3">
          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-blue-900">
            <span className="font-bold">Invoice #{invoice.invoiceNumber}</span> · Total:{' '}
            <strong className="font-mono">₹{invoice.grandTotal.toFixed(2)}</strong> ({invoice.items.length} items)
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Customer Name</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Customer Phone / Mobile</label>
            <input
              type="text"
              value={customerMobile}
              onChange={(e) => setCustomerMobile(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Amount Collected / Paid (₹)</label>
            <input
              type="number"
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold text-emerald-800"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Notes / Remarks</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
            />
          </div>
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-3.5 py-1.5 bg-white border border-slate-300 rounded font-semibold text-slate-700">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded flex items-center gap-1.5 cursor-pointer shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Save Invoice Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
};
