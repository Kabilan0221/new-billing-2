import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  ShoppingCart,
  Search,
  Plus,
  Trash2,
  Printer,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  FileText,
  UserCheck,
  Calendar,
  Building2,
  ArrowRight,
  Download,
  Filter,
  Eye,
  Percent,
  Check,
  X,
  RefreshCw,
  Hash,
  Clock,
  Layers,
  Banknote,
  DollarSign,
  Smartphone,
  ChevronRight,
  HelpCircle,
  FileClock,
  UserPlus
} from 'lucide-react';
import { db } from '../services/dbEngine';
import {
  Product,
  Customer,
  InvoiceHeader,
  InvoiceItem,
  InvoicePayment,
  GstSlabSummary,
  InvoiceFilter,
} from '../types';

interface PosBillingProps {
  onRefreshData?: () => void;
  onNavigateToProducts?: () => void;
  onNavigateToStock?: () => void;
  initialActiveSubTab?: 'pos' | 'history' | 'customers' | 'gst';
}

export const PosBilling: React.FC<PosBillingProps> = ({
  onRefreshData,
  onNavigateToProducts,
  onNavigateToStock,
  initialActiveSubTab = 'pos',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'pos' | 'history' | 'customers' | 'gst'>(initialActiveSubTab);

  // Reference data
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);

  // -------------------------------------------------------------
  // POS BILL STATE
  // -------------------------------------------------------------
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString());
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(1);
  const [isInterstate, setIsInterstate] = useState<boolean>(false);
  const [salesperson, setSalesperson] = useState<string>('Admin');
  const [notes, setNotes] = useState<string>('');
  const [billDiscount, setBillDiscount] = useState<number>(0);
  const [otherCharges, setOtherCharges] = useState<number>(0);

  // Cart Lines
  const [cartItems, setCartItems] = useState<InvoiceItem[]>([]);

  // Payments
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Credit'>('Cash');
  const [tenderedAmount, setTenderedAmount] = useState<number>(0);
  const [splitPayments, setSplitPayments] = useState<InvoicePayment[]>([]);
  const [isSplitMode, setIsSplitMode] = useState<boolean>(false);

  // Barcode & Product Search input
  const [scanBarcode, setScanBarcode] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQty, setSearchQty] = useState(1);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // UI Feedback / Alerts
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Modals & Previews
  const [printModalInvoice, setPrintModalInvoice] = useState<InvoiceHeader | null>(null);
  const [printFormat, setPrintFormat] = useState<'thermal' | 'a4'>('thermal');
  const [viewDetailsInvoice, setViewDetailsInvoice] = useState<InvoiceHeader | null>(null);
  const [cancelModalInvoice, setCancelModalInvoice] = useState<InvoiceHeader | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);

  // New Customer Form State
  const [newCustName, setNewCustName] = useState('');
  const [newCustMobile, setNewCustMobile] = useState('');
  const [newCustGstin, setNewCustGstin] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustCity, setNewCustCity] = useState('Chennai');
  const [newCustState, setNewCustState] = useState('Tamil Nadu');
  const [newCustStateCode, setNewCustStateCode] = useState('33');

  // -------------------------------------------------------------
  // BILL HISTORY STATE
  // -------------------------------------------------------------
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatus, setHistoryStatus] = useState<string>('All');
  const [historyPayStatus, setHistoryPayStatus] = useState<string>('All');
  const [historyFromDate, setHistoryFromDate] = useState('');
  const [historyToDate, setHistoryToDate] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(25);
  const [historyResult, setHistoryResult] = useState<{
    items: InvoiceHeader[];
    totalCount: number;
    totalPages: number;
  }>({ items: [], totalCount: 0, totalPages: 1 });

  // Initial Data Load
  const reloadData = () => {
    setAllProducts(db.getAllProducts());
    setAllCustomers(db.getCustomers());
    loadHistory();
    if (onRefreshData) onRefreshData();
  };

  useEffect(() => {
    reloadData();
    setInvoiceNumber(db.generateNextInvoiceNumber());
  }, []);

  useEffect(() => {
    // Focus barcode field when POS tab is active
    if (activeSubTab === 'pos') {
      setTimeout(() => barcodeInputRef.current?.focus(), 150);
    }
  }, [activeSubTab]);

  // Sync customer state with interstate flag
  useEffect(() => {
    const cust = allCustomers.find((c) => c.id === selectedCustomerId);
    if (cust) {
      // If customer is from outside Tamil Nadu (state code 33), auto-flag interstate
      if (cust.stateCode && cust.stateCode !== '33') {
        setIsInterstate(true);
      } else {
        setIsInterstate(false);
      }
    }
  }, [selectedCustomerId, allCustomers]);

  // Load History
  const loadHistory = () => {
    const filter: InvoiceFilter = {
      searchTerm: historySearch,
      status: historyStatus,
      paymentStatus: historyPayStatus,
      fromDate: historyFromDate || undefined,
      toDate: historyToDate || undefined,
      pageNumber: historyPage,
      pageSize: historyPageSize,
    };
    const res = db.getInvoices(filter);
    setHistoryResult({
      items: res.items,
      totalCount: res.totalCount,
      totalPages: res.totalPages,
    });
  };

  useEffect(() => {
    loadHistory();
  }, [historySearch, historyStatus, historyPayStatus, historyFromDate, historyToDate, historyPage, historyPageSize]);

  // Selected customer object
  const selectedCustomer = useMemo(() => {
    return allCustomers.find((c) => c.id === selectedCustomerId) || allCustomers[0];
  }, [allCustomers, selectedCustomerId]);

  // Live calculation of current bill
  const calculatedBill = useMemo(() => {
    // Payments array
    let payments: InvoicePayment[] = [];
    if (isSplitMode && splitPayments.length > 0) {
      payments = splitPayments;
    } else {
      payments = [
        {
          paymentMethod,
          amount: tenderedAmount,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    const draftHeader: Partial<InvoiceHeader> = {
      invoiceNumber: invoiceNumber || 'INV-DRAFT',
      invoiceDate,
      customerId: selectedCustomerId,
      customerName: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
      customerMobile: selectedCustomer?.mobile || '',
      customerGstin: selectedCustomer?.gstin || '',
      salesperson,
      isInterstate,
      billDiscount,
      otherCharges,
      notes,
      items: cartItems,
      payments,
    };

    return db.calculateInvoice(draftHeader);
  }, [
    invoiceNumber,
    invoiceDate,
    selectedCustomerId,
    selectedCustomer,
    salesperson,
    isInterstate,
    billDiscount,
    otherCharges,
    notes,
    cartItems,
    isSplitMode,
    splitPayments,
    paymentMethod,
    tenderedAmount,
  ]);

  // Automatically update tenderedAmount to grandTotal when cart changes and user hasn't typed custom tender
  useEffect(() => {
    if (!isSplitMode && (tenderedAmount === 0 || tenderedAmount === calculatedBill.grandTotal)) {
      setTenderedAmount(calculatedBill.grandTotal);
    }
  }, [calculatedBill.grandTotal, isSplitMode]);

  // -------------------------------------------------------------
  // CART ACTIONS & BARCODE SCANNER
  // -------------------------------------------------------------
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = scanBarcode.trim();
    if (!code) return;

    // Fast lookup
    const found =
      db.getProductByBarcode(code) ||
      allProducts.find((p) => p.productCode.toLowerCase() === code.toLowerCase()) ||
      allProducts.find((p) => p.nameEn.toLowerCase() === code.toLowerCase());

    if (found) {
      addItemToCart(found, 1);
      setScanBarcode('');
    } else {
      setAlertMessage({
        type: 'warning',
        text: `Product with barcode or SKU "${code}" was not found in catalog.`,
      });
      setTimeout(() => setAlertMessage(null), 3500);
    }
  };

  const addItemToCart = (prod: Product, qtyToAdd = 1) => {
    // Check stock warning
    if (prod.currentStock <= 0) {
      setAlertMessage({
        type: 'warning',
        text: `Warning: "${prod.nameEn}" is OUT OF STOCK (Stock: ${prod.currentStock}). Adding item will create negative stock if confirmed.`,
      });
      setTimeout(() => setAlertMessage(null), 4000);
    } else if (prod.currentStock < qtyToAdd) {
      setAlertMessage({
        type: 'warning',
        text: `Low stock warning: "${prod.nameEn}" available stock is only ${prod.currentStock} ${prod.unit}.`,
      });
      setTimeout(() => setAlertMessage(null), 4000);
    }

    setCartItems((prev) => {
      const existingIdx = prev.findIndex((item) => item.productId === prod.id);
      if (existingIdx !== -1) {
        // Increase quantity of existing line
        const updated = [...prev];
        const existing = updated[existingIdx];
        const newQty = existing.quantity + qtyToAdd;
        updated[existingIdx] = {
          ...existing,
          quantity: newQty,
        };
        return updated;
      }

      // Add new item line
      const newLine: InvoiceItem = {
        productId: prod.id,
        productCode: prod.productCode,
        barcode: prod.barcode,
        productName: prod.nameEn,
        unit: prod.unit || 'PCS',
        quantity: qtyToAdd,
        rate: prod.saleRate || 0,
        discountPercent: 0,
        discountAmount: 0,
        taxRate: prod.taxRate || 0,
        taxableAmount: 0,
        cgstRate: 0,
        cgstAmount: 0,
        sgstRate: 0,
        sgstAmount: 0,
        igstRate: 0,
        igstAmount: 0,
        taxAmount: 0,
        lineTotal: 0,
      };
      return [newLine, ...prev];
    });

    // Re-focus scanner field
    setTimeout(() => barcodeInputRef.current?.focus(), 50);
  };

  const updateCartItemQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeCartItem(index);
      return;
    }
    setCartItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, quantity: newQty } : item))
    );
  };

  const updateCartItemRate = (index: number, newRate: number) => {
    setCartItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, rate: Math.max(0, newRate) } : item))
    );
  };

  const updateCartItemDiscount = (index: number, percent: number) => {
    setCartItems((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              discountPercent: Math.max(0, Math.min(100, percent)),
              discountAmount: 0, // calculateInvoice will calculate from percent
            }
          : item
      )
    );
  };

  const removeCartItem = (index: number) => {
    setCartItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const clearCart = () => {
    if (cartItems.length === 0) return;
    if (window.confirm('Are you sure you want to clear all items in the current bill?')) {
      resetBill();
    }
  };

  const resetBill = () => {
    setCartItems([]);
    setBillDiscount(0);
    setOtherCharges(0);
    setTenderedAmount(0);
    setSplitPayments([]);
    setIsSplitMode(false);
    setNotes('');
    setInvoiceNumber(db.generateNextInvoiceNumber());
    setInvoiceDate(new Date().toISOString());
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  };

  // -------------------------------------------------------------
  // FINALIZE & PRINT INVOICE
  // -------------------------------------------------------------
  const handleFinalizeBill = (format: 'thermal' | 'a4') => {
    if (cartItems.length === 0) {
      setAlertMessage({ type: 'error', text: 'Cannot finalize bill: Cart is empty.' });
      setTimeout(() => setAlertMessage(null), 3000);
      return;
    }

    // Build invoice payload
    let payments: InvoicePayment[] = [];
    if (isSplitMode && splitPayments.length > 0) {
      payments = splitPayments;
    } else {
      payments = [
        {
          paymentMethod,
          amount: tenderedAmount,
          referenceNumber: paymentMethod === 'Cash' ? 'CASH-COUNTER' : `REF-${Date.now().toString().slice(-6)}`,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    const headerPayload: Partial<InvoiceHeader> = {
      invoiceNumber,
      invoiceDate,
      customerId: selectedCustomerId,
      customerName: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
      customerMobile: selectedCustomer?.mobile || '',
      customerGstin: selectedCustomer?.gstin || '',
      salesperson,
      isInterstate,
      billDiscount,
      otherCharges,
      notes,
      items: cartItems,
      payments,
    };

    const res = db.finalizeInvoice(headerPayload);
    if (!res.success) {
      setAlertMessage({
        type: 'error',
        text: `Error saving invoice: ${res.errors.join(', ')}`,
      });
      setTimeout(() => setAlertMessage(null), 5000);
      return;
    }

    const savedInvoice = res.invoice!;
    setAlertMessage({
      type: 'success',
      text: `Invoice #${savedInvoice.invoiceNumber} confirmed successfully! Total: ₹${savedInvoice.grandTotal.toFixed(2)} (${savedInvoice.paymentStatus}). Stock deducted and ledger updated.`,
    });
    setTimeout(() => setAlertMessage(null), 4000);

    // Open print preview modal
    setPrintFormat(format);
    setPrintModalInvoice(savedInvoice);

    // Reload catalog & history
    reloadData();

    // Reset bill for next transaction
    resetBill();
  };

  const handleSaveDraft = () => {
    if (cartItems.length === 0) {
      setAlertMessage({ type: 'error', text: 'Cannot save draft: Cart is empty.' });
      return;
    }

    const headerPayload: Partial<InvoiceHeader> = {
      invoiceNumber,
      invoiceDate,
      customerId: selectedCustomerId,
      customerName: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
      salesperson,
      isInterstate,
      billDiscount,
      otherCharges,
      notes,
      items: cartItems,
      payments: [{ paymentMethod, amount: tenderedAmount }],
    };

    const res = db.saveInvoiceDraft(headerPayload);
    if (res.success) {
      setAlertMessage({
        type: 'success',
        text: `Draft Invoice #${res.invoice?.invoiceNumber} saved! Inventory stock was NOT deducted.`,
      });
      setTimeout(() => setAlertMessage(null), 3500);
      reloadData();
      resetBill();
    }
  };

  // -------------------------------------------------------------
  // CANCEL / VOID INVOICE
  // -------------------------------------------------------------
  const handleConfirmCancelInvoice = () => {
    if (!cancelModalInvoice) return;
    const res = db.cancelInvoice(cancelModalInvoice.id, cancelReason || 'Customer returned items');
    if (res.success) {
      setAlertMessage({
        type: 'success',
        text: `Invoice #${cancelModalInvoice.invoiceNumber} has been VOIDED/CANCELLED. All item stocks have been safely restored to inventory!`,
      });
      setTimeout(() => setAlertMessage(null), 4000);
      setCancelModalInvoice(null);
      setCancelReason('');
      reloadData();
    } else {
      setAlertMessage({ type: 'error', text: res.error || 'Failed to cancel invoice.' });
    }
  };

  // -------------------------------------------------------------
  // QUICK ADD CUSTOMER
  // -------------------------------------------------------------
  const handleSaveQuickCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;

    const res = db.saveCustomer({
      name: newCustName.trim(),
      mobile: newCustMobile.trim(),
      gstin: newCustGstin.trim().toUpperCase(),
      address: newCustAddress.trim(),
      city: newCustCity.trim(),
      state: newCustState.trim(),
      stateCode: newCustStateCode.trim(),
    });

    if (res.success && res.customer) {
      setAllCustomers(db.getCustomers());
      setSelectedCustomerId(res.customer.id);
      setIsAddCustomerOpen(false);
      setNewCustName('');
      setNewCustMobile('');
      setNewCustGstin('');
      setNewCustAddress('');
      setAlertMessage({
        type: 'success',
        text: `Customer "${res.customer.name}" created and selected for current bill.`,
      });
      setTimeout(() => setAlertMessage(null), 3000);
    }
  };

  // -------------------------------------------------------------
  // EXPORT INVOICE HISTORY TO EXCEL
  // -------------------------------------------------------------
  const handleExportHistoryExcel = () => {
    const invoices = db.getAllInvoices();
    if (invoices.length === 0) {
      alert('No invoice records to export.');
      return;
    }

    const rows = invoices.map((inv) => ({
      'Invoice No': inv.invoiceNumber,
      Date: new Date(inv.invoiceDate).toLocaleString(),
      'Customer Name': inv.customerName,
      'Customer Mobile': inv.customerMobile || '',
      GSTIN: inv.customerGstin || '',
      'Total Items': inv.totalItems,
      'Total Qty': inv.totalQty,
      'Gross Amount (₹)': inv.grossAmount,
      'Item Discount (₹)': inv.itemDiscount,
      'Bill Discount (₹)': inv.billDiscount,
      'Taxable Value (₹)': inv.taxableAmount,
      'CGST (₹)': inv.cgstAmount,
      'SGST (₹)': inv.sgstAmount,
      'IGST (₹)': inv.igstAmount,
      'Total Tax (₹)': inv.totalTaxAmount,
      'Round Off (₹)': inv.roundOff,
      'Grand Total (₹)': inv.grandTotal,
      'Amount Paid (₹)': inv.amountPaid,
      'Balance Due (₹)': inv.balanceDue,
      'Payment Status': inv.paymentStatus,
      'Invoice Status': inv.status,
      Salesperson: inv.salesperson,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Invoices');
    XLSX.writeFile(wb, `Sales_Invoices_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // -------------------------------------------------------------
  // SEARCH SUGGESTIONS FILTER
  // -------------------------------------------------------------
  const searchFilteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    return allProducts
      .filter((p) => {
        return (
          p.isActive &&
          (p.nameEn.toLowerCase().includes(term) ||
            p.productCode.toLowerCase().includes(term) ||
            p.barcode.toLowerCase().includes(term) ||
            (p.nameTa && p.nameTa.toLowerCase().includes(term)))
        );
      })
      .slice(0, 10);
  }, [allProducts, searchTerm]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f4f7fa] overflow-hidden text-xs select-none">
      {/* Top Aero Navigation Sub-Tabs Bar */}
      <div className="h-10 bg-[#1e395b] border-b border-[#14263d] flex items-center justify-between px-3 shrink-0 text-white shadow-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveSubTab('pos')}
            className={`px-3 py-1.5 rounded-t text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'pos'
                ? 'bg-[#f4f7fa] text-[#1e395b] border-t-2 border-t-[#2b78e4]'
                : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>POS Billing (F1)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-3 py-1.5 rounded-t text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'history'
                ? 'bg-[#f4f7fa] text-[#1e395b] border-t-2 border-t-[#2b78e4]'
                : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            <FileClock className="w-3.5 h-3.5" />
            <span>Bill History (F6)</span>
            <span className="bg-white/20 text-[10px] px-1.5 py-0.2 rounded font-mono">
              {historyResult.totalCount}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('customers')}
            className={`px-3 py-1.5 rounded-t text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'customers'
                ? 'bg-[#f4f7fa] text-[#1e395b] border-t-2 border-t-[#2b78e4]'
                : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Customer Register</span>
            <span className="bg-white/20 text-[10px] px-1.5 py-0.2 rounded font-mono">
              {allCustomers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('gst')}
            className={`px-3 py-1.5 rounded-t text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'gst'
                ? 'bg-[#f4f7fa] text-[#1e395b] border-t-2 border-t-[#2b78e4]'
                : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            <span>GST Tax Slabs</span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-blue-200">
          <span>Terminal #01 (Offline POS)</span>
          <span className="text-emerald-300 font-semibold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Tax Engine: Ready
          </span>
        </div>
      </div>

      {/* Alert Banner */}
      {alertMessage && (
        <div
          className={`px-4 py-2 flex items-center justify-between border-b text-xs font-medium ${
            alertMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : alertMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-300'
              : 'bg-amber-50 text-amber-800 border-amber-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {alertMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {alertMessage.type === 'error' && <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            {alertMessage.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
            <span>{alertMessage.text}</span>
          </div>
          <button onClick={() => setAlertMessage(null)} className="text-slate-400 hover:text-slate-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: POS BILLING TERMINAL                               */}
      {/* ========================================================= */}
      {activeSubTab === 'pos' && (
        <div className="flex-1 flex flex-col md:flex-row h-[calc(100%-40px)] overflow-hidden">
          {/* LEFT 70%: Products Scanning & Cart Grid */}
          <div className="flex-1 flex flex-col h-full border-r border-slate-300 bg-white overflow-hidden">
            {/* Invoice Header Details Bar */}
            <div className="p-2.5 bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-semibold text-[11px]">Invoice #:</span>
                  <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 border border-slate-300 rounded shadow-2xs text-[11px]">
                    {invoiceNumber}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-semibold text-[11px]">Date:</span>
                  <span className="font-mono text-slate-700 text-[11px]">
                    {new Date(invoiceDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-semibold text-[11px]">Cashier:</span>
                  <select
                    value={salesperson}
                    onChange={(e) => setSalesperson(e.target.value)}
                    className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px] font-medium"
                  >
                    <option value="Admin">Admin (Main)</option>
                    <option value="Counter 1">Counter 1</option>
                    <option value="Counter 2">Counter 2</option>
                  </select>
                </div>
              </div>

              {/* Customer Selector & Quick Add */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 font-semibold text-[11px]">Customer:</span>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
                    className="bg-white border border-slate-300 rounded px-2 py-0.5 text-[11px] font-semibold text-slate-800 max-w-[170px]"
                  >
                    {allCustomers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.mobile ? `(${c.mobile})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => setIsAddCustomerOpen(true)}
                  title="Add New Customer"
                  className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded border border-slate-300 flex items-center justify-center"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </button>

                {/* Interstate Checkbox */}
                <label className="flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 px-2 py-0.5 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInterstate}
                    onChange={(e) => setIsInterstate(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Interstate (IGST)</span>
                </label>
              </div>
            </div>

            {/* Barcode Scanner & Product Search Bar */}
            <div className="p-2.5 bg-slate-100 border-b border-slate-300 flex flex-col sm:flex-row gap-2 shrink-0">
              {/* 1. Barcode field (Dedicated for USB Scanners) */}
              <form onSubmit={handleBarcodeSubmit} className="flex-1 flex gap-1 relative">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    value={scanBarcode}
                    onChange={(e) => setScanBarcode(e.target.value)}
                    placeholder="Scan Barcode (USB Scanner) or enter exact SKU..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded font-mono text-xs text-slate-900 focus:border-[#106ebe] focus:ring-1 focus:ring-[#106ebe] focus:outline-none shadow-2xs"
                  />
                  {scanBarcode && (
                    <button
                      type="button"
                      onClick={() => setScanBarcode('')}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#106ebe] hover:bg-[#005a9e] text-white rounded font-bold text-xs flex items-center gap-1 shadow-2xs shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Scan</span>
                </button>
              </form>

              {/* 2. Manual Product Search Dropdown */}
              <div className="flex-1 relative">
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setIsSearchOpen(true);
                    }}
                    onFocus={() => setIsSearchOpen(true)}
                    placeholder="Search product by name, Tamil or code..."
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:border-[#106ebe] focus:outline-none shadow-2xs"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setIsSearchOpen(false);
                      }}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Suggestions List Popover */}
                {isSearchOpen && searchFilteredProducts.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-md shadow-lg z-50 max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {searchFilteredProducts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          addItemToCart(p, searchQty);
                          setSearchTerm('');
                          setIsSearchOpen(false);
                        }}
                        className="p-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="font-semibold text-slate-900 truncate">{p.nameEn}</div>
                          {p.nameTa && <div className="text-[10px] text-slate-500">{p.nameTa}</div>}
                          <div className="text-[10px] font-mono text-slate-400">
                            {p.productCode} · Barcode: {p.barcode}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-bold text-[#106ebe] font-mono">₹{p.saleRate.toFixed(2)}</div>
                          <div
                            className={`text-[10px] font-medium ${
                              p.currentStock <= 0
                                ? 'text-rose-600 font-bold'
                                : p.currentStock <= p.reorderLevel
                                ? 'text-amber-600 font-semibold'
                                : 'text-emerald-700'
                            }`}
                          >
                            Stock: {p.currentStock} {p.unit}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Cart Items Table */}
            <div className="flex-1 overflow-auto bg-slate-50">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#1f4e79] text-white sticky top-0 font-semibold shadow-2xs z-10">
                  <tr>
                    <th className="p-2 w-8 text-center">#</th>
                    <th className="p-2 w-28">Barcode / SKU</th>
                    <th className="p-2">Item Description</th>
                    <th className="p-2 text-center w-24">Qty</th>
                    <th className="p-2 w-14 text-center">Unit</th>
                    <th className="p-2 text-right w-20">Rate (₹)</th>
                    <th className="p-2 text-center w-16">Disc %</th>
                    <th className="p-2 text-right w-20">Taxable (₹)</th>
                    <th className="p-2 text-center w-16">GST %</th>
                    <th className="p-2 text-right w-20">{isInterstate ? 'IGST (₹)' : 'GST (₹)'}</th>
                    <th className="p-2 text-right w-24">Line Total (₹)</th>
                    <th className="p-2 w-8 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {calculatedBill.items.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-16 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <ShoppingCart className="w-10 h-10 text-slate-300 stroke-[1.5]" />
                          <div className="text-sm font-semibold text-slate-600">The POS Cart is empty</div>
                          <div className="text-xs text-slate-400 max-w-sm">
                            Scan a product barcode with a USB scanner or search products above to build a sales bill.
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    calculatedBill.items.map((item, idx) => {
                      const prod = allProducts.find((p) => p.id === item.productId);
                      const isStockLow = prod && prod.currentStock < item.quantity;

                      return (
                        <tr
                          key={item.id || idx}
                          className={`hover:bg-blue-50/50 transition-colors ${
                            isStockLow ? 'bg-amber-50/40' : idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'
                          }`}
                        >
                          <td className="p-2 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                          <td className="p-2 font-mono text-slate-600 text-[11px]">
                            <div>{item.barcode || '—'}</div>
                            <div className="text-[10px] text-slate-400">{item.productCode}</div>
                          </td>
                          <td className="p-2">
                            <div className="font-semibold text-slate-900">{item.productName}</div>
                            {prod?.nameTa && (
                              <div className="text-[10px] text-slate-500 font-sans">{prod.nameTa}</div>
                            )}
                            {isStockLow && (
                              <div className="text-[10px] text-amber-700 font-medium flex items-center gap-1 mt-0.5">
                                <AlertTriangle className="w-3 h-3 text-amber-600 inline" />
                                Available stock: {prod?.currentStock || 0}
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <div className="inline-flex items-center border border-slate-300 rounded bg-white shadow-2xs">
                              <button
                                type="button"
                                onClick={() => updateCartItemQuantity(idx, item.quantity - 1)}
                                className="w-5 h-6 text-slate-500 hover:bg-slate-100 flex items-center justify-center font-bold text-xs"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateCartItemQuantity(idx, parseFloat(e.target.value) || 0)
                                }
                                className="w-12 h-6 text-center font-mono font-bold text-xs focus:outline-none bg-transparent"
                              />
                              <button
                                type="button"
                                onClick={() => updateCartItemQuantity(idx, item.quantity + 1)}
                                className="w-5 h-6 text-slate-500 hover:bg-slate-100 flex items-center justify-center font-bold text-xs"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="p-2 text-center font-mono text-slate-600 text-[11px]">{item.unit}</td>
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.rate}
                              onChange={(e) => updateCartItemRate(idx, parseFloat(e.target.value) || 0)}
                              className="w-16 px-1 py-0.5 border border-slate-300 rounded text-right font-mono text-xs text-slate-800"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discountPercent || 0}
                              onChange={(e) =>
                                updateCartItemDiscount(idx, parseFloat(e.target.value) || 0)
                              }
                              className="w-12 px-1 py-0.5 border border-slate-300 rounded text-center font-mono text-xs text-slate-800"
                            />
                          </td>
                          <td className="p-2 text-right font-mono tabular-nums text-slate-700">
                            ₹{item.taxableAmount.toFixed(2)}
                          </td>
                          <td className="p-2 text-center font-mono text-slate-600">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">
                              {item.taxRate}%
                            </span>
                          </td>
                          <td className="p-2 text-right font-mono tabular-nums text-slate-700">
                            ₹{item.taxAmount.toFixed(2)}
                          </td>
                          <td className="p-2 text-right font-mono font-bold tabular-nums text-slate-900">
                            ₹{item.lineTotal.toFixed(2)}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => removeCartItem(idx)}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Cart Status Strip */}
            <div className="p-2 bg-slate-200 border-t border-slate-300 flex items-center justify-between text-[11px] text-slate-700 shrink-0 font-medium">
              <div className="flex items-center gap-3">
                <span>
                  Total Items: <strong className="font-mono">{calculatedBill.totalItems}</strong> lines
                </span>
                <span>|</span>
                <span>
                  Total Quantity: <strong className="font-mono">{calculatedBill.totalQty}</strong> units
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearCart}
                  disabled={cartItems.length === 0}
                  className="px-2 py-0.5 bg-white hover:bg-rose-50 text-rose-700 border border-slate-300 rounded text-[11px] disabled:opacity-40 flex items-center gap-1 font-semibold"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear Cart (Esc)</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={cartItems.length === 0}
                  className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[11px] disabled:opacity-40 flex items-center gap-1 font-semibold"
                >
                  <FileText className="w-3 h-3" />
                  <span>Save Draft</span>
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT 30%: Totals, Taxes, and Payment Finalization Panel */}
          <div className="w-full md:w-80 lg:w-96 bg-slate-100 p-3.5 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-300 overflow-y-auto custom-scrollbar">
            <div className="space-y-3">
              {/* Box Title */}
              <div className="font-bold text-slate-800 text-xs border-b border-slate-300 pb-1.5 flex items-center justify-between">
                <span>Payment & Tax Summary</span>
                <span className="text-[10px] font-mono text-slate-500">
                  {isInterstate ? 'Inter-state IGST' : 'Intra-state CGST+SGST'}
                </span>
              </div>

              {/* Amounts Grid */}
              <div className="bg-white p-3 rounded border border-slate-300 space-y-1.5 shadow-2xs text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Gross Amount:</span>
                  <span className="font-mono font-medium">₹{calculatedBill.grossAmount.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Item Discounts:</span>
                  <span className="font-mono text-emerald-700">-₹{calculatedBill.itemDiscount.toFixed(2)}</span>
                </div>

                {/* Bill Discount Input */}
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-600">Bill Discount (₹):</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={billDiscount || ''}
                    onChange={(e) => setBillDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0.00"
                    className="w-20 px-1.5 py-0.5 border border-slate-300 rounded text-right font-mono text-xs focus:border-[#106ebe] focus:outline-none"
                  />
                </div>

                <div className="flex justify-between text-slate-800 font-semibold pt-1 border-t border-slate-100">
                  <span>Taxable Amount:</span>
                  <span className="font-mono">₹{calculatedBill.taxableAmount.toFixed(2)}</span>
                </div>

                {/* GST Taxes Breakup */}
                <div className="bg-slate-50 p-2 rounded border border-slate-200 space-y-1 text-[11px] my-1">
                  {!isInterstate ? (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>CGST (Central Tax):</span>
                        <span className="font-mono font-semibold">₹{calculatedBill.cgstAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>SGST (State Tax):</span>
                        <span className="font-mono font-semibold">₹{calculatedBill.sgstAmount.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-slate-600">
                      <span>IGST (Integrated Tax):</span>
                      <span className="font-mono font-semibold">₹{calculatedBill.igstAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-700 font-bold border-t border-slate-200 pt-0.5">
                    <span>Total GST:</span>
                    <span className="font-mono">₹{calculatedBill.totalTaxAmount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Other Charges Input */}
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-600">Other Charges (Delivery/Pkg):</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={otherCharges || ''}
                    onChange={(e) => setOtherCharges(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0.00"
                    className="w-20 px-1.5 py-0.5 border border-slate-300 rounded text-right font-mono text-xs focus:border-[#106ebe] focus:outline-none"
                  />
                </div>

                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Round Off:</span>
                  <span className="font-mono">{calculatedBill.roundOff >= 0 ? `+₹${calculatedBill.roundOff.toFixed(2)}` : `-₹${Math.abs(calculatedBill.roundOff).toFixed(2)}`}</span>
                </div>

                {/* NET PAYABLE GRAND TOTAL */}
                <div className="bg-[#1f4e79] text-white p-2.5 rounded flex justify-between items-center shadow-xs mt-2">
                  <div>
                    <div className="text-[10px] uppercase font-bold tracking-wider text-blue-200">
                      Net Amount Payable
                    </div>
                    <div className="text-[10px] text-blue-300">Indian Rupees (INR)</div>
                  </div>
                  <div className="font-mono font-bold text-xl tabular-nums">
                    ₹{calculatedBill.grandTotal.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="bg-white p-3 rounded border border-slate-300 space-y-2 shadow-2xs text-xs">
                <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wide">
                  Tender & Payment Method
                </div>

                <div className="grid grid-cols-3 gap-1">
                  {(['Cash', 'UPI', 'Card', 'Bank Transfer', 'Credit'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-1.5 px-2 rounded text-xs font-semibold border flex items-center justify-center gap-1 transition-all ${
                        paymentMethod === method
                          ? 'bg-[#106ebe] text-white border-[#106ebe] shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {method === 'Cash' && <Banknote className="w-3 h-3" />}
                      {method === 'UPI' && <Smartphone className="w-3 h-3" />}
                      {method === 'Card' && <CreditCard className="w-3 h-3" />}
                      <span>{method}</span>
                    </button>
                  ))}
                </div>

                {/* Amount Received Input & Change Calculation */}
                <div className="pt-2 border-t border-slate-200 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-700">Amount Received:</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={tenderedAmount || ''}
                      onChange={(e) => setTenderedAmount(parseFloat(e.target.value) || 0)}
                      className="w-28 px-2 py-1 border-2 border-[#106ebe] rounded text-right font-mono font-bold text-sm focus:outline-none"
                    />
                  </div>

                  {/* Quick Denominations */}
                  <div className="flex gap-1 justify-end">
                    {[100, 200, 500, 2000].map((denom) => (
                      <button
                        key={denom}
                        type="button"
                        onClick={() => setTenderedAmount((prev) => prev + denom)}
                        className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-mono border border-slate-300"
                      >
                        +{denom}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setTenderedAmount(calculatedBill.grandTotal)}
                      className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-semibold border border-blue-300"
                    >
                      Exact
                    </button>
                  </div>

                  {/* Change / Balance Due Display */}
                  {(calculatedBill.cashChange ?? 0) > 0 && (
                    <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-2 rounded flex justify-between items-center font-bold text-xs mt-1">
                      <span>Change to Return:</span>
                      <span className="font-mono text-sm text-emerald-800">
                        ₹{(calculatedBill.cashChange ?? 0).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {calculatedBill.balanceDue > 0 && (
                    <div className="bg-amber-50 border border-amber-300 text-amber-900 p-2 rounded flex justify-between items-center font-bold text-xs mt-1">
                      <span>Balance Due (Credit):</span>
                      <span className="font-mono text-sm text-amber-800">
                        ₹{calculatedBill.balanceDue.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons for POS Billing */}
            <div className="space-y-2 pt-3 shrink-0">
              <button
                type="button"
                onClick={() => handleFinalizeBill('thermal')}
                disabled={cartItems.length === 0}
                className="w-full py-2.5 bg-[#106ebe] hover:bg-[#005a9e] disabled:opacity-40 text-white rounded font-bold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Complete Bill & Print Thermal (F1)</span>
              </button>

              <button
                type="button"
                onClick={() => handleFinalizeBill('a4')}
                disabled={cartItems.length === 0}
                className="w-full py-2 bg-[#2c3e50] hover:bg-[#1a252f] disabled:opacity-40 text-white rounded font-bold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span>Complete Bill & Print A4 GST Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: BILL HISTORY & SALES INVOICES REGISTER (F6)        */}
      {/* ========================================================= */}
      {activeSubTab === 'history' && (
        <div className="flex-1 flex flex-col h-[calc(100%-40px)] bg-white overflow-hidden">
          {/* Filter Bar */}
          <div className="p-3 bg-slate-100 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => {
                    setHistorySearch(e.target.value);
                    setHistoryPage(1);
                  }}
                  placeholder="Search invoice #, customer or mobile..."
                  className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded text-xs w-64 focus:outline-none focus:border-[#106ebe]"
                />
              </div>

              <div className="flex items-center gap-1 text-slate-600">
                <span className="font-semibold text-[11px]">Status:</span>
                <select
                  value={historyStatus}
                  onChange={(e) => {
                    setHistoryStatus(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                >
                  <option value="All">All Statuses</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Draft">Draft</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div className="flex items-center gap-1 text-slate-600">
                <span className="font-semibold text-[11px]">Payment:</span>
                <select
                  value={historyPayStatus}
                  onChange={(e) => {
                    setHistoryPayStatus(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                >
                  <option value="All">All Payments</option>
                  <option value="Paid">Paid</option>
                  <option value="Partial">Partial</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  setHistorySearch('');
                  setHistoryStatus('All');
                  setHistoryPayStatus('All');
                  setHistoryFromDate('');
                  setHistoryToDate('');
                  setHistoryPage(1);
                }}
                className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded text-xs text-slate-700 font-medium flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportHistoryExcel}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-semibold text-xs flex items-center gap-1.5 shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export to Excel</span>
              </button>
            </div>
          </div>

          {/* History Data Grid */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#1f4e79] text-white sticky top-0 font-semibold shadow-2xs z-10">
                <tr>
                  <th className="p-2 w-10 text-center">#</th>
                  <th className="p-2 w-32">Invoice Number</th>
                  <th className="p-2 w-32">Date & Time</th>
                  <th className="p-2">Customer Name</th>
                  <th className="p-2 w-24">Mobile</th>
                  <th className="p-2 text-center w-16">Lines</th>
                  <th className="p-2 text-center w-16">Qty</th>
                  <th className="p-2 text-right w-24">Taxable (₹)</th>
                  <th className="p-2 text-right w-24">GST (₹)</th>
                  <th className="p-2 text-right w-28">Grand Total (₹)</th>
                  <th className="p-2 text-center w-24">Status</th>
                  <th className="p-2 text-center w-20">Payment</th>
                  <th className="p-2 text-center w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {historyResult.items.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-16 text-center text-slate-400">
                      No invoices found matching current filter criteria.
                    </td>
                  </tr>
                ) : (
                  historyResult.items.map((inv, idx) => (
                    <tr
                      key={inv.id}
                      className={`hover:bg-blue-50/60 transition-colors ${
                        inv.status === 'Cancelled'
                          ? 'bg-rose-50/40 text-slate-400 line-through'
                          : idx % 2 === 1
                          ? 'bg-slate-50/50'
                          : 'bg-white'
                      }`}
                    >
                      <td className="p-2 text-center text-slate-400 font-mono text-[11px]">
                        {(historyPage - 1) * historyPageSize + idx + 1}
                      </td>
                      <td className="p-2 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                      <td className="p-2 text-slate-600 font-mono text-[11px]">
                        {new Date(inv.invoiceDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}{' '}
                        {new Date(inv.invoiceDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-2 font-medium text-slate-800">
                        {inv.customerName}
                        {inv.customerGstin && (
                          <div className="text-[10px] text-slate-400 font-mono">{inv.customerGstin}</div>
                        )}
                      </td>
                      <td className="p-2 text-slate-600 font-mono text-[11px]">{inv.customerMobile || '—'}</td>
                      <td className="p-2 text-center font-mono">{inv.totalItems}</td>
                      <td className="p-2 text-center font-mono">{inv.totalQty}</td>
                      <td className="p-2 text-right font-mono tabular-nums">₹{inv.taxableAmount.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono tabular-nums">₹{inv.totalTaxAmount.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono font-bold tabular-nums text-slate-900">
                        ₹{inv.grandTotal.toFixed(2)}
                      </td>
                      <td className="p-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === 'Confirmed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : inv.status === 'Draft'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            inv.paymentStatus === 'Paid'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : inv.paymentStatus === 'Partial'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {inv.paymentStatus}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewDetailsInvoice(inv)}
                            title="View Full Bill Details"
                            className="p-1 text-slate-600 hover:text-blue-700 rounded hover:bg-slate-100"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setPrintFormat('thermal');
                              setPrintModalInvoice(inv);
                            }}
                            title="Reprint 80mm Thermal Receipt"
                            className="p-1 text-slate-600 hover:text-emerald-700 rounded hover:bg-slate-100"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setPrintFormat('a4');
                              setPrintModalInvoice(inv);
                            }}
                            title="Print / View A4 Tax Invoice"
                            className="p-1 text-slate-600 hover:text-indigo-700 rounded hover:bg-slate-100"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          {inv.status === 'Confirmed' && (
                            <button
                              onClick={() => {
                                setCancelModalInvoice(inv);
                                setCancelReason('');
                              }}
                              title="Cancel / Void Invoice (Revert Stock)"
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* History Pagination Bar */}
          <div className="p-2 bg-slate-100 border-t border-slate-300 flex items-center justify-between text-xs shrink-0 text-slate-600">
            <div>
              Showing {historyResult.items.length} of {historyResult.totalCount} invoices
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={historyPage <= 1}
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded disabled:opacity-40 text-xs font-semibold"
              >
                Previous
              </button>
              <span className="font-mono text-xs">
                Page {historyPage} of {historyResult.totalPages || 1}
              </span>
              <button
                disabled={historyPage >= historyResult.totalPages}
                onClick={() => setHistoryPage((p) => p + 1)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded disabled:opacity-40 text-xs font-semibold"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: CUSTOMER REGISTER & BALANCES                       */}
      {/* ========================================================= */}
      {activeSubTab === 'customers' && (
        <div className="flex-1 flex flex-col h-[calc(100%-40px)] bg-white overflow-hidden p-4">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Customer Directory & Credit Ledgers</h2>
              <p className="text-xs text-slate-500">
                Manage retail customers, trade buyers, GSTIN details, and outstanding balances.
              </p>
            </div>
            <button
              onClick={() => setIsAddCustomerOpen(true)}
              className="px-3 py-1.5 bg-[#106ebe] hover:bg-[#005a9e] text-white rounded font-semibold text-xs flex items-center gap-1.5 shadow-2xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Customer</span>
            </button>
          </div>

          <div className="flex-1 overflow-auto border border-slate-200 rounded">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="p-2 w-12 text-center">#</th>
                  <th className="p-2 w-24">Code</th>
                  <th className="p-2">Customer Name</th>
                  <th className="p-2 w-28">Mobile</th>
                  <th className="p-2 w-36">GSTIN</th>
                  <th className="p-2">City & State</th>
                  <th className="p-2 text-right w-32">Outstanding Balance</th>
                  <th className="p-2 text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allCustomers.map((c, i) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-2 text-center text-slate-400 font-mono">{i + 1}</td>
                    <td className="p-2 font-mono font-semibold text-slate-700">{c.code}</td>
                    <td className="p-2 font-bold text-slate-900">{c.name}</td>
                    <td className="p-2 font-mono text-slate-600">{c.mobile || '—'}</td>
                    <td className="p-2 font-mono text-slate-700">{c.gstin || 'Unregistered'}</td>
                    <td className="p-2 text-slate-600">
                      {c.city || '—'}, {c.state || 'Tamil Nadu'} ({c.stateCode || '33'})
                    </td>
                    <td className="p-2 text-right font-mono font-bold">
                      {c.currentBalance > 0 ? (
                        <span className="text-amber-700">₹{c.currentBalance.toFixed(2)}</span>
                      ) : (
                        <span className="text-slate-500">₹0.00</span>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => {
                          setSelectedCustomerId(c.id);
                          setActiveSubTab('pos');
                        }}
                        className="px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[11px] font-medium"
                      >
                        Start Bill
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: GST TAX SLABS SUMMARY                             */}
      {/* ========================================================= */}
      {activeSubTab === 'gst' && (
        <div className="flex-1 flex flex-col h-[calc(100%-40px)] bg-white overflow-hidden p-4">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-800">GST Tax Slabs & Collection Summary</h2>
            <p className="text-xs text-slate-500">
              Aggregated GST liabilities across tax rate tiers (0%, 5%, 12%, 18%, 28%) from confirmed sales.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
            {[0, 5, 12, 18, 28].map((rate) => {
              const invoices = db.getAllInvoices().filter((i) => i.status === 'Confirmed');
              let taxable = 0;
              let taxAmt = 0;

              for (const inv of invoices) {
                for (const it of inv.items) {
                  if (it.taxRate === rate) {
                    taxable += it.taxableAmount;
                    taxAmt += it.taxAmount;
                  }
                }
              }

              return (
                <div key={rate} className="bg-slate-50 border border-slate-200 rounded p-3 text-center">
                  <div className="text-xs font-bold text-slate-600 mb-1">{rate}% GST Slab</div>
                  <div className="text-sm font-mono font-bold text-slate-900">₹{taxAmt.toFixed(2)}</div>
                  <div className="text-[10px] text-slate-400 mt-1">Taxable: ₹{taxable.toFixed(2)}</div>
                </div>
              );
            })}
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-700" />
              <span>Compliant GST Multi-tier Invoicing Architecture</span>
            </div>
            <p>
              Intra-state supplies within Tamil Nadu (State Code 33) are split 50% CGST and 50% SGST. Inter-state
              supplies to customers outside Tamil Nadu are taxed under Integrated GST (IGST). Bill-level discounts
              are proportionally apportioned across taxable values without skewing tax collections.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: PRINT PREVIEW (THERMAL 80MM / A4 INVOICE)       */}
      {/* ========================================================= */}
      {printModalInvoice && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-3 bg-[#1e395b] text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4" />
                <span className="font-bold text-sm">
                  {printFormat === 'thermal' ? '3-inch (80mm) Thermal Receipt' : 'Standard A4 GST Tax Invoice'}
                </span>
                <span className="bg-white/20 px-1.5 py-0.2 rounded font-mono text-xs">
                  {printModalInvoice.invoiceNumber}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPrintFormat(printFormat === 'thermal' ? 'a4' : 'thermal')}
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-semibold flex items-center gap-1"
                >
                  Switch to {printFormat === 'thermal' ? 'A4 Invoice' : 'Thermal (80mm)'}
                </button>
                <button
                  onClick={() => setPrintModalInvoice(null)}
                  className="p-1 hover:bg-white/10 rounded text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Document Body */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-100 flex justify-center">
              {printFormat === 'thermal' ? (
                /* 80mm Thermal Receipt Preview */
                <div
                  id="printable-thermal"
                  className="w-[340px] bg-white p-4 text-[11px] font-mono leading-tight shadow-md border border-slate-300 text-black select-text"
                >
                  <div className="text-center pb-2 border-b border-dashed border-black">
                    <div className="font-bold text-sm">SRI MEENAKSHI SUPERMARKET</div>
                    <div>124, GST Road, Chromepet, Chennai - 600044</div>
                    <div>Phone: +91 98401 23456</div>
                    <div className="font-bold">GSTIN: 33AAAAA0000A1Z5</div>
                    <div>STATE: 33 - TAMIL NADU</div>
                  </div>

                  <div className="py-2 border-b border-dashed border-black text-[10px]">
                    <div className="flex justify-between">
                      <span>BILL #: {printModalInvoice.invoiceNumber}</span>
                      <span>
                        {new Date(printModalInvoice.invoiceDate).toLocaleDateString('en-IN')}{' '}
                        {new Date(printModalInvoice.invoiceDate).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div>CUST: {printModalInvoice.customerName}</div>
                    {printModalInvoice.customerMobile && <div>MOB: {printModalInvoice.customerMobile}</div>}
                    {printModalInvoice.customerGstin && <div>CUST GSTIN: {printModalInvoice.customerGstin}</div>}
                  </div>

                  {/* Items List */}
                  <table className="w-full text-left my-2 text-[10px]">
                    <thead>
                      <tr className="border-b border-black">
                        <th className="py-1">ITEM</th>
                        <th className="py-1 text-center">QTY</th>
                        <th className="py-1 text-right">RATE</th>
                        <th className="py-1 text-right">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dotted divide-slate-300">
                      {printModalInvoice.items.map((it, idx) => (
                        <tr key={idx}>
                          <td className="py-1">
                            <div className="font-semibold">{it.productName}</div>
                            {it.discountAmount > 0 && (
                              <div className="text-[9px] text-slate-600">Disc: -₹{it.discountAmount.toFixed(2)}</div>
                            )}
                          </td>
                          <td className="py-1 text-center font-mono">
                            {it.quantity} {it.unit}
                          </td>
                          <td className="py-1 text-right font-mono">₹{it.rate.toFixed(2)}</td>
                          <td className="py-1 text-right font-mono font-bold">₹{it.lineTotal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Summary Breakup */}
                  <div className="border-t border-dashed border-black pt-2 space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span>Gross Amount:</span>
                      <span className="font-mono">₹{printModalInvoice.grossAmount.toFixed(2)}</span>
                    </div>
                    {printModalInvoice.itemDiscount > 0 && (
                      <div className="flex justify-between">
                        <span>Item Discount:</span>
                        <span className="font-mono">-₹{printModalInvoice.itemDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    {printModalInvoice.billDiscount > 0 && (
                      <div className="flex justify-between">
                        <span>Bill Discount:</span>
                        <span className="font-mono">-₹{printModalInvoice.billDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Taxable Value:</span>
                      <span className="font-mono">₹{printModalInvoice.taxableAmount.toFixed(2)}</span>
                    </div>
                    {!printModalInvoice.isInterstate ? (
                      <>
                        <div className="flex justify-between">
                          <span>CGST:</span>
                          <span className="font-mono">₹{printModalInvoice.cgstAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>SGST:</span>
                          <span className="font-mono">₹{printModalInvoice.sgstAmount.toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between">
                        <span>IGST:</span>
                        <span className="font-mono">₹{printModalInvoice.igstAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {printModalInvoice.otherCharges > 0 && (
                      <div className="flex justify-between">
                        <span>Other Charges:</span>
                        <span className="font-mono">₹{printModalInvoice.otherCharges.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Round Off:</span>
                      <span className="font-mono">₹{printModalInvoice.roundOff.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-xs border-t border-b border-black py-1">
                      <span>GRAND TOTAL:</span>
                      <span className="font-mono">₹{printModalInvoice.grandTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span>Paid ({printModalInvoice.payments[0]?.paymentMethod || 'Cash'}):</span>
                      <span className="font-mono">₹{printModalInvoice.amountPaid.toFixed(2)}</span>
                    </div>
                    {printModalInvoice.cashChange ? (
                      <div className="flex justify-between font-bold text-[10px]">
                        <span>Change Returned:</span>
                        <span className="font-mono">₹{printModalInvoice.cashChange.toFixed(2)}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="text-center pt-3 mt-3 border-t border-dashed border-black space-y-1">
                    <div className="font-bold">*** THANK YOU, VISIT AGAIN! ***</div>
                    <div className="text-[9px] text-slate-600">Goods once sold cannot be returned after 7 days.</div>
                    <div className="text-[9px] font-mono tracking-widest pt-1">
                      ||| | ||||| || |||| ||| |||||||
                    </div>
                  </div>
                </div>
              ) : (
                /* A4 GST Invoice Preview */
                <div
                  id="printable-a4"
                  className="w-full max-w-xl bg-white p-6 shadow-md border border-slate-300 text-black text-xs leading-normal select-text"
                >
                  <div className="border border-black p-4 space-y-3">
                    {/* Header */}
                    <div className="text-center pb-2 border-b border-black">
                      <div className="font-bold text-base tracking-wide">TAX INVOICE</div>
                      <div className="text-[10px] text-slate-600 uppercase font-semibold">
                        ORIGINAL FOR RECIPIENT
                      </div>
                      <div className="font-bold text-sm text-[#1f4e79] mt-1">SRI MEENAKSHI SUPERMARKET</div>
                      <div className="text-[11px]">124, GST Road, Chromepet, Chennai - 600044, Tamil Nadu</div>
                      <div className="text-[11px] font-mono">
                        GSTIN: 33AAAAA0000A1Z5 | State Code: 33 (Tamil Nadu)
                      </div>
                    </div>

                    {/* Invoice & Buyer Info Grid */}
                    <div className="grid grid-cols-2 gap-4 text-[11px] pb-2 border-b border-black">
                      <div>
                        <div className="font-bold text-slate-800">Invoice Details:</div>
                        <div>
                          Invoice No: <strong>{printModalInvoice.invoiceNumber}</strong>
                        </div>
                        <div>
                          Date: {new Date(printModalInvoice.invoiceDate).toLocaleDateString('en-IN')}{' '}
                          {new Date(printModalInvoice.invoiceDate).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div>Place of Supply: {printModalInvoice.isInterstate ? 'Inter-state' : 'Tamil Nadu (33)'}</div>
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">Billed To (Buyer):</div>
                        <div className="font-semibold">{printModalInvoice.customerName}</div>
                        <div>Mobile: {printModalInvoice.customerMobile || '—'}</div>
                        <div>GSTIN: {printModalInvoice.customerGstin || 'Unregistered Consumer'}</div>
                      </div>
                    </div>

                    {/* Items Table */}
                    <table className="w-full text-left text-[10px] border border-black border-collapse">
                      <thead className="bg-slate-100 border-b border-black">
                        <tr>
                          <th className="p-1 border-r border-black w-6 text-center">#</th>
                          <th className="p-1 border-r border-black">Item Description</th>
                          <th className="p-1 border-r border-black w-14 text-center">HSN/SKU</th>
                          <th className="p-1 border-r border-black w-12 text-center">Qty</th>
                          <th className="p-1 border-r border-black w-14 text-right">Rate ₹</th>
                          <th className="p-1 border-r border-black w-14 text-right">Taxable ₹</th>
                          <th className="p-1 border-r border-black w-12 text-center">GST %</th>
                          <th className="p-1 text-right w-16">Total ₹</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black">
                        {printModalInvoice.items.map((it, idx) => (
                          <tr key={idx}>
                            <td className="p-1 border-r border-black text-center">{idx + 1}</td>
                            <td className="p-1 border-r border-black font-semibold">{it.productName}</td>
                            <td className="p-1 border-r border-black text-center font-mono">{it.productCode}</td>
                            <td className="p-1 border-r border-black text-center font-mono">
                              {it.quantity} {it.unit}
                            </td>
                            <td className="p-1 border-r border-black text-right font-mono">
                              ₹{it.rate.toFixed(2)}
                            </td>
                            <td className="p-1 border-r border-black text-right font-mono">
                              ₹{it.taxableAmount.toFixed(2)}
                            </td>
                            <td className="p-1 border-r border-black text-center font-mono">{it.taxRate}%</td>
                            <td className="p-1 text-right font-mono font-bold">₹{it.lineTotal.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Totals & Tax Breakup Grid */}
                    <div className="grid grid-cols-2 gap-4 text-[11px] pt-1">
                      <div className="space-y-1 text-[10px]">
                        <div className="font-bold">Bank Details:</div>
                        <div>Bank: State Bank of India</div>
                        <div>A/c No: 33440011223344</div>
                        <div>IFSC: SBIN0001234</div>
                        <div className="pt-2 font-bold">Declaration:</div>
                        <div className="text-[9px] text-slate-600">
                          We declare that this invoice shows actual price of the goods described and all particulars are
                          true and correct.
                        </div>
                      </div>

                      <div className="space-y-1 text-right">
                        <div className="flex justify-between">
                          <span>Taxable Value:</span>
                          <span className="font-mono">₹{printModalInvoice.taxableAmount.toFixed(2)}</span>
                        </div>
                        {!printModalInvoice.isInterstate ? (
                          <>
                            <div className="flex justify-between">
                              <span>Central Tax (CGST):</span>
                              <span className="font-mono">₹{printModalInvoice.cgstAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>State Tax (SGST):</span>
                              <span className="font-mono">₹{printModalInvoice.sgstAmount.toFixed(2)}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex justify-between">
                            <span>Integrated Tax (IGST):</span>
                            <span className="font-mono">₹{printModalInvoice.igstAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Round Off:</span>
                          <span className="font-mono">₹{printModalInvoice.roundOff.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-xs pt-1 border-t border-black">
                          <span>Invoice Total:</span>
                          <span className="font-mono">₹{printModalInvoice.grandTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Signatory Footer */}
                    <div className="pt-6 flex justify-between items-end border-t border-black text-[10px]">
                      <div>Customer Signature</div>
                      <div className="text-right">
                        <div className="font-semibold">For SRI MEENAKSHI SUPERMARKET</div>
                        <div className="h-8"></div>
                        <div className="border-t border-dotted border-black inline-block px-4">
                          Authorized Signatory
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-3 bg-slate-100 border-t border-slate-300 flex justify-between items-center shrink-0">
              <span className="text-xs text-slate-500">
                Ready for Windows 7 Spooler & Thermal POS Printer (COM/USB)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrintModalInvoice(null)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-[#106ebe] hover:bg-[#005a9e] text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: CANCEL / VOID INVOICE MODAL                      */}
      {/* ========================================================= */}
      {cancelModalInvoice && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-4 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <div className="font-bold text-rose-700 text-sm flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Void & Cancel Invoice #{cancelModalInvoice.invoiceNumber}</span>
              </div>
              <button onClick={() => setCancelModalInvoice(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-rose-50 border border-rose-200 p-3 rounded text-xs text-rose-900 space-y-1">
              <p className="font-semibold">Important Stock & Accounting Reversal:</p>
              <p>
                Cancelling this invoice will automatically restore all item quantities back to available product
                inventory, write a <code>SALES_CANCEL</code> stock movement ledger record, and revert customer debit
                balances.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cancellation Reason:</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Customer returned goods before departure / Billing mistake..."
                className="w-full p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-rose-500 h-20"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCancelModalInvoice(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold"
              >
                Never Mind
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelInvoice}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold shadow-2xs"
              >
                Confirm Cancellation & Revert Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: ADD NEW CUSTOMER QUICK MODAL                    */}
      {/* ========================================================= */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveQuickCustomer}
            className="bg-white rounded-lg shadow-2xl max-w-md w-full p-4 space-y-3"
          >
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-[#106ebe]" />
                <span>Add Customer</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCustomerOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. K. Selvam"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-[#106ebe] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">Mobile Number</label>
                  <input
                    type="text"
                    value={newCustMobile}
                    onChange={(e) => setNewCustMobile(e.target.value)}
                    placeholder="10-digit mobile"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono focus:border-[#106ebe] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">GSTIN (Optional)</label>
                  <input
                    type="text"
                    value={newCustGstin}
                    onChange={(e) => setNewCustGstin(e.target.value.toUpperCase())}
                    placeholder="15-digit GSTIN"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono focus:border-[#106ebe] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Address</label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder="Street / Locality"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-[#106ebe] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">City</label>
                  <input
                    type="text"
                    value={newCustCity}
                    onChange={(e) => setNewCustCity(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-[#106ebe] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">State</label>
                  <input
                    type="text"
                    value={newCustState}
                    onChange={(e) => setNewCustState(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-[#106ebe] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">State Code</label>
                  <input
                    type="text"
                    value={newCustStateCode}
                    onChange={(e) => setNewCustStateCode(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono focus:border-[#106ebe] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsAddCustomerOpen(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#106ebe] hover:bg-[#005a9e] text-white rounded text-xs font-bold shadow-2xs"
              >
                Save & Select Customer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: VIEW INVOICE DETAILS MODAL                       */}
      {/* ========================================================= */}
      {viewDetailsInvoice && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-xl w-full p-4 space-y-3 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2 shrink-0">
              <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <span>Invoice Details:</span>
                <span className="font-mono text-[#106ebe]">{viewDetailsInvoice.invoiceNumber}</span>
              </div>
              <button
                type="button"
                onClick={() => setViewDetailsInvoice(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200">
                <div>
                  <span className="text-slate-500">Customer:</span>{' '}
                  <strong>{viewDetailsInvoice.customerName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Date:</span>{' '}
                  <span className="font-mono">{new Date(viewDetailsInvoice.invoiceDate).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-500">Mobile:</span>{' '}
                  <span className="font-mono">{viewDetailsInvoice.customerMobile || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">GSTIN:</span>{' '}
                  <span className="font-mono">{viewDetailsInvoice.customerGstin || 'Unregistered'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Status:</span>{' '}
                  <span className="font-bold">{viewDetailsInvoice.status}</span>
                </div>
                <div>
                  <span className="text-slate-500">Payment:</span>{' '}
                  <span className="font-bold">{viewDetailsInvoice.paymentStatus}</span>
                </div>
              </div>

              <div>
                <div className="font-bold text-slate-700 mb-1">Line Items ({viewDetailsInvoice.items.length})</div>
                <div className="border border-slate-200 rounded overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="p-1.5">Item</th>
                        <th className="p-1.5 text-center">Qty</th>
                        <th className="p-1.5 text-right">Rate</th>
                        <th className="p-1.5 text-center">GST %</th>
                        <th className="p-1.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewDetailsInvoice.items.map((it, idx) => (
                        <tr key={idx}>
                          <td className="p-1.5 font-medium">{it.productName}</td>
                          <td className="p-1.5 text-center font-mono">
                            {it.quantity} {it.unit}
                          </td>
                          <td className="p-1.5 text-right font-mono">₹{it.rate.toFixed(2)}</td>
                          <td className="p-1.5 text-center font-mono">{it.taxRate}%</td>
                          <td className="p-1.5 text-right font-mono font-bold">₹{it.lineTotal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span>Gross Amount:</span>
                  <span className="font-mono">₹{viewDetailsInvoice.grossAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxable Value:</span>
                  <span className="font-mono">₹{viewDetailsInvoice.taxableAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total GST:</span>
                  <span className="font-mono">₹{viewDetailsInvoice.totalTaxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm border-t border-slate-200 pt-1 text-slate-900">
                  <span>Grand Total:</span>
                  <span className="font-mono text-[#106ebe]">₹{viewDetailsInvoice.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setPrintFormat('thermal');
                  setPrintModalInvoice(viewDetailsInvoice);
                  setViewDetailsInvoice(null);
                }}
                className="px-3 py-1.5 bg-[#106ebe] hover:bg-[#005a9e] text-white rounded text-xs font-semibold flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Thermal</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintFormat('a4');
                  setPrintModalInvoice(viewDetailsInvoice);
                  setViewDetailsInvoice(null);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold flex items-center gap-1"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Print A4 Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
