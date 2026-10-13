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
  Clock,
  User,
  Calendar,
  Layers,
  ShoppingBag,
  FileText,
  DollarSign,
  ChevronRight,
  Info,
  RefreshCw,
  Building,
} from 'lucide-react';
import { db } from '../services/dbEngine';
import { EstimateHeader, EstimateItem, Customer, Product, InvoiceHeader } from '../types';

interface EstimatesAndInvoicesProps {
  onRefreshData?: () => void;
  onNavigateToPOS?: () => void;
  onNavigateToHistory?: (invoiceNum?: string) => void;
}

export const EstimatesAndInvoices: React.FC<EstimatesAndInvoicesProps> = ({
  onRefreshData,
  onNavigateToPOS,
  onNavigateToHistory,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Draft' | 'Confirmed' | 'Converted' | 'Cancelled'>('All');
  const [estimates, setEstimates] = useState<EstimateHeader[]>(() => db.getEstimates().items);
  const [selectedEstimateId, setSelectedEstimateId] = useState<number | null>(() => estimates[0]?.id || null);

  // Modals state
  const [isNewEstimateOpen, setIsNewEstimateOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Notification Toast
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Convert to Invoice payment options
  const [convertPaymentMethod, setConvertPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Credit'>('Cash');
  const [convertAmountPaid, setConvertAmountPaid] = useState<string>('');

  // Refresh helper
  const reloadData = () => {
    const res = db.getEstimates({ searchTerm, status: statusFilter });
    setEstimates(res.items);
    if (!selectedEstimateId && res.items.length > 0) {
      setSelectedEstimateId(res.items[0].id);
    }
  };

  useEffect(() => {
    reloadData();
  }, [searchTerm, statusFilter]);

  const selectedEstimate = useMemo(
    () => estimates.find((e) => e.id === selectedEstimateId) || estimates[0] || null,
    [estimates, selectedEstimateId]
  );

  const showNotification = (type: 'success' | 'error' | 'info', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  // Convert estimate to invoice action
  const handleConfirmConversion = () => {
    if (!selectedEstimate) return;

    const amt = convertAmountPaid !== '' ? parseFloat(convertAmountPaid) : selectedEstimate.grandTotal;

    const res = db.convertEstimateToInvoice(selectedEstimate.id, {
      paymentMethod: convertPaymentMethod,
      amountPaid: isNaN(amt) ? selectedEstimate.grandTotal : amt,
    });

    if (res.success && res.invoice) {
      setIsConvertModalOpen(false);
      reloadData();
      onRefreshData?.();
      showNotification(
        'success',
        `Estimate #${selectedEstimate.estimateNumber} successfully converted to Confirmed Invoice #${res.invoice.invoiceNumber}! Stock has been deducted.`
      );
    } else {
      showNotification('error', res.errors.join(' '));
    }
  };

  // Cancel estimate
  const handleConfirmCancel = () => {
    if (!selectedEstimate) return;
    const res = db.cancelEstimate(selectedEstimate.id, cancelReason || 'Cancelled by operator');
    if (res.success) {
      setIsCancelModalOpen(false);
      setCancelReason('');
      reloadData();
      onRefreshData?.();
      showNotification('info', `Estimate #${selectedEstimate.estimateNumber} marked as Cancelled.`);
    } else {
      showNotification('error', res.errors.join(' '));
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const rows = estimates.map((e) => ({
      'Estimate No': e.estimateNumber,
      Date: e.estimateDate,
      Customer: e.customerName,
      Phone: e.customerMobile || '',
      Status: e.status,
      'Total Items': e.totalItems,
      Taxable: e.taxableAmount,
      'Total Tax': e.totalTaxAmount,
      'Grand Total': e.grandTotal,
      'Converted Invoice': e.convertedInvoiceNumber || 'N/A',
      'Converted Date': e.convertedAt || 'N/A',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estimates');
    XLSX.writeFile(wb, `ShopBilling_Estimates_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f0f2f5] overflow-hidden select-none text-xs">
      {/* Header Banner */}
      <div className="bg-[#182b49] text-white px-4 py-2.5 border-b border-[#0f1d33] flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide flex items-center gap-2">
              <span>ESTIMATES & PRO-FORMA INVOICES (F9)</span>
              <span className="text-[10px] bg-amber-500/30 text-amber-200 border border-amber-400/30 px-1.5 py-0.2 rounded">
                Pre-Billing Quotations
              </span>
            </h1>
            <p className="text-[11px] text-slate-300">
              Create commercial estimates without inventory deduction. Re-validate stock and convert approved estimates to tax invoices with 1 click.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNewEstimateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-xs cursor-pointer text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Estimate (Alt+N)</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded text-xs cursor-pointer"
            title="Export estimates to formatted Excel"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`px-4 py-1.5 text-xs font-medium flex items-center gap-2 ${
            notification.type === 'success'
              ? 'bg-emerald-100 text-emerald-800 border-b border-emerald-300'
              : notification.type === 'error'
              ? 'bg-rose-100 text-rose-800 border-b border-rose-300'
              : 'bg-blue-100 text-blue-800 border-b border-blue-300'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          )}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Toolbar Filter */}
      <div className="bg-white p-2 border-b border-slate-300 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search estimate number, customer name, mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded text-xs focus:outline-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700"
          >
            <option value="All">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Converted">Converted</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        {/* Selected Estimate Actions */}
        {selectedEstimate && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print Quotation</span>
            </button>

            {selectedEstimate.status !== 'Converted' && selectedEstimate.status !== 'Cancelled' && (
              <>
                <button
                  onClick={() => {
                    setConvertAmountPaid(selectedEstimate.grandTotal.toString());
                    setIsConvertModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Convert to Invoice</span>
                </button>
                <button
                  onClick={() => setIsCancelModalOpen(true)}
                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-semibold cursor-pointer"
                >
                  <span>Cancel</span>
                </button>
              </>
            )}

            {selectedEstimate.status === 'Converted' && (
              <span className="px-2 py-1 bg-purple-100 text-purple-800 border border-purple-300 rounded text-[11px] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-purple-600" />
                <span>Converted to {selectedEstimate.convertedInvoiceNumber}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Workspace (Split: Estimates Master Grid & Selected Detail) */}
      <div className="flex-1 flex flex-col overflow-hidden p-2 gap-2">
        {/* Top Split: Estimates Master List */}
        <div className="flex-1 bg-white border border-[#c0c6cf] rounded shadow-xs flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#e9eef4] border-b border-[#cbd5e1] text-slate-700 font-bold sticky top-0 z-10 select-none">
                <tr>
                  <th className="py-1.5 px-3 w-32">Estimate No</th>
                  <th className="py-1.5 px-3 w-36">Date</th>
                  <th className="py-1.5 px-3 w-44">Customer</th>
                  <th className="py-1.5 px-3 w-28">Mobile</th>
                  <th className="py-1.5 px-3 w-16 text-center">Items</th>
                  <th className="py-1.5 px-3 w-16 text-center">Qty</th>
                  <th className="py-1.5 px-3 w-24 text-right">Taxable</th>
                  <th className="py-1.5 px-3 w-20 text-right">GST</th>
                  <th className="py-1.5 px-3 w-24 text-right font-black">Grand Total</th>
                  <th className="py-1.5 px-3 w-24 text-center">Status</th>
                  <th className="py-1.5 px-3">Converted Invoice #</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {estimates.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-slate-400 italic">
                      No estimates match the current search filters. Click &quot;Create New Estimate&quot; to begin.
                    </td>
                  </tr>
                ) : (
                  estimates.map((est) => (
                    <tr
                      key={est.id}
                      onClick={() => setSelectedEstimateId(est.id)}
                      className={`hover:bg-blue-50 cursor-pointer transition-colors ${
                        selectedEstimate?.id === est.id ? 'bg-blue-50/90 font-medium text-blue-950' : ''
                      }`}
                    >
                      <td className="py-2 px-3 font-mono font-bold text-slate-900">{est.estimateNumber}</td>
                      <td className="py-2 px-3 text-slate-600">
                        {new Date(est.estimateDate).toLocaleDateString()} {new Date(est.estimateDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800">{est.customerName}</td>
                      <td className="py-2 px-3 font-mono text-slate-500">{est.customerMobile || 'N/A'}</td>
                      <td className="py-2 px-3 text-center">{est.totalItems}</td>
                      <td className="py-2 px-3 text-center">{est.totalQty}</td>
                      <td className="py-2 px-3 text-right">₹{est.taxableAmount.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-emerald-700">₹{est.totalTaxAmount.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">₹{est.grandTotal.toFixed(2)}</td>
                      <td className="py-2 px-3 text-center">
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
                      <td className="py-2 px-3 font-mono text-slate-600">
                        {est.convertedInvoiceNumber ? (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToHistory?.(est.convertedInvoiceNumber);
                            }}
                            className="text-blue-700 hover:underline font-bold cursor-pointer"
                          >
                            {est.convertedInvoiceNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Pending conversion</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Split: Selected Estimate Details & Line Items */}
        {selectedEstimate && (
          <div className="h-56 bg-white border border-[#c0c6cf] rounded shadow-xs flex flex-col overflow-hidden">
            <div className="bg-[#f1f5f9] px-3 py-1.5 border-b border-slate-300 flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-2">
                <span>ESTIMATE LINE ITEMS ({selectedEstimate.estimateNumber})</span>
                <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 border border-amber-200 rounded">
                  Stock remains untouched until invoice conversion
                </span>
              </span>

              <div className="text-[11px] text-slate-600">
                <span>Valid Until: <strong>{new Date(selectedEstimate.validUntil || '').toLocaleDateString()}</strong></span>
                <span className="mx-2">|</span>
                <span>GST Mode: <strong>{selectedEstimate.isInterstate ? 'Inter-state (IGST)' : 'Intra-state (CGST+SGST)'}</strong></span>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#e9eef4] border-b border-slate-300 text-slate-700 sticky top-0">
                  <tr>
                    <th className="py-1 px-3 w-10 text-center">#</th>
                    <th className="py-1 px-3 w-28">Product Code</th>
                    <th className="py-1 px-3 w-32">Barcode</th>
                    <th className="py-1 px-3">Description</th>
                    <th className="py-1 px-3 w-16 text-right">Qty</th>
                    <th className="py-1 px-3 w-20 text-right">Rate</th>
                    <th className="py-1 px-3 w-20 text-right">Disc</th>
                    <th className="py-1 px-3 w-20 text-right">Taxable</th>
                    <th className="py-1 px-3 w-16 text-center">GST %</th>
                    <th className="py-1 px-3 w-20 text-right">GST (₹)</th>
                    <th className="py-1 px-3 w-24 text-right font-bold">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedEstimate.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-1 px-3 text-center text-slate-400">{idx + 1}</td>
                      <td className="py-1 px-3 font-mono text-slate-600">{item.productCode}</td>
                      <td className="py-1 px-3 font-mono">{item.barcode}</td>
                      <td className="py-1 px-3 font-medium text-slate-800">{item.productName}</td>
                      <td className="py-1 px-3 text-right">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-1 px-3 text-right">₹{item.rate.toFixed(2)}</td>
                      <td className="py-1 px-3 text-right text-slate-500">
                        {item.discountAmount > 0 ? `₹${item.discountAmount.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-1 px-3 text-right">₹{item.taxableAmount.toFixed(2)}</td>
                      <td className="py-1 px-3 text-center">{item.taxRate}%</td>
                      <td className="py-1 px-3 text-right text-emerald-700">₹{item.taxAmount.toFixed(2)}</td>
                      <td className="py-1 px-3 text-right font-bold text-slate-900">₹{item.lineTotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Total strip */}
            <div className="bg-[#f8fafc] px-3 py-1.5 border-t border-slate-200 flex items-center justify-between font-medium text-slate-700 text-xs">
              <div>
                <span>Notes: <em>{selectedEstimate.notes || 'None'}</em></span>
              </div>
              <div className="flex items-center gap-4">
                <span>Taxable: ₹{selectedEstimate.taxableAmount.toFixed(2)}</span>
                <span>GST: ₹{selectedEstimate.totalTaxAmount.toFixed(2)}</span>
                <span className="text-sm font-black text-slate-950">
                  Estimated Total: ₹{selectedEstimate.grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---------------- NEW ESTIMATE MODAL ---------------- */}
      {isNewEstimateOpen && (
        <NewEstimateDialog
          onClose={() => setIsNewEstimateOpen(false)}
          onSaved={() => {
            setIsNewEstimateOpen(false);
            reloadData();
            onRefreshData?.();
            showNotification('success', 'New estimate saved successfully. Inventory stock remains untouched.');
          }}
        />
      )}

      {/* ---------------- CONVERT TO INVOICE MODAL ---------------- */}
      {isConvertModalOpen && selectedEstimate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg border border-slate-300 overflow-hidden">
            <div className="bg-[#182b49] text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">CONVERT ESTIMATE TO CONFIRMED TAX INVOICE</h3>
              </div>
              <button onClick={() => setIsConvertModalOpen(false)} className="text-slate-300 hover:text-white font-bold">
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-900">
                <p className="font-semibold mb-1">
                  Converting Estimate #{selectedEstimate.estimateNumber} for {selectedEstimate.customerName}
                </p>
                <p className="text-[11px] text-blue-800">
                  This action will re-validate stock, deduct physical stock from inventory, record an auditable sales transaction, and generate a finalized tax invoice.
                </p>
              </div>

              {/* Items stock check preview */}
              <div className="border border-slate-200 rounded p-2.5 max-h-40 overflow-y-auto bg-slate-50">
                <span className="font-bold text-slate-700 block mb-1">Inventory Re-Validation Preview:</span>
                <div className="space-y-1">
                  {selectedEstimate.items.map((it) => {
                    const prod = db.getAllProducts().find((p) => p.id === it.productId);
                    const hasStock = prod && prod.currentStock >= it.quantity;
                    return (
                      <div key={it.productId} className="flex items-center justify-between text-[11px]">
                        <span className="truncate max-w-[240px]">{it.productName}</span>
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
                  <span className="text-base font-black text-slate-900">₹{selectedEstimate.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsConvertModalOpen(false)}
                className="px-4 py-1.5 bg-white border border-slate-300 text-slate-700 font-bold rounded text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmConversion}
                className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Conversion & Deduct Stock</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- CANCEL MODAL ---------------- */}
      {isCancelModalOpen && selectedEstimate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md border border-slate-300 overflow-hidden text-xs">
            <div className="bg-rose-900 text-white px-4 py-3 flex items-center justify-between">
              <h3 className="font-bold text-sm">CANCEL ESTIMATE #{selectedEstimate.estimateNumber}</h3>
              <button onClick={() => setIsCancelModalOpen(false)} className="text-white font-bold">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-slate-700">
                Are you sure you want to void this quotation? Once cancelled, it cannot be converted into an invoice.
              </p>
              <div>
                <label className="font-bold text-slate-800 block mb-1">Reason for Cancellation</label>
                <input
                  type="text"
                  placeholder="e.g. Customer declined, price expired, items unavailable..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:outline-rose-500"
                />
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setIsCancelModalOpen(false)} className="px-3 py-1.5 bg-white border border-slate-300 rounded font-semibold">
                Back
              </button>
              <button onClick={handleConfirmCancel} className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded">
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- PRINT QUOTATION MODAL ---------------- */}
      {isPrintModalOpen && selectedEstimate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-slate-300 overflow-hidden">
            <div className="bg-[#182b49] text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-300" />
                <h3 className="font-bold text-xs">PRINT PREVIEW — COMMERCIAL ESTIMATE ({selectedEstimate.estimateNumber})</h3>
              </div>
              <button onClick={() => setIsPrintModalOpen(false)} className="text-slate-300 hover:text-white font-bold">
                ✕
              </button>
            </div>

            {/* Printable A4 Quotation Paper */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex justify-center">
              <div className="bg-white p-8 w-[620px] shadow-md border border-slate-300 text-xs text-slate-900 space-y-4">
                {/* Warning Banner Required by Prompt */}
                <div className="bg-amber-100 border border-amber-300 p-2 text-center text-amber-900 font-bold text-xs uppercase tracking-wider">
                  ESTIMATE / QUOTATION — NOT A TAX INVOICE
                </div>

                {/* Store Header */}
                <div className="text-center space-y-0.5 border-b border-slate-300 pb-3">
                  <h2 className="text-base font-black tracking-wide">SRI MEENAKSHI SUPER STORE</h2>
                  <p className="text-[11px] text-slate-600">124, West Masi Street, Madurai - 625001 | Phone: 0452-2345678</p>
                  <p className="text-[11px] text-slate-600">GSTIN: 33AABCS1429B1Z1 | State: Tamil Nadu (Code 33)</p>
                </div>

                {/* Estimate Meta & Customer Info */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="font-bold block text-slate-700">QUOTATION TO:</span>
                    <p className="font-bold text-sm text-slate-900">{selectedEstimate.customerName}</p>
                    <p>Phone: {selectedEstimate.customerMobile || 'N/A'}</p>
                    <p>GSTIN: {selectedEstimate.customerGstin || 'Unregistered / Consumer'}</p>
                    <p>Place of Supply: {selectedEstimate.stateName} (Code {selectedEstimate.stateCode})</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold block text-slate-700">DOCUMENT DETAILS:</span>
                    <p className="font-bold text-sm font-mono text-blue-900">{selectedEstimate.estimateNumber}</p>
                    <p>Date: {new Date(selectedEstimate.estimateDate).toLocaleDateString()}</p>
                    <p>Valid Until: {new Date(selectedEstimate.validUntil || '').toLocaleDateString()}</p>
                    <p>
                      Status: <strong className="uppercase">{selectedEstimate.status}</strong>
                    </p>
                  </div>
                </div>

                {/* Line Items Table */}
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
                    {selectedEstimate.items.map((it, idx) => (
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

                {/* Financial Totals */}
                <div className="flex justify-between items-start pt-2">
                  <div className="w-3/5 text-[10px] text-slate-600 space-y-1">
                    <span className="font-bold text-slate-800 block text-[11px]">TERMS & CONDITIONS:</span>
                    <p>1. Prices are valid for 15 days from the date of quotation.</p>
                    <p>2. Applicable GST is charged as per statutory regulations.</p>
                    <p>3. Stock is reserved only upon conversion to a confirmed invoice.</p>
                    <p>4. This document is not a valid tax invoice for claiming GST input tax credit.</p>
                  </div>
                  <div className="w-2/5 space-y-1 text-right text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Taxable Subtotal:</span>
                      <span>₹{selectedEstimate.taxableAmount.toFixed(2)}</span>
                    </div>
                    {selectedEstimate.isInterstate ? (
                      <div className="flex justify-between">
                        <span className="text-slate-600">IGST Total:</span>
                        <span>₹{selectedEstimate.igstAmount.toFixed(2)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-600">CGST Total:</span>
                          <span>₹{selectedEstimate.cgstAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">SGST Total:</span>
                          <span>₹{selectedEstimate.sgstAmount.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    {selectedEstimate.roundOff !== 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Round Off:</span>
                        <span>₹{selectedEstimate.roundOff.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-sm border-t border-slate-300 pt-1 text-slate-950">
                      <span>Grand Total:</span>
                      <span>₹{selectedEstimate.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Signature Block */}
                <div className="pt-10 flex justify-between items-end text-center text-xs">
                  <div>
                    <div className="w-32 border-b border-slate-400 mb-1" />
                    <span className="text-slate-500 text-[10px]">Customer Acceptance</span>
                  </div>
                  <div>
                    <div className="w-40 border-b border-slate-400 mb-1" />
                    <span className="font-bold text-slate-800 text-[11px]">Authorized Signatory</span>
                    <p className="text-[10px] text-slate-500">For Sri Meenakshi Super Store</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-white border-t border-slate-200 flex justify-between items-center">
              <span className="text-xs text-slate-500">Standard A4 Format Preview</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs"
                >
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Send to Printer (Print)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// New Estimate Dialog Component
// -------------------------------------------------------------
interface NewEstimateDialogProps {
  onClose: () => void;
  onSaved: () => void;
}

const NewEstimateDialog: React.FC<NewEstimateDialogProps> = ({ onClose, onSaved }) => {
  const [customers, setCustomers] = useState<Customer[]>(() => db.getCustomers());
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(1);
  const [isInterstate, setIsInterstate] = useState(false);
  const [notes, setNotes] = useState('');
  const [validDays, setValidDays] = useState(15);

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
  >([]);

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
      customerId: cust?.id || 1,
      customerName: cust?.name || 'Walk-in Customer',
      customerMobile: cust?.mobile || '',
      stateCode: cust?.stateCode || '33',
      stateName: cust?.state || 'Tamil Nadu',
      isInterstate,
      validUntil: new Date(Date.now() + validDays * 86400000).toISOString(),
      items: itemsDraft as any,
      notes,
    });
  }, [cartItems, selectedCustomerId, isInterstate, validDays, notes, customers]);

  const handleSave = () => {
    if (cartItems.length === 0) {
      alert('Please add at least one product item to create an estimate.');
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
            <Plus className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm">NEW COMMERCIAL ESTIMATE / PRO-FORMA QUOTATION</h3>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white font-bold">
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* Notice banner */}
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-900 flex items-center gap-2 text-xs">
            <Info className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              <strong>Inventory Notice:</strong> Creating an estimate quotes prices to customers but does NOT deduct stock from the warehouse. Stock deduction only occurs if and when the estimate is finalized into a sales invoice.
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
                      No products added yet. Use search box above to add items.
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
              <div className="text-sm font-black text-slate-950 pt-1 border-t border-slate-200">
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
            <span>Save Estimate as Quotation</span>
          </button>
        </div>
      </div>
    </div>
  );
};
