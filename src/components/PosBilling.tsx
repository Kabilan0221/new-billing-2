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
  UserPlus,
  Edit,
  Camera,
  Barcode as BarcodeIcon,
  PackagePlus,
} from 'lucide-react';
import { db } from '../services/dbEngine';
import { playScannerBeep } from '../services/soundEffects';
import { ProductDialog } from './ProductDialog';
import { SVTLogo } from './SVTLogo';
import { A4DotMatrixInvoice } from './A4DotMatrixInvoice';
import { printHtmlDirectly } from '../services/printService';
import { generateA4DotMatrixHtml, generateThermalReceiptHtml } from '../services/a4InvoiceHtmlGenerator';
import {
  Product,
  Customer,
  InvoiceHeader,
  InvoiceItem,
  InvoicePayment,
  GstSlabSummary,
  InvoiceFilter,
} from '../types';

export type PrintPaperFormat = 'a4' | 'a5' | 'a4-dual' | 'thermal-4inch' | 'thermal-3inch' | 'thermal-2inch';

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

  useEffect(() => {
    if (initialActiveSubTab) {
      setActiveSubTab(initialActiveSubTab);
    }
  }, [initialActiveSubTab]);

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
  const searchContainerRef = useRef<HTMLFormElement>(null);

  // Close search popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // UI Feedback / Alerts
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Modals & Previews
  const storeSettings = db.getAppSettings();
  const [printModalInvoice, setPrintModalInvoice] = useState<InvoiceHeader | null>(null);
  const [printFormat, setPrintFormat] = useState<PrintPaperFormat>(() => {
    try {
      const stored = localStorage.getItem('preferredPrintFormat') as PrintPaperFormat | null;
      if (stored && ['a4', 'a5', 'a4-dual', 'thermal-4inch', 'thermal-3inch', 'thermal-2inch'].includes(stored)) {
        return stored;
      }
    } catch {}
    const pref = storeSettings.receiptPaperSize || '';
    if (pref.includes('A4 Full') || pref.includes('Full Page') || pref.includes('Laser')) return 'a4';
    if (pref.includes('A5') || pref.includes('Half Sheet')) return 'a5';
    if (pref.includes('Dual') || pref.includes('2-in-1')) return 'a4-dual';
    if (pref.includes('80mm') || pref.includes('3-Inch')) return 'thermal-3inch';
    if (pref.includes('58mm') || pref.includes('2-Inch')) return 'thermal-2inch';
    if (pref.includes('104mm') || pref.includes('4-Inch')) return 'thermal-4inch';
    return 'thermal-3inch';
  });

  const handleUpdatePrintFormat = (fmt: PrintPaperFormat) => {
    setPrintFormat(fmt);
    try {
      localStorage.setItem('preferredPrintFormat', fmt);
    } catch {}
  };
  const [viewDetailsInvoice, setViewDetailsInvoice] = useState<InvoiceHeader | null>(null);
  const [cancelModalInvoice, setCancelModalInvoice] = useState<InvoiceHeader | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);

  // New Customer Form State (Name & Mobile only)
  const [newCustName, setNewCustName] = useState('');
  const [newCustMobile, setNewCustMobile] = useState('');

  // Customer Checkout Details State
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  // Camera & Quick Add State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraManualBarcode, setCameraManualBarcode] = useState('');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const thermalPrintScrollRef = useRef<HTMLDivElement>(null);

  // Click & shortcut timers for F9 and Checkout button (single vs double click)
  const checkoutClickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastF9PressRef = useRef<number>(0);

  // -------------------------------------------------------------
  // BILL HISTORY STATE
  // -------------------------------------------------------------
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatus, setHistoryStatus] = useState<string>('All');
  const [historyPayStatus, setHistoryPayStatus] = useState<string>('All');
  const [historyPayMethod, setHistoryPayMethod] = useState<string>('All');
  const [historyFromDate, setHistoryFromDate] = useState('');
  const [historyToDate, setHistoryToDate] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(25);
  const [historyResult, setHistoryResult] = useState<{
    items: InvoiceHeader[];
    totalCount: number;
    totalPages: number;
  }>({ items: [], totalCount: 0, totalPages: 1 });

  // Edit Bill Modal State
  const [editBillInvoice, setEditBillInvoice] = useState<InvoiceHeader | null>(null);
  const [editBillDate, setEditBillDate] = useState<string>('');
  const [editBillCustomerId, setEditBillCustomerId] = useState<number>(1);
  const [editBillCustomerName, setEditBillCustomerName] = useState<string>('');
  const [editBillCustomerMobile, setEditBillCustomerMobile] = useState<string>('');
  const [editBillCustomerGstin, setEditBillCustomerGstin] = useState<string>('');
  const [editBillNotes, setEditBillNotes] = useState<string>('');
  const [editBillDiscount, setEditBillDiscount] = useState<number>(0);
  const [editBillOtherCharges, setEditBillOtherCharges] = useState<number>(0);
  const [editBillItems, setEditBillItems] = useState<InvoiceItem[]>([]);
  const [editBillPaymentMethod, setEditBillPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Credit'>('Cash');
  const [editBillAmountPaid, setEditBillAmountPaid] = useState<number>(0);
  const [editBillRefNumber, setEditBillRefNumber] = useState<string>('');
  const [editBillAddProductId, setEditBillAddProductId] = useState<string>('');
  const [editBillError, setEditBillError] = useState<string>('');

  // Edit Payment Modal State
  const [editPaymentInvoice, setEditPaymentInvoice] = useState<InvoiceHeader | null>(null);
  const [editPayMethod, setEditPayMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Credit'>('Cash');
  const [editPayAmount, setEditPayAmount] = useState<number>(0);
  const [editPayRefNumber, setEditPayRefNumber] = useState<string>('');
  const [editPayNotes, setEditPayNotes] = useState<string>('');
  const [editPayError, setEditPayError] = useState<string>('');

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

  // Ensure thermal and invoice preview modals start at the top
  useEffect(() => {
    if (printModalInvoice && thermalPrintScrollRef.current) {
      thermalPrintScrollRef.current.scrollTop = 0;
    }
  }, [printModalInvoice, printFormat]);

  // Sync customer selection
  useEffect(() => {
    // Interstate handled via toggle
  }, [selectedCustomerId, allCustomers]);

  // Load History
  const loadHistory = () => {
    const filter: InvoiceFilter = {
      searchTerm: historySearch,
      status: historyStatus,
      paymentStatus: historyPayStatus,
      paymentMethod: historyPayMethod,
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
  }, [historySearch, historyStatus, historyPayStatus, historyPayMethod, historyFromDate, historyToDate, historyPage, historyPageSize]);

  // Handlers for Editing Bill & Payment
  const handleOpenEditBill = (inv: InvoiceHeader) => {
    setEditBillInvoice(inv);
    setEditBillDate(inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().slice(0, 16) : '');
    setEditBillCustomerId(inv.customerId || 1);
    setEditBillCustomerName(inv.customerName || '');
    setEditBillCustomerMobile(inv.customerMobile || '');
    setEditBillCustomerGstin(inv.customerGstin || '');
    setEditBillNotes(inv.notes || '');
    setEditBillDiscount(inv.billDiscount || 0);
    setEditBillOtherCharges(inv.otherCharges || 0);
    setEditBillItems(JSON.parse(JSON.stringify(inv.items || [])));
    const primaryPay = inv.payments?.[0];
    setEditBillPaymentMethod((primaryPay?.paymentMethod as any) || (inv.paymentMode as any) || 'Cash');
    setEditBillAmountPaid(inv.amountPaid !== undefined ? inv.amountPaid : inv.grandTotal);
    setEditBillRefNumber(primaryPay?.referenceNumber || '');
    setEditBillAddProductId('');
    setEditBillError('');
  };

  const handleUpdateEditBillItemQty = (index: number, newQty: number) => {
    const qty = Math.max(1, newQty || 1);
    setEditBillItems((prev) => {
      const next = [...prev];
      const it = { ...next[index] };
      it.quantity = qty;
      const lineGross = it.quantity * it.rate;
      it.discountAmount = Math.round(((lineGross * it.discountPercent) / 100) * 100) / 100;
      const lineNet = Math.max(0, lineGross - it.discountAmount);
      if (it.taxRate > 0) {
        it.taxableAmount = Math.round((lineNet / (1 + it.taxRate / 100)) * 100) / 100;
        it.taxAmount = Math.round((lineNet - it.taxableAmount) * 100) / 100;
        it.cgstAmount = Math.round((it.taxAmount / 2) * 100) / 100;
        it.sgstAmount = Math.round((it.taxAmount - it.cgstAmount) * 100) / 100;
      } else {
        it.taxableAmount = lineNet;
        it.taxAmount = 0;
        it.cgstAmount = 0;
        it.sgstAmount = 0;
      }
      it.lineTotal = lineNet;
      next[index] = it;
      return next;
    });
  };

  const handleUpdateEditBillItemRate = (index: number, newRate: number) => {
    const rate = Math.max(0, newRate || 0);
    setEditBillItems((prev) => {
      const next = [...prev];
      const it = { ...next[index] };
      it.rate = rate;
      const lineGross = it.quantity * it.rate;
      it.discountAmount = Math.round(((lineGross * it.discountPercent) / 100) * 100) / 100;
      const lineNet = Math.max(0, lineGross - it.discountAmount);
      if (it.taxRate > 0) {
        it.taxableAmount = Math.round((lineNet / (1 + it.taxRate / 100)) * 100) / 100;
        it.taxAmount = Math.round((lineNet - it.taxableAmount) * 100) / 100;
        it.cgstAmount = Math.round((it.taxAmount / 2) * 100) / 100;
        it.sgstAmount = Math.round((it.taxAmount - it.cgstAmount) * 100) / 100;
      } else {
        it.taxableAmount = lineNet;
        it.taxAmount = 0;
        it.cgstAmount = 0;
        it.sgstAmount = 0;
      }
      it.lineTotal = lineNet;
      next[index] = it;
      return next;
    });
  };

  const handleUpdateEditBillItemMrp = (index: number, newMrp: number) => {
    setEditBillItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], mrp: Math.max(0, newMrp || 0) };
      return next;
    });
  };

  const handleUpdateEditBillItemDisc = (index: number, newDisc: number) => {
    const disc = Math.min(100, Math.max(0, newDisc || 0));
    setEditBillItems((prev) => {
      const next = [...prev];
      const it = { ...next[index] };
      it.discountPercent = disc;
      const lineGross = it.quantity * it.rate;
      it.discountAmount = Math.round(((lineGross * it.discountPercent) / 100) * 100) / 100;
      const lineNet = Math.max(0, lineGross - it.discountAmount);
      if (it.taxRate > 0) {
        it.taxableAmount = Math.round((lineNet / (1 + it.taxRate / 100)) * 100) / 100;
        it.taxAmount = Math.round((lineNet - it.taxableAmount) * 100) / 100;
        it.cgstAmount = Math.round((it.taxAmount / 2) * 100) / 100;
        it.sgstAmount = Math.round((it.taxAmount - it.cgstAmount) * 100) / 100;
      } else {
        it.taxableAmount = lineNet;
        it.taxAmount = 0;
        it.cgstAmount = 0;
        it.sgstAmount = 0;
      }
      it.lineTotal = lineNet;
      next[index] = it;
      return next;
    });
  };

  const handleRemoveEditBillItem = (index: number) => {
    setEditBillItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddProductToEditBill = (prod: Product) => {
    const existingIdx = editBillItems.findIndex((it) => it.productId === prod.id);
    if (existingIdx !== -1) {
      handleUpdateEditBillItemQty(existingIdx, editBillItems[existingIdx].quantity + 1);
      return;
    }
    const qty = 1;
    const rate = prod.saleRate || 0;
    const mrp = prod.mrp ?? prod.saleRate ?? 0;
    const lineNet = qty * rate;
    const taxRate = prod.taxRate || 0;
    let taxableAmount = lineNet;
    let taxAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    if (taxRate > 0) {
      taxableAmount = Math.round((lineNet / (1 + taxRate / 100)) * 100) / 100;
      taxAmount = Math.round((lineNet - taxableAmount) * 100) / 100;
      cgstAmount = Math.round((taxAmount / 2) * 100) / 100;
      sgstAmount = Math.round((taxAmount - cgstAmount) * 100) / 100;
    }
    const newItem: InvoiceItem = {
      productId: prod.id,
      productCode: prod.productCode,
      barcode: prod.barcode,
      productName: prod.nameEn,
      unit: prod.unit,
      quantity: qty,
      mrp,
      rate,
      discountPercent: 0,
      discountAmount: 0,
      taxRate,
      taxableAmount,
      cgstRate: taxRate / 2,
      cgstAmount,
      sgstRate: taxRate / 2,
      sgstAmount,
      igstRate: 0,
      igstAmount: 0,
      taxAmount,
      lineTotal: lineNet,
    };
    setEditBillItems((prev) => [...prev, newItem]);
  };

  const editBillCalculated = useMemo(() => {
    if (!editBillInvoice) return null;
    return db.calculateInvoice({
      ...editBillInvoice,
      customerId: editBillCustomerId,
      customerName: editBillCustomerName,
      customerMobile: editBillCustomerMobile,
      customerGstin: editBillCustomerGstin,
      billDiscount: editBillDiscount,
      otherCharges: editBillOtherCharges,
      items: editBillItems,
      payments: [
        {
          paymentMethod: editBillPaymentMethod,
          amount: editBillAmountPaid,
          referenceNumber: editBillRefNumber,
        },
      ],
    });
  }, [
    editBillInvoice,
    editBillCustomerId,
    editBillCustomerName,
    editBillCustomerMobile,
    editBillCustomerGstin,
    editBillDiscount,
    editBillOtherCharges,
    editBillItems,
    editBillPaymentMethod,
    editBillAmountPaid,
    editBillRefNumber,
  ]);

  const handleSaveEditBill = () => {
    if (!editBillInvoice) return;
    if (editBillItems.length === 0) {
      setEditBillError('Invoice must contain at least one product item.');
      return;
    }

    const payments: InvoicePayment[] = [
      {
        invoiceId: editBillInvoice.id,
        invoiceNumber: editBillInvoice.invoiceNumber,
        paymentMethod: editBillPaymentMethod,
        amount: editBillAmountPaid,
        referenceNumber:
          editBillRefNumber ||
          (editBillPaymentMethod === 'Cash' ? 'CASH-COUNTER' : `REF-${Date.now().toString().slice(-6)}`),
        paymentDate: new Date().toISOString(),
      },
    ];

    const result = db.updateInvoice({
      id: editBillInvoice.id,
      invoiceDate: editBillDate ? new Date(editBillDate).toISOString() : editBillInvoice.invoiceDate,
      customerId: editBillCustomerId,
      customerName: editBillCustomerName,
      customerMobile: editBillCustomerMobile,
      customerGstin: editBillCustomerGstin,
      notes: editBillNotes,
      billDiscount: editBillDiscount,
      otherCharges: editBillOtherCharges,
      items: editBillItems,
      payments,
    });

    if (!result.success) {
      setEditBillError(result.errors.join(' '));
      return;
    }

    setAlertMessage({
      type: 'success',
      text: `Bill #${editBillInvoice.invoiceNumber} updated successfully! Total: ₹${result.invoice?.grandTotal.toFixed(2)}, Payment Method: ${result.invoice?.paymentMode} (${result.invoice?.paymentStatus}).`,
    });
    setTimeout(() => setAlertMessage(null), 4000);

    setEditBillInvoice(null);
    loadHistory();
    reloadData();
    if (onRefreshData) onRefreshData();
  };

  const handleOpenEditPayment = (inv: InvoiceHeader) => {
    setEditPaymentInvoice(inv);
    const primaryPay = inv.payments?.[0];
    setEditPayMethod((primaryPay?.paymentMethod as any) || (inv.paymentMode as any) || 'Cash');
    setEditPayAmount(inv.amountPaid !== undefined ? inv.amountPaid : inv.grandTotal);
    setEditPayRefNumber(primaryPay?.referenceNumber || '');
    setEditPayNotes(inv.notes || '');
    setEditPayError('');
  };

  const handleSaveEditPayment = () => {
    if (!editPaymentInvoice) return;

    const payments: InvoicePayment[] = [
      {
        invoiceId: editPaymentInvoice.id,
        invoiceNumber: editPaymentInvoice.invoiceNumber,
        paymentMethod: editPayMethod,
        amount: Number(editPayAmount) || 0,
        referenceNumber:
          editPayRefNumber ||
          (editPayMethod === 'Cash' ? 'CASH-COUNTER' : `REF-${Date.now().toString().slice(-6)}`),
        notes: editPayNotes,
        paymentDate: new Date().toISOString(),
      },
    ];

    const result = db.updateInvoicePayment(editPaymentInvoice.id, payments, editPayNotes);
    if (!result.success) {
      setEditPayError(result.errors.join(' '));
      return;
    }

    setAlertMessage({
      type: 'success',
      text: `Payment updated for Bill #${editPaymentInvoice.invoiceNumber}! Method: ${result.invoice?.paymentMode}, Paid: ₹${result.invoice?.amountPaid.toFixed(2)}, Status: ${result.invoice?.paymentStatus}.`,
    });
    setTimeout(() => setAlertMessage(null), 4000);

    setEditPaymentInvoice(null);
    loadHistory();
    reloadData();
    if (onRefreshData) onRefreshData();
  };

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
      customerName: customerName.trim() || (selectedCustomer ? selectedCustomer.name : 'Walk-in Customer'),
      customerMobile: customerMobile.trim() || selectedCustomer?.mobile || '',
      customerAddress: customerAddress.trim() || selectedCustomer?.address || '',
      customerGstin: '',
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
    customerName,
    customerMobile,
    customerAddress,
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

  // Camera video stream lifecycle & active real-time BarcodeDetector frame scanner
  useEffect(() => {
    let scanInterval: any = null;

    if (isCameraOpen) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ video: { facingMode: 'environment' } })
          .then((stream) => {
            cameraStreamRef.current = stream;
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.play().catch(() => {});

              // If browser supports BarcodeDetector, continuously scan frames
              if ('BarcodeDetector' in window) {
                try {
                  const detector = new (window as any).BarcodeDetector({
                    formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e'],
                  });

                  scanInterval = setInterval(async () => {
                    if (videoRef.current && videoRef.current.readyState >= 2) {
                      try {
                        const barcodes = await detector.detect(videoRef.current);
                        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                          handleCameraScanItem(barcodes[0].rawValue);
                        }
                      } catch (err) {}
                    }
                  }, 300);
                } catch (e) {
                  console.warn('BarcodeDetector initialization skipped:', e);
                }
              }
            }
          })
          .catch((err) => {
            console.warn('Camera access denied or unavailable:', err);
          });
      }
    } else {
      if (scanInterval) clearInterval(scanInterval);
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
    }

    return () => {
      if (scanInterval) clearInterval(scanInterval);
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
    };
  }, [isCameraOpen]);

  // Hardware USB Barcode Scanner & Quick key listener (F9 direct thermal print, Enter, Escape)
  useEffect(() => {
    let scanBuffer = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = performance.now();
      const timeDiff = now - lastKeyTime;
      lastKeyTime = now;

      // Reset buffer if human typing (> 80ms gap)
      if (timeDiff > 80) {
        scanBuffer = '';
      }

      // Check if Enter received from a rapid USB barcode scanner gun
      if (e.key === 'Enter') {
        const scannedCode = scanBuffer.trim();
        scanBuffer = '';

        if (scannedCode.length >= 3 && !printModalInvoice) {
          // Hardware barcode gun scanned code!
          e.preventDefault();
          e.stopPropagation();

          const found =
            db.getProductByBarcode(scannedCode) ||
            allProducts.find((p) => p.barcode.toLowerCase() === scannedCode.toLowerCase()) ||
            allProducts.find((p) => p.productCode.toLowerCase() === scannedCode.toLowerCase());

          if (found) {
            addItemToCart(found, 1);
            setSearchTerm('');
            setScanBarcode('');
            setIsSearchOpen(false);
          } else {
            playScannerBeep('error');
            setAlertMessage({
              type: 'warning',
              text: `Scanned barcode "${scannedCode}" was not found in catalog.`,
            });
            setTimeout(() => setAlertMessage(null), 3500);
          }
          return;
        }
      }

      // Buffer printable characters for barcode scanner gun
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const activeTag = document.activeElement?.tagName;
        const isOtherInput =
          (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') &&
          document.activeElement !== barcodeInputRef.current;

        // If in another input, only buffer if rapid bursts (< 45ms)
        if (!isOtherInput || timeDiff < 45) {
          scanBuffer += e.key;
        }
      }

      // F9 Quick key listener (triggers direct thermal print)
      if (e.key === 'F9') {
        e.preventDefault();
        e.stopPropagation();
        if (printModalInvoice) {
          playScannerBeep('print');
          if (printFormat.startsWith('thermal')) {
            const widthMm =
              printFormat === 'thermal-2inch' ? 58 : printFormat === 'thermal-4inch' ? 104 : 80;
            printHtmlDirectly(
              generateThermalReceiptHtml(printModalInvoice, storeSettings, widthMm),
              `Thermal_Receipt_${printModalInvoice.invoiceNumber}`,
              widthMm
            );
          } else {
            printHtmlDirectly(
              generateA4DotMatrixHtml(printModalInvoice, storeSettings),
              `Tax_Invoice_${printModalInvoice.invoiceNumber}`,
              210
            );
          }
          return;
        }
        if (cartItems.length === 0) {
          playScannerBeep('error');
          setAlertMessage({ type: 'warning', text: 'Cannot checkout: Cart is empty. Add products to begin.' });
          setTimeout(() => setAlertMessage(null), 2500);
          return;
        }

        // F9 direct thermal checkout & print
        const thermalFmt = printFormat.startsWith('thermal') ? printFormat : 'thermal-3inch';
        handleFinalizeBill(thermalFmt, true);
      }

      if (e.key === 'Enter' && printModalInvoice) {
        e.preventDefault();
        playScannerBeep('print');
        if (printFormat.startsWith('thermal')) {
          const widthMm =
            printFormat === 'thermal-2inch' ? 58 : printFormat === 'thermal-4inch' ? 104 : 80;
          printHtmlDirectly(
            generateThermalReceiptHtml(printModalInvoice, storeSettings, widthMm),
            `Thermal_Receipt_${printModalInvoice.invoiceNumber}`,
            widthMm
          );
        } else {
          printHtmlDirectly(
            generateA4DotMatrixHtml(printModalInvoice, storeSettings),
            `Tax_Invoice_${printModalInvoice.invoiceNumber}`,
            210
          );
        }
      }

      if (e.key === 'Escape') {
        if (printModalInvoice) {
          setPrintModalInvoice(null);
        } else if (isCameraOpen) {
          setIsCameraOpen(false);
        } else if (isQuickAddOpen) {
          setIsQuickAddOpen(false);
        } else if (cartItems.length > 0) {
          clearCart();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    cartItems,
    customerName,
    selectedCustomer,
    selectedCustomerId,
    customerMobile,
    customerAddress,
    isInterstate,
    billDiscount,
    otherCharges,
    notes,
    paymentMethod,
    tenderedAmount,
    isSplitMode,
    splitPayments,
    invoiceNumber,
    invoiceDate,
    printModalInvoice,
    isCameraOpen,
    isQuickAddOpen,
  ]);

  // Checkout F9 handler (Single click or F9 key triggers direct thermal print)
  const handleCheckoutF9 = () => {
    if (cartItems.length === 0) {
      playScannerBeep('error');
      setAlertMessage({ type: 'warning', text: 'Cannot checkout: Cart is empty. Add products to begin.' });
      setTimeout(() => setAlertMessage(null), 2500);
      return;
    }
    // Direct thermal print
    const thermalFmt = printFormat.startsWith('thermal') ? printFormat : 'thermal-3inch';
    handleFinalizeBill(thermalFmt, true);
  };

  // -------------------------------------------------------------
  // CART ACTIONS & BARCODE SCANNER
  // -------------------------------------------------------------
  const handleBarcodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = (searchTerm || scanBarcode).trim();
    if (!query) {
      barcodeInputRef.current?.focus();
      return;
    }

    const queryLower = query.toLowerCase();
    // Fast lookup: barcode -> SKU -> exact name -> search suggestion -> partial name / tamil name
    const found =
      db.getProductByBarcode(query) ||
      allProducts.find((p) => p.barcode.toLowerCase() === queryLower) ||
      allProducts.find((p) => p.productCode.toLowerCase() === queryLower) ||
      allProducts.find((p) => p.nameEn.toLowerCase() === queryLower) ||
      (searchFilteredProducts.length > 0 ? searchFilteredProducts[0] : null) ||
      allProducts.find((p) => p.nameEn.toLowerCase().includes(queryLower)) ||
      allProducts.find((p) => p.nameTa && p.nameTa.toLowerCase().includes(queryLower));

    if (found) {
      addItemToCart(found, 1);
      setSearchTerm('');
      setScanBarcode('');
      setIsSearchOpen(false);
    } else {
      playScannerBeep('error');
      setAlertMessage({
        type: 'warning',
        text: `Product with barcode or SKU "${query}" was not found in catalog.`,
      });
      setTimeout(() => setAlertMessage(null), 3500);
    }
  };

  const handleCameraScanItem = (barcode: string) => {
    const cleanBarcode = barcode.trim();
    const found =
      db.getProductByBarcode(cleanBarcode) ||
      allProducts.find((p) => p.barcode === cleanBarcode) ||
      allProducts.find((p) => p.productCode.toLowerCase() === cleanBarcode.toLowerCase());

    if (found) {
      addItemToCart(found, 1);
      setIsCameraOpen(false);
      setAlertMessage({ type: 'success', text: `Scanned & Added: ${found.nameEn}` });
      setTimeout(() => setAlertMessage(null), 3000);
    } else {
      playScannerBeep('error');
      setAlertMessage({ type: 'warning', text: `Barcode "${cleanBarcode}" not found.` });
      setTimeout(() => setAlertMessage(null), 3000);
    }
  };

  const addItemToCart = (prod: Product, qtyToAdd = 1) => {
    // Check stock warning
    if (prod.currentStock <= 0) {
      playScannerBeep('error');
      setAlertMessage({
        type: 'warning',
        text: `Warning: "${prod.nameEn}" is OUT OF STOCK (Stock: ${prod.currentStock}). Adding item will create negative stock if confirmed.`,
      });
      setTimeout(() => setAlertMessage(null), 4000);
    } else if (prod.currentStock < qtyToAdd) {
      playScannerBeep('error');
      setAlertMessage({
        type: 'warning',
        text: `Low stock warning: "${prod.nameEn}" available stock is only ${prod.currentStock} ${prod.unit}.`,
      });
      setTimeout(() => setAlertMessage(null), 4000);
    } else {
      // Normal scan sound
      playScannerBeep('success');
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
      const prodTax = prod.taxRate || 0;
      const initCgst = isInterstate ? 0 : Math.round((prodTax / 2) * 100) / 100;
      const initSgst = isInterstate ? 0 : Math.round((prodTax / 2) * 100) / 100;
      const initIgst = isInterstate ? prodTax : 0;

      const newLine: InvoiceItem = {
        productId: prod.id,
        productCode: prod.productCode,
        barcode: prod.barcode,
        productName: prod.nameEn,
        unit: prod.unit || 'PCS',
        quantity: qtyToAdd,
        mrp: prod.mrp !== undefined && prod.mrp > 0 ? prod.mrp : (prod.saleRate || 0),
        rate: prod.saleRate || 0,
        discountPercent: 0,
        discountAmount: 0,
        taxRate: prodTax,
        taxableAmount: 0,
        cgstRate: initCgst,
        cgstAmount: 0,
        sgstRate: initSgst,
        sgstAmount: 0,
        igstRate: initIgst,
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
    playScannerBeep('click');
    if (newQty <= 0) {
      removeCartItem(index);
      return;
    }
    setCartItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, quantity: newQty } : item))
    );
  };

  const updateCartItemMrp = (index: number, newMrp: number) => {
    setCartItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, mrp: Math.max(0, newMrp) } : item))
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

  const updateCartItemCgst = (index: number, rate: number) => {
    setCartItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, cgstRate: Math.max(0, rate) } : item))
    );
  };

  const updateCartItemSgst = (index: number, rate: number) => {
    setCartItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, sgstRate: Math.max(0, rate) } : item))
    );
  };

  const updateCartItemIgst = (index: number, rate: number) => {
    setCartItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, igstRate: Math.max(0, rate) } : item))
    );
  };

  const removeCartItem = (index: number) => {
    playScannerBeep('click');
    setCartItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const clearCart = () => {
    if (cartItems.length === 0) return;
    resetBill();
    playScannerBeep('click');
    setAlertMessage({
      type: 'info' as any,
      text: 'Current billing cart cleared.',
    });
    setTimeout(() => setAlertMessage(null), 2000);
  };

  const resetBill = () => {
    setCartItems([]);
    setBillDiscount(0);
    setOtherCharges(0);
    setTenderedAmount(0);
    setSplitPayments([]);
    setIsSplitMode(false);
    setNotes('');
    setCustomerName('');
    setCustomerMobile('');
    setCustomerAddress('');
    setInvoiceNumber(db.generateNextInvoiceNumber());
    setInvoiceDate(new Date().toISOString());
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  };

  // -------------------------------------------------------------
  // FINALIZE & PRINT INVOICE
  // -------------------------------------------------------------
  const handleFinalizeBill = (format: PrintPaperFormat = printFormat, autoPrint = true) => {
    if (cartItems.length === 0) {
      playScannerBeep('error');
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
      customerName: customerName.trim() || (selectedCustomer ? selectedCustomer.name : 'Walk-in Customer'),
      customerMobile: customerMobile.trim() || selectedCustomer?.mobile || '',
      customerAddress: customerAddress.trim() || selectedCustomer?.address || '',
      customerGstin: '',
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
      playScannerBeep('error');
      setAlertMessage({
        type: 'error',
        text: `Error saving invoice: ${res.errors.join(', ')}`,
      });
      setTimeout(() => setAlertMessage(null), 5000);
      return;
    }

    const savedInvoice = res.invoice!;
    playScannerBeep('print');
    setAlertMessage({
      type: 'success',
      text: `Invoice #${savedInvoice.invoiceNumber} confirmed successfully! Total: ₹${savedInvoice.grandTotal.toFixed(2)} (${savedInvoice.paymentStatus}). Stock deducted and ledger updated.`,
    });
    setTimeout(() => setAlertMessage(null), 4000);

    // Open print preview modal
    handleUpdatePrintFormat(format);
    setPrintModalInvoice(savedInvoice);

    // If autoPrint requested (e.g. F9 click / press), immediately trigger direct isolated thermal print
    if (autoPrint) {
      if (format.startsWith('thermal')) {
        const widthMm = format === 'thermal-2inch' ? 58 : format === 'thermal-4inch' ? 104 : 80;
        printHtmlDirectly(
          generateThermalReceiptHtml(savedInvoice, storeSettings, widthMm),
          `Thermal_Receipt_${savedInvoice.invoiceNumber}`,
          widthMm
        );
      } else {
        printHtmlDirectly(
          generateA4DotMatrixHtml(savedInvoice, storeSettings),
          `Tax_Invoice_${savedInvoice.invoiceNumber}`,
          210
        );
      }
    }

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
    });

    if (res.success && res.customer) {
      setAllCustomers(db.getCustomers());
      setSelectedCustomerId(res.customer.id);
      setIsAddCustomerOpen(false);
      setNewCustName('');
      setNewCustMobile('');
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
      'Payment Method': inv.payments?.map((p) => p.paymentMethod).filter(Boolean).join(', ') || inv.paymentMode || 'Cash',
      'Payment Reference': inv.payments?.map((p) => p.referenceNumber).filter(Boolean).join(', ') || '',
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
      {/* TAB 1: POS BILLING TERMINAL (MODERN SCREENSHOT FORMAT)   */}
      {/* ========================================================= */}
      {activeSubTab === 'pos' && (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-100 overflow-hidden p-1.5">
          {/* Main Card with rounded corners and border matching image */}
          <div className="flex-1 flex flex-col min-h-0 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            {/* Top Bar: Barcode/Search Input + Add Item + Camera Scan + Quick Add */}
            <div className="px-3 py-2 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 bg-white">
              <form onSubmit={handleBarcodeSubmit} className="flex-1 relative" ref={searchContainerRef}>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-blue-500 pointer-events-none flex items-center">
                    <BarcodeIcon className="w-4 h-4" />
                  </div>
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setIsSearchOpen(true);
                    }}
                    onFocus={() => {
                      if (searchTerm.trim()) setIsSearchOpen(true);
                    }}
                    placeholder="Scan or type barcode / product name..."
                    className="w-full pl-9 pr-8 py-1.5 bg-white border-2 border-blue-400 focus:border-blue-600 rounded-lg text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none shadow-2xs transition-colors"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setIsSearchOpen(false);
                      }}
                      className="absolute right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Suggestions Popover */}
                {isSearchOpen && searchFilteredProducts.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {searchFilteredProducts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          addItemToCart(p, 1);
                          setSearchTerm('');
                          setIsSearchOpen(false);
                        }}
                        className="p-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div className="flex-1 min-w-0 pr-3">
                          <div className="font-semibold text-slate-900 truncate text-xs">{p.nameEn}</div>
                          {p.nameTa && <div className="text-[11px] text-slate-500">{p.nameTa}</div>}
                          <div className="text-[10px] font-mono text-slate-400">
                            {p.productCode} · Barcode: {p.barcode}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-bold text-blue-600 font-mono text-xs">₹{p.saleRate.toFixed(2)}</div>
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
              </form>

              {/* Top Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleBarcodeSubmit()}
                  className="px-4 py-1.5 bg-[#1877f2] hover:bg-blue-700 text-white font-medium rounded-lg text-xs shadow-2xs transition-colors shrink-0 cursor-pointer flex items-center justify-center"
                >
                  Add Item
                </button>

                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-600 border border-blue-400 hover:border-blue-500 font-medium rounded-lg text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5 text-blue-600" />
                  <span>Camera Scan</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(true)}
                  className="px-3 py-1.5 bg-emerald-50/40 hover:bg-emerald-50 text-emerald-700 border border-emerald-400 hover:border-emerald-500 font-medium rounded-lg text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <PackagePlus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>+ Quick Add</span>
                </button>
              </div>
            </div>

            {/* Middle Section: Empty State or Cart Items Table */}
            <div className="flex-1 p-3 overflow-hidden flex flex-col min-h-0 bg-white">
              {cartItems.length === 0 ? (
                /* Empty State Dashed Container Matching Screenshot */
                <div className="flex-1 border border-dashed border-slate-300 rounded-2xl bg-white flex flex-col items-center justify-center p-8 select-none">
                  {/* Barcode Graphic */}
                  <div className="flex items-center justify-center gap-1 text-slate-400 mb-4">
                    <span className="w-1 h-8 bg-slate-300 rounded-full"></span>
                    <span className="w-1.5 h-11 bg-slate-400 rounded-full"></span>
                    <span className="w-0.5 h-7 bg-slate-300 rounded-full"></span>
                    <span className="w-1.5 h-11 bg-slate-400 rounded-full"></span>
                    <span className="w-1 h-8 bg-slate-300 rounded-full"></span>
                  </div>
                  <h3 className="text-slate-800 font-bold text-sm tracking-tight text-center">
                    Cart is empty. Scan a barcode or search a product to begin.
                  </h3>
                  <p className="text-slate-400 text-xs mt-1 text-center max-w-md">
                    Scan a barcode using camera, or type product name/code in the search box to begin billing.
                  </p>
                </div>
              ) : (
                /* Cart Items Table */
                <div className="flex-1 flex flex-col min-h-0 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <table className="w-full table-fixed text-left text-xs border-separate border-spacing-0">
                      <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 select-none">
                        <tr>
                          <th className="py-2 px-1 text-center border-b border-r border-slate-200 w-[3.5%] truncate">#</th>
                          <th className="py-2 px-2 border-b border-r border-slate-200 w-[11.5%] truncate">Barcode</th>
                          <th className="py-2 px-2 border-b border-r border-slate-200 w-[24%] truncate">Item Description</th>
                          <th className="py-2 px-1 text-center w-[11%] border-b border-r border-slate-200 truncate">Qty</th>
                          <th className="py-2 px-1 text-right w-[7%] border-b border-r border-slate-200 truncate">MRP ₹</th>
                          <th className="py-2 px-1 text-right w-[7.5%] border-b border-r border-slate-200 font-bold text-slate-800 truncate">Rate ₹</th>
                          <th className="py-2 px-1 text-center w-[4.5%] border-b border-r border-slate-200 truncate">Disc%</th>
                          <th className="py-2 px-0.5 text-center w-[4.5%] border-b border-r border-slate-200 text-blue-800 truncate">CGST%</th>
                          <th className="py-2 px-0.5 text-center w-[4.5%] border-b border-r border-slate-200 text-blue-800 truncate">SGST%</th>
                          <th className="py-2 px-0.5 text-center w-[4.5%] border-b border-r border-slate-200 text-indigo-800 truncate">IGST%</th>
                          <th className="py-2 px-1 text-right w-[6.5%] border-b border-r border-slate-200 truncate">GST ₹</th>
                          <th className="py-2 px-1.5 text-right w-[8%] border-b border-r border-slate-200 font-bold text-emerald-800 truncate">Total ₹</th>
                          <th className="py-2 px-1 w-[3%] text-center border-b border-slate-200"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {calculatedBill.items.map((item, idx) => {
                          const prod = allProducts.find((p) => p.id === item.productId);
                          const isStockLow = prod && prod.currentStock < item.quantity;
                          return (
                            <tr key={item.id || idx} className="hover:bg-blue-50/40 transition-colors">
                              <td className="py-1.5 px-1 text-center text-slate-400 font-mono text-[11px] border-r border-slate-100">{idx + 1}</td>
                              <td className="py-1.5 px-2 font-mono text-slate-600 text-[10px] border-r border-slate-100 truncate">
                                <div className="truncate font-semibold">{item.barcode || '—'}</div>
                                <div className="text-[9px] text-slate-400 truncate">{item.productCode}</div>
                              </td>
                              <td className="py-1.5 px-2 border-r border-slate-100 truncate">
                                <div className="font-semibold text-slate-900 truncate">{item.productName}</div>
                                {prod?.nameTa && <div className="text-[10px] text-slate-500 font-sans truncate">{prod.nameTa}</div>}
                                {isStockLow && (
                                   <div className="text-[9px] text-amber-700 font-medium flex items-center gap-1 mt-0.5 truncate">
                                    <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0 inline" />
                                    <span>Avail: {prod?.currentStock || 0}</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-1 px-1 text-center border-r border-slate-100">
                                <div className="inline-flex items-center border border-slate-200 rounded bg-slate-50 overflow-hidden shadow-2xs">
                                  <button
                                    type="button"
                                    onClick={() => updateCartItemQuantity(idx, item.quantity - 1)}
                                    className="w-5 h-5 hover:bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-600 cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="any"
                                    value={item.quantity}
                                    onChange={(e) => updateCartItemQuantity(idx, parseFloat(e.target.value) || 0)}
                                    className="w-8 h-5 text-center font-mono font-bold text-[11px] focus:outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updateCartItemQuantity(idx, item.quantity + 1)}
                                    className="w-5 h-5 hover:bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-600 cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              {/* MRP Edit Box */}
                              <td className="py-1 px-1 text-right border-r border-slate-100">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={item.mrp !== undefined ? item.mrp : item.rate}
                                  onChange={(e) => updateCartItemMrp(idx, parseFloat(e.target.value) || 0)}
                                  placeholder="0.00"
                                  className="w-full max-w-[56px] px-1 py-0.5 border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded text-right font-mono text-[11px] text-slate-700 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </td>
                              {/* Rate Edit Box */}
                              <td className="py-1 px-1 text-right border-r border-slate-100 bg-emerald-50/20">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={item.rate}
                                  onChange={(e) => updateCartItemRate(idx, parseFloat(e.target.value) || 0)}
                                  title="Final Price: GST is deducted backwards"
                                  className="w-full max-w-[56px] px-1 py-0.5 border border-emerald-300 focus:border-emerald-600 rounded text-right font-mono text-[11px] font-semibold text-slate-900 bg-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </td>
                              <td className="py-1 px-0.5 text-center border-r border-slate-100">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={item.discountPercent || 0}
                                  onChange={(e) => updateCartItemDiscount(idx, parseFloat(e.target.value) || 0)}
                                  className="w-full max-w-[34px] px-0.5 py-0.5 border border-slate-200 rounded text-center font-mono text-[11px] text-slate-800 focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </td>
                              {/* CGST % Edit Box */}
                              <td className="py-1 px-0.5 text-center border-r border-slate-100 bg-blue-50/20">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="any"
                                  value={item.cgstRate ?? 0}
                                  onChange={(e) => updateCartItemCgst(idx, parseFloat(e.target.value) || 0)}
                                  placeholder="0"
                                  className="w-full max-w-[34px] px-0.5 py-0.5 border border-blue-200 focus:border-blue-500 rounded text-center font-mono text-[11px] text-blue-900 bg-white font-medium focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </td>
                              {/* SGST % Edit Box */}
                              <td className="py-1 px-0.5 text-center border-r border-slate-100 bg-blue-50/20">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="any"
                                  value={item.sgstRate ?? 0}
                                  onChange={(e) => updateCartItemSgst(idx, parseFloat(e.target.value) || 0)}
                                  placeholder="0"
                                  className="w-full max-w-[34px] px-0.5 py-0.5 border border-blue-200 focus:border-blue-500 rounded text-center font-mono text-[11px] text-blue-900 bg-white font-medium focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </td>
                              {/* IGST % Edit Box */}
                              <td className="py-1 px-0.5 text-center border-r border-slate-100 bg-indigo-50/20">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="any"
                                  value={item.igstRate ?? 0}
                                  onChange={(e) => updateCartItemIgst(idx, parseFloat(e.target.value) || 0)}
                                  placeholder="0"
                                  className="w-full max-w-[34px] px-0.5 py-0.5 border border-indigo-200 focus:border-indigo-500 rounded text-center font-mono text-[11px] text-indigo-900 bg-white font-medium focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </td>
                              <td className="py-1.5 px-1 text-right font-mono tabular-nums text-slate-700 border-r border-slate-100 text-[11px]">₹{item.taxAmount.toFixed(1)}</td>
                              <td className="py-1.5 px-1 text-right font-mono font-bold tabular-nums text-slate-900 border-r border-slate-100 text-[11px]">₹{item.lineTotal.toFixed(1)}</td>
                              <td className="py-1.5 px-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeCartItem(idx)}
                                  className="p-0.5 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                  title="Remove Item"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Cart Bottom Summary Strip */}
                  <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
                    <div className="flex items-center gap-3">
                      <span>Total Items: <strong className="font-mono text-slate-800">{calculatedBill.totalItems}</strong> lines</span>
                      <span className="text-slate-300">|</span>
                      <span>Total Qty: <strong className="font-mono text-slate-800">{calculatedBill.totalQty}</strong> units</span>
                    </div>
                    <button
                      type="button"
                      onClick={clearCart}
                      className="text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer text-xs"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Clear Cart (Esc)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Checkout Section: Fixed Ultra-Compact POS Grid (Never Stacks Vertically) */}
            <div className="border-t border-slate-200 bg-white px-2.5 py-1.5 grid grid-cols-12 gap-2 shrink-0 select-none">
              {/* Column 1: Customer Details (col-span-4) */}
              <div className="col-span-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-0.5">
                    <span className="font-bold text-slate-800 text-[10px] tracking-wider uppercase">
                      CUSTOMER DETAILS
                    </span>
                    <span className="text-[9px] font-semibold text-slate-400">QUICK: F9</span>
                  </div>

                  <div className="space-y-1">
                    <div className="grid grid-cols-2 gap-1">
                      <input
                        type="text"
                        placeholder="Name (பெயர்)"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[11px] placeholder:text-slate-400 text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none h-6"
                      />
                      <input
                        type="tel"
                        placeholder="Mobile (அலைபேசி)"
                        value={customerMobile}
                        onChange={(e) => setCustomerMobile(e.target.value)}
                        className="w-full px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[11px] placeholder:text-slate-400 text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none h-6"
                      />
                    </div>

                    <div>
                      <input
                        type="text"
                        placeholder="Notes (குறிப்புகள்)"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[11px] placeholder:text-slate-400 text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none h-6"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 2: PAYMENT METHOD (col-span-4) */}
              <div className="col-span-4 border-l border-slate-200 pl-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-0.5">
                    <span className="font-bold text-slate-800 text-[10px] tracking-wider uppercase">
                      PAYMENT METHOD
                    </span>
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="text-slate-500">Tendered:</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={tenderedAmount || ''}
                        onChange={(e) => setTenderedAmount(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-14 px-1 py-0 bg-slate-50 border border-slate-200 rounded text-center font-mono text-[10px] text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none h-5"
                      />
                    </div>
                  </div>

                  {/* 4 buttons row */}
                  <div className="grid grid-cols-4 gap-1 mb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod('Cash');
                        setIsSplitMode(false);
                      }}
                      className={`flex items-center justify-center gap-0.5 py-0.5 px-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer h-5.5 ${
                        paymentMethod === 'Cash' && !isSplitMode
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <Banknote className="w-2.5 h-2.5 shrink-0" />
                      <span>Cash</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod('UPI');
                        setIsSplitMode(false);
                      }}
                      className={`flex items-center justify-center gap-0.5 py-0.5 px-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer h-5.5 ${
                        paymentMethod === 'UPI' && !isSplitMode
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <Smartphone className="w-2.5 h-2.5 shrink-0" />
                      <span>UPI</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod('Card');
                        setIsSplitMode(false);
                      }}
                      className={`flex items-center justify-center gap-0.5 py-0.5 px-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer h-5.5 ${
                        paymentMethod === 'Card' && !isSplitMode
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <CreditCard className="w-2.5 h-2.5 shrink-0" />
                      <span>Card</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsSplitMode(true);
                      }}
                      className={`flex items-center justify-center gap-0.5 py-0.5 px-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer h-5.5 ${
                        isSplitMode
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <Layers className="w-2.5 h-2.5 shrink-0" />
                      <span>Split</span>
                    </button>
                  </div>

                  {/* Single-row Payment Status Strip */}
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[9px]">
                    <div className="flex items-center gap-0.5">
                      <span className="text-slate-500 font-medium">Paid:</span>
                      <span className="font-mono font-bold text-emerald-600">
                        ₹{(calculatedBill.paidAmount ?? 0).toFixed(0)}
                      </span>
                    </div>
                    <div className="h-2.5 w-[1px] bg-slate-200" />
                    <div className="flex items-center gap-0.5">
                      <span className="text-slate-500 font-medium">Bal:</span>
                      <span className="font-mono font-bold text-amber-600">
                        ₹{(calculatedBill.balanceDue ?? 0).toFixed(0)}
                      </span>
                    </div>
                    <div className="h-2.5 w-[1px] bg-slate-200" />
                    <div className="flex items-center gap-0.5">
                      <span className="text-slate-500 font-medium">Chg:</span>
                      <span className="font-mono font-bold text-emerald-600">
                        ₹{(calculatedBill.cashChange ?? 0).toFixed(0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 3: TOTALS & ACTION BUTTONS (col-span-4) */}
              <div className="col-span-4 border-l border-slate-200 pl-2 flex flex-col justify-between">
                {/* Compact Totals Strip */}
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded px-2 py-0.5">
                  <div className="flex items-center gap-2 text-[10px] text-slate-600">
                    <span>Sub: <strong className="font-mono text-slate-800">₹{(calculatedBill.grossAmount - calculatedBill.itemDiscount).toFixed(0)}</strong></span>
                    <span className="flex items-center gap-0.5">
                      Disc:
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={billDiscount || ''}
                        onChange={(e) => setBillDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="0"
                        className="w-10 px-1 py-0 bg-white border border-slate-200 rounded text-center font-mono text-[9px] text-slate-800 focus:border-blue-500 focus:outline-none h-4"
                      />
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="font-bold text-slate-900 text-[11px]">TOTAL:</span>
                    <span className="font-extrabold text-blue-600 text-sm font-mono">
                      ₹{calculatedBill.grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* 1 Unified Row: Format selector + Thermal Button (F9) + A4 Button */}
                <div className="flex items-center gap-1 mt-1">
                  <select
                    value={printFormat}
                    onChange={(e) => handleUpdatePrintFormat(e.target.value as PrintPaperFormat)}
                    className="w-[30%] bg-white border border-slate-300 rounded px-1 py-1 font-semibold text-slate-700 text-[9px] focus:outline-none cursor-pointer h-7 truncate"
                    title="Print Paper Format"
                  >
                    <option value="thermal-3inch">🧾 3" Thermal (80mm)</option>
                    <option value="thermal-4inch">🧾 4" Thermal (104mm)</option>
                    <option value="thermal-2inch">🧾 2" Thermal (58mm)</option>
                    <option value="a4">📄 A4 Tax Invoice</option>
                    <option value="a5">📄 A5 Half Sheet</option>
                    <option value="a4-dual">📄 A4 Dual Copy</option>
                  </select>

                  <button
                    type="button"
                    disabled={cartItems.length === 0}
                    onClick={() => {
                      const thermalFmt = printFormat.startsWith('thermal') ? printFormat : 'thermal-3inch';
                      handleUpdatePrintFormat(thermalFmt);
                      handleFinalizeBill(thermalFmt, true);
                    }}
                    className={`flex-1 py-1 px-1.5 rounded font-bold text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer h-7 shadow-2xs ${
                      cartItems.length === 0
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white'
                    }`}
                    title="Checkout & Print Thermal POS Receipt - F9"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span className="truncate">🧾 Print Thermal (F9)</span>
                  </button>

                  <button
                    type="button"
                    disabled={cartItems.length === 0}
                    onClick={() => {
                      handleUpdatePrintFormat('a4');
                      handleFinalizeBill('a4', true);
                    }}
                    className={`w-[26%] py-1 px-1 rounded font-bold text-[10px] flex items-center justify-center gap-1 border transition-colors cursor-pointer h-7 ${
                      cartItems.length === 0
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-white hover:bg-blue-50 text-blue-700 border-blue-300'
                    }`}
                    title="Checkout & Print A4 Tax Invoice (Laser / Inkjet)"
                  >
                    <FileText className="w-3 h-3 text-blue-600" />
                    <span className="truncate">📄 Print A4</span>
                  </button>
                </div>
              </div>
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

              <div className="flex items-center gap-1 text-slate-600">
                <span className="font-semibold text-[11px]">Method:</span>
                <select
                  value={historyPayMethod}
                  onChange={(e) => {
                    setHistoryPayMethod(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                >
                  <option value="All">All Methods</option>
                  <option value="Cash">💵 Cash</option>
                  <option value="UPI">📱 UPI</option>
                  <option value="Card">💳 Card</option>
                  <option value="Bank Transfer">🏦 Bank Transfer</option>
                  <option value="Credit">⏳ Credit / Due</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  setHistorySearch('');
                  setHistoryStatus('All');
                  setHistoryPayStatus('All');
                  setHistoryPayMethod('All');
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
                  <th className="p-2 text-center w-28">Payment Mode</th>
                  <th className="p-2 text-center w-24">Pay Status</th>
                  <th className="p-2 text-center w-44">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {historyResult.items.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-16 text-center text-slate-400">
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
                        {(() => {
                          const methods = inv.payments?.length
                            ? inv.payments.map((p) => p.paymentMethod).filter(Boolean)
                            : [inv.paymentMode || 'Cash'];
                          const primaryMethod = methods[0] || 'Cash';
                          const isSplit = methods.length > 1;

                          let badgeClass = 'bg-slate-100 text-slate-700 border-slate-300';
                          let icon = '💵';
                          if (primaryMethod === 'Cash') {
                            badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                            icon = '💵';
                          } else if (primaryMethod === 'UPI') {
                            badgeClass = 'bg-violet-50 text-violet-800 border-violet-200';
                            icon = '📱';
                          } else if (primaryMethod === 'Card') {
                            badgeClass = 'bg-blue-50 text-blue-800 border-blue-200';
                            icon = '💳';
                          } else if (primaryMethod === 'Bank Transfer') {
                            badgeClass = 'bg-indigo-50 text-indigo-800 border-indigo-200';
                            icon = '🏦';
                          } else if (primaryMethod === 'Credit') {
                            badgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
                            icon = '⏳';
                          }

                          const refNum = inv.payments?.[0]?.referenceNumber;

                          return (
                            <div className="flex flex-col items-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold ${badgeClass}`}
                              >
                                <span>{icon}</span>
                                <span>{isSplit ? `Split (${methods.length})` : primaryMethod}</span>
                              </span>
                              {refNum && (
                                <span
                                  className="text-[9px] text-slate-400 font-mono mt-0.5 truncate max-w-[90px]"
                                  title={refNum}
                                >
                                  {refNum}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="p-2 text-center">
                        <div className="flex flex-col items-center">
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
                          {inv.paymentStatus === 'Partial' && (
                            <span className="text-[9px] text-amber-700 font-mono mt-0.5">
                              Due ₹{inv.balanceDue.toFixed(0)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEditBill(inv)}
                            title="Edit Bill & Items"
                            className="p-1 text-slate-600 hover:text-amber-700 rounded hover:bg-slate-100"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditPayment(inv)}
                            title="Edit / Update Payment Method & Received Amount"
                            className="p-1 text-slate-600 hover:text-emerald-700 rounded hover:bg-slate-100"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setViewDetailsInvoice(inv)}
                            title="View Full Bill Details"
                            className="p-1 text-slate-600 hover:text-blue-700 rounded hover:bg-slate-100"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              handleUpdatePrintFormat('a4');
                              setPrintModalInvoice(inv);
                            }}
                            title="Print A4 Tax Invoice (Image 1 Format · No Bank Details)"
                            className="p-1 text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              handleUpdatePrintFormat('thermal-3inch');
                              setPrintModalInvoice(inv);
                            }}
                            title="Print Thermal POS Receipt (80mm / 104mm)"
                            className="p-1 text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200"
                          >
                            <Printer className="w-3.5 h-3.5" />
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
                  <th className="p-2 w-32">Mobile</th>
                  <th className="p-2 text-right w-36">Outstanding Balance</th>
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
      {/* ========================================================= */}
      {/* MODAL 1: PRINT PREVIEW (4-INCH THERMAL / A4 INVOICE)      */}
      {/* ========================================================= */}
      {printModalInvoice && (() => {
        const hasGst = Boolean(
          (printModalInvoice.taxableAmount > 0 &&
            (printModalInvoice.cgstAmount > 0 ||
              printModalInvoice.sgstAmount > 0 ||
              printModalInvoice.igstAmount > 0)) ||
          printModalInvoice.items.some((it) => (it.taxRate || 0) > 0)
        );
        const totalQuantity = printModalInvoice.items.reduce(
          (sum, it) => sum + (Number(it.quantity) || 0),
          0
        );
        const totalItemsCount = printModalInvoice.items.length;
        const modalMaxWidth =
          printFormat === 'a4' || printFormat === 'a4-dual'
            ? 'max-w-5xl'
            : printFormat === 'a5'
            ? 'max-w-4xl'
            : 'max-w-2xl';

        const thermalContainerWidth =
          printFormat === 'thermal-2inch'
            ? 'w-[260px]'
            : printFormat === 'thermal-3inch'
            ? 'w-[360px]'
            : 'w-full max-w-[500px] sm:w-[520px]';

        const invoiceDateObj = new Date(printModalInvoice.invoiceDate);
        const invoiceDateStr = invoiceDateObj.toLocaleDateString('en-IN');
        const invoiceTimeStr = invoiceDateObj.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });

        // Reusable Half-Sheet Invoice Layout (for A5 single page and A4 Dual copies)
        const renderHalfSheetInvoice = (copyBadge?: string) => (
          <div className="border border-black p-3 space-y-2 text-black text-[11px] leading-tight bg-white select-text">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-black pb-2">
              <div>
                <div className="font-black text-base uppercase tracking-wider text-black">
                  {storeSettings.storeName || 'SRI VENKATESWARA FURNITURE AND STORE'}
                </div>
                <div className="text-[10px] text-black font-semibold mt-0.5">
                  மடம் தெரு, அண்ணா விளையாட்டு பூங்கா அருகில், காஞ்சிபுரம் - 631 502
                </div>
                <div className="text-[10px] font-bold text-black font-mono">
                  Ph: 8143 84 8143 / 9941333457 | GSTIN/UIN: {storeSettings.gstNumber || '33AGOPV5229Q1ZH'}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-black text-sm uppercase tracking-wide">
                  {hasGst ? 'TAX INVOICE' : 'ESTIMATE / CASH BILL'}
                </div>
                {copyBadge && (
                  <div className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 border border-black inline-block mt-0.5 bg-slate-100">
                    {copyBadge}
                  </div>
                )}
              </div>
            </div>

            {/* Meta & Customer Details Row */}
            <div className="grid grid-cols-2 gap-2 text-[10px] py-1 border-b border-black">
              <div>
                <div>
                  BILL NO: <strong className="font-mono text-xs">{printModalInvoice.invoiceNumber}</strong>
                </div>
                <div>
                  DATE: {invoiceDateStr} {invoiceTimeStr}
                </div>
                <div>Place of Supply: {printModalInvoice.isInterstate ? 'Inter-state' : 'Tamil Nadu (33)'}</div>
              </div>
              <div>
                <div>
                  CUSTOMER: <strong className="text-black">{printModalInvoice.customerName}</strong>
                </div>
                <div>MOBILE: {printModalInvoice.customerMobile || '—'}</div>
                <div>GSTIN: {printModalInvoice.customerGstin || 'Unregistered Consumer'}</div>
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full text-left text-[10px] border border-black border-collapse">
              <thead className="bg-slate-100 border-b border-black font-bold">
                <tr>
                  <th className="p-1 border-r border-black w-6 text-center">#</th>
                  <th className="p-1 border-r border-black">Item Description</th>
                  <th className="p-1 border-r border-black w-14 text-center">HSN/Code</th>
                  <th className="p-1 border-r border-black w-14 text-center">Qty</th>
                  <th className="p-1 border-r border-black w-16 text-right">Rate ₹</th>
                  {hasGst && <th className="p-1 border-r border-black w-12 text-center">GST%</th>}
                  <th className="p-1 text-right w-20">Total ₹</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black">
                {printModalInvoice.items.map((it, idx) => (
                  <tr key={idx} className="align-middle">
                    <td className="p-1 border-r border-black text-center">{idx + 1}</td>
                    <td className="p-1 border-r border-black font-bold text-black">{it.productName}</td>
                    <td className="p-1 border-r border-black text-center font-mono">{it.productCode}</td>
                    <td className="p-1 border-r border-black text-center font-mono font-semibold">
                      {it.quantity} {it.unit}
                    </td>
                    <td className="p-1 border-r border-black text-right font-mono">₹{it.rate.toFixed(2)}</td>
                    {hasGst && <td className="p-1 border-r border-black text-center font-mono">{it.taxRate}%</td>}
                    <td className="p-1 text-right font-mono font-bold text-black">₹{it.lineTotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals & Signatory */}
            <div className="flex justify-between items-end pt-1">
              <div className="text-[9px] text-slate-700 space-y-0.5">
                <div>
                  TOTAL ITEMS: <strong className="font-mono">{totalItemsCount}</strong> | TOTAL QTY:{' '}
                  <strong className="font-mono">{totalQuantity}</strong>
                </div>
                {hasGst && (
                  <div>
                    Taxable: ₹{printModalInvoice.taxableAmount.toFixed(2)} | CGST: ₹
                    {printModalInvoice.cgstAmount.toFixed(2)} | SGST: ₹{printModalInvoice.sgstAmount.toFixed(2)}
                  </div>
                )}
                <div>
                  Payment: {printModalInvoice.payments[0]?.paymentMethod || 'Cash'} (Paid: ₹
                  {printModalInvoice.amountPaid.toFixed(2)})
                </div>
                <div className="pt-0.5 font-semibold italic text-[9px]">*** Thank You! Visit Again ***</div>
              </div>

              <div className="text-right">
                {Math.abs(printModalInvoice.roundOff) > 0.001 && (
                  <div className="text-[10px] text-slate-600">Round Off: ₹{printModalInvoice.roundOff.toFixed(2)}</div>
                )}
                <div className="text-sm font-black text-black">
                  NET PAYABLE: ₹{printModalInvoice.grandTotal.toFixed(2)}
                </div>
                <div className="pt-2 text-[10px]">
                  <div className="font-semibold">For {storeSettings.storeName || 'SRI VENKATESWARA FURNITURE AND STORE'}</div>
                  <div className="text-[9px] text-slate-600">Authorized Signatory</div>
                </div>
              </div>
            </div>
          </div>
        );

        return (
          <div className="print-modal-root fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            {/* Embedded Print CSS for exact paper formats without truncation */}
            <style>{`
              @media print {
                @page {
                  size: ${
                    printFormat === 'a4'
                      ? 'A4 portrait'
                      : printFormat === 'a5'
                      ? '210mm 148mm'
                      : printFormat === 'a4-dual'
                      ? 'A4 portrait'
                      : printFormat === 'thermal-3inch'
                      ? '80mm auto'
                      : printFormat === 'thermal-2inch'
                      ? '58mm auto'
                      : '104mm auto'
                  };
                  margin: ${
                    printFormat === 'a4'
                      ? '6mm 6mm 6mm 6mm'
                      : printFormat === 'a5'
                      ? '3mm 5mm 3mm 5mm'
                      : printFormat === 'a4-dual'
                      ? '4mm 6mm 4mm 6mm'
                      : '0mm'
                  };
                }
                *, *::before, *::after {
                  box-sizing: border-box !important;
                }
                html, body {
                  width: 100% !important;
                  height: auto !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #ffffff !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                body * {
                  visibility: hidden !important;
                }
                .print-modal-root,
                .print-modal-card,
                .print-modal-body {
                  position: static !important;
                  display: block !important;
                  overflow: visible !important;
                  max-height: none !important;
                  height: auto !important;
                  width: 100% !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  background: transparent !important;
                  box-shadow: none !important;
                  border: none !important;
                  visibility: visible !important;
                }
                #printable-thermal,
                #printable-thermal *,
                #printable-a4,
                #printable-a4 *,
                .a4-dot-matrix-root,
                .a4-dot-matrix-root *,
                #printable-a5,
                #printable-a5 *,
                #printable-a4-dual,
                #printable-a4-dual * {
                  visibility: visible !important;
                }
                #printable-thermal {
                  position: relative !important;
                  left: auto !important;
                  top: auto !important;
                  width: 100% !important;
                  min-width: 100% !important;
                  max-width: ${
                    printFormat === 'thermal-3inch' ? '80mm' : printFormat === 'thermal-2inch' ? '58mm' : '104mm'
                  } !important;
                  margin: 0 auto !important;
                  padding: 2mm 3mm 15mm 3mm !important;
                  border: none !important;
                  box-shadow: none !important;
                  background: #ffffff !important;
                  color: #000000 !important;
                  overflow: visible !important;
                  box-sizing: border-box !important;
                  display: block !important;
                }
                #printable-a4 {
                  position: relative !important;
                  left: auto !important;
                  top: auto !important;
                  width: 100% !important;
                  max-width: 210mm !important;
                  margin: 0 auto !important;
                  padding: 0mm !important;
                  border: none !important;
                  box-shadow: none !important;
                  background: #ffffff !important;
                  color: #000000 !important;
                  overflow: visible !important;
                  display: block !important;
                  box-sizing: border-box !important;
                }

                #printable-a5 {
                  position: relative !important;
                  left: auto !important;
                  top: auto !important;
                  width: 100% !important;
                  max-width: 198mm !important;
                  height: 138mm !important;
                  max-height: 140mm !important;
                  margin: 0 auto !important;
                  padding: 3mm 5mm !important;
                  border: 1px solid #000000 !important;
                  box-shadow: none !important;
                  background: #ffffff !important;
                  color: #000000 !important;
                  overflow: hidden !important;
                  display: flex !important;
                  flex-direction: column !important;
                  justify-content: space-between !important;
                  box-sizing: border-box !important;
                }
                #printable-a4-dual {
                  position: relative !important;
                  left: auto !important;
                  top: auto !important;
                  width: 100% !important;
                  max-width: 198mm !important;
                  margin: 0 auto !important;
                  padding: 2mm 5mm !important;
                  border: none !important;
                  box-shadow: none !important;
                  background: #ffffff !important;
                  color: #000000 !important;
                  overflow: visible !important;
                  display: block !important;
                  box-sizing: border-box !important;
                }
              }
            `}</style>
            <div
              className={`print-modal-card bg-white rounded-lg shadow-2xl ${modalMaxWidth} w-full max-h-[92vh] flex flex-col overflow-hidden transition-all duration-200`}
            >
              {/* Modal Header */}
              <div className="print-modal-header p-3 bg-[#1e395b] text-white flex flex-wrap justify-between items-center gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-sm">
                    {printFormat === 'a4'
                      ? 'A4 Dot-Matrix Tax Invoice (Image 1 Format · No Bank Details)'
                      : printFormat === 'a5'
                      ? 'A5 Half Sheet Invoice (210×148mm - அரை தாள்)'
                      : printFormat === 'a4-dual'
                      ? 'A4 Dual Half-Sheet (2 Invoices on 1 A4 Sheet)'
                      : printFormat === 'thermal-3inch'
                      ? '3-Inch (80mm) Thermal Receipt'
                      : printFormat === 'thermal-2inch'
                      ? '2-Inch (58mm) Thermal Receipt'
                      : '4-Inch (104mm) Thermal Receipt'}
                  </span>
                  <span className="bg-white/20 px-1.5 py-0.2 rounded font-mono text-xs">
                    {printModalInvoice.invoiceNumber}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Quick Format Pills */}
                  <button
                    type="button"
                    onClick={() => handleUpdatePrintFormat('a4')}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                      printFormat === 'a4'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white/10 hover:bg-white/20 text-slate-200'
                    }`}
                  >
                    📄 A4 Tax Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdatePrintFormat('thermal-3inch')}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                      printFormat === 'thermal-3inch'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white/10 hover:bg-white/20 text-slate-200'
                    }`}
                  >
                    🧾 3" Thermal (80mm)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdatePrintFormat('thermal-4inch')}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                      printFormat === 'thermal-4inch'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white/10 hover:bg-white/20 text-slate-200'
                    }`}
                  >
                    🧾 4" Thermal (104mm)
                  </button>

                  <select
                    value={printFormat}
                    onChange={(e) => handleUpdatePrintFormat(e.target.value as PrintPaperFormat)}
                    className="bg-white/10 hover:bg-white/20 text-white border border-white/30 rounded px-2 py-1 text-xs font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="a4" className="text-slate-900 font-medium">
                      📄 A4 Sheet Tax Invoice (Image 1 Dot-Matrix - No Bank Details)
                    </option>
                    <option value="thermal-3inch" className="text-slate-900 font-medium">
                      🧾 3-Inch Thermal (80mm POS Roll)
                    </option>
                    <option value="thermal-4inch" className="text-slate-900 font-medium">
                      🧾 4-Inch Thermal (104mm POS Roll)
                    </option>
                    <option value="thermal-2inch" className="text-slate-900 font-medium">
                      🧾 2-Inch Thermal (58mm Portable Roll)
                    </option>
                    <option value="a5" className="text-slate-900 font-medium">
                      📄 A5 Half Sheet (210×148mm - அரை தாள்)
                    </option>
                    <option value="a4-dual" className="text-slate-900 font-medium">
                      📄 A4 Dual Half (2 Copies on 1 Sheet)
                    </option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setPrintModalInvoice(null)}
                    className="p-1 hover:bg-white/20 rounded text-white cursor-pointer ml-1"
                    title="Close preview (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>


              {/* Modal Document Body */}
              <div
                ref={thermalPrintScrollRef}
                className="print-modal-body flex-1 overflow-y-auto p-2 sm:p-4 bg-slate-100 flex justify-center items-start"
              >
                {printFormat === 'a5' ? (
                  /* ======================================================== */
                  /* A5 Half Sheet Invoice (210mm x 148mm - அரை தாள்)         */
                  /* ======================================================== */
                  <div id="printable-a5" className="w-full max-w-[210mm] bg-white shadow-md">
                    {renderHalfSheetInvoice('CUSTOMER COPY / வாடிக்கையாளர் நகல்')}
                  </div>
                ) : printFormat === 'a4-dual' ? (
                  /* ======================================================== */
                  /* A4 Dual Half-Sheet (2 Copies on 1 A4 Page)               */
                  /* ======================================================== */
                  <div
                    id="printable-a4-dual"
                    className="w-full max-w-4xl bg-white shadow-md p-4 space-y-4 text-black"
                  >
                    {/* Copy 1: Top Half */}
                    {renderHalfSheetInvoice('ORIGINAL FOR RECIPIENT / வாடிக்கையாளர் நகல்')}

                    {/* Center Scissor Divider */}
                    <div className="flex items-center justify-center gap-2 py-2 text-slate-500 font-mono text-xs select-none border-y border-dashed border-slate-400">
                      <span>✂</span>
                      <span className="tracking-widest uppercase text-[10px] font-bold">
                        FOLD & CUT HERE / நடுவில் வெட்டி இரு நகல்களாக பிரிக்கவும்
                      </span>
                      <span>✂</span>
                    </div>

                    {/* Copy 2: Bottom Half */}
                    {renderHalfSheetInvoice('DUPLICATE / STORE & ACCOUNTS COPY / கடை நகல்')}
                  </div>
                ) : printFormat.startsWith('thermal') ? (
                  /* ======================================================== */
                  /* Thermal Receipt Preview (104mm, 80mm, or 58mm)          */
                  /* ======================================================== */
                  <div
                    id="printable-thermal"
                    className={`${thermalContainerWidth} bg-white p-3 sm:p-4 pb-4 text-xs font-mono leading-tight shadow-md border border-slate-300 text-black select-text my-0`}
                  >
                    {/* Store Heading Name in English only, no logo, no Tamil subtitle */}
                    <div className="text-center pb-2 border-b-2 border-dashed border-black">
                      <div className="font-black text-base sm:text-lg uppercase tracking-wider text-black leading-tight">
                        {storeSettings.storeName || 'SRI VENKATESWARA FURNITURE AND STORE'}
                      </div>
                      <div className="text-[11px] text-black font-semibold mt-0.5 leading-tight">
                        மடம் தெரு, அண்ணா விளையாட்டு பூங்கா அருகில்
                      </div>
                      <div className="text-[11px] text-black font-bold leading-tight">
                        காஞ்சிபுரம் - 631 502.
                      </div>
                      <div className="text-[11px] font-bold text-black font-mono mt-0.5">
                        Ph: 8143 84 8143 / 9941333457
                      </div>
                      <div className="text-[11px] font-black text-black font-mono mt-0.5 tracking-wide">
                        GSTIN/UIN: {storeSettings.gstNumber || '33AGOPV5229Q1ZH'}
                      </div>
                      {hasGst && (
                        <div className="mt-1">
                          <span className="font-extrabold text-[10px] uppercase px-2 py-0.5 border border-black inline-block tracking-wider bg-slate-50">
                            TAX INVOICE
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bill No, Date & Time */}
                    <div className="py-1.5 border-b border-dashed border-black text-xs font-mono">
                      <div className="flex justify-between items-center font-bold">
                        <span>
                          BILL NO: <span className="font-extrabold">{printModalInvoice.invoiceNumber}</span>
                        </span>
                        <div className="text-right">
                          <span>DATE: {invoiceDateStr}</span>
                          <span className="ml-2 font-extrabold">TIME: {invoiceTimeStr}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-0.5">
                        <div>
                          <span className="font-bold">CUSTOMER: </span>
                          <span>{printModalInvoice.customerName}</span>
                        </div>
                        {printModalInvoice.customerMobile && (
                          <div>
                            <span className="font-bold">MOB: </span>
                            <span>{printModalInvoice.customerMobile}</span>
                          </div>
                        )}
                      </div>
                      {hasGst && printModalInvoice.customerGstin && (
                        <div className="mt-0.5 font-bold">
                          <span>CUST GSTIN: </span>
                          <span>{printModalInvoice.customerGstin}</span>
                        </div>
                      )}
                    </div>

                    {/* Items List */}
                    <table className="w-full text-left my-1.5 text-xs border-collapse">
                      <thead>
                        <tr className="border-b-2 border-black text-xs font-bold uppercase">
                          <th className="py-0.5 w-7 text-center">#</th>
                          <th className="py-0.5">ITEM DESCRIPTION</th>
                          <th className="py-0.5 text-center w-16">QTY</th>
                          <th className="py-0.5 text-right w-20">RATE</th>
                          {hasGst && <th className="py-0.5 text-center w-14">GST%</th>}
                          <th className="py-0.5 text-right w-24">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dotted divide-slate-400">
                        {printModalInvoice.items.map((it, idx) => (
                          <tr key={idx} className="align-top">
                            <td className="py-1 text-center text-[11px] text-slate-700">{idx + 1}</td>
                            <td className="py-1 pr-1">
                              <div className="font-bold text-black">{it.productName}</div>
                              {it.discountAmount > 0 && (
                                <div className="text-[10px] text-slate-600">Disc: -₹{it.discountAmount.toFixed(2)}</div>
                              )}
                            </td>
                            <td className="py-1 text-center font-mono font-bold">
                              {it.quantity} {it.unit}
                            </td>
                            <td className="py-1 text-right font-mono">₹{it.rate.toFixed(2)}</td>
                            {hasGst && (
                              <td className="py-1 text-center font-mono text-[11px]">{it.taxRate}%</td>
                            )}
                            <td className="py-1 text-right font-mono font-bold text-black">
                              ₹{it.lineTotal.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Summary Breakup */}
                    <div className="border-t-2 border-dashed border-black pt-1.5 space-y-1 text-xs">
                      <div className="flex justify-between items-center py-1 px-1.5 bg-slate-50 border-b border-dotted border-black">
                        <span className="font-bold text-xs text-slate-800">
                          TOTAL ITEMS: <span className="font-mono text-xs font-extrabold">{totalItemsCount}</span>
                        </span>
                        <span className="font-black text-xs text-black">
                          TOTAL QTY: <span className="font-mono text-sm font-black">{totalQuantity}</span>
                        </span>
                      </div>

                      {printModalInvoice.billDiscount > 0 && (
                        <div className="flex justify-between text-xs px-1">
                          <span>Bill Discount:</span>
                          <span className="font-mono font-bold">-₹{printModalInvoice.billDiscount.toFixed(2)}</span>
                        </div>
                      )}

                      {hasGst && (
                        <div className="border-y border-dotted border-black py-1 px-1 space-y-0.5 text-[10.5px] bg-amber-50/40">
                          <div className="flex justify-between">
                            <span>Taxable Amount (GST Base):</span>
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
                          <div className="flex justify-between font-bold text-[11px] pt-0.5 border-t border-dotted border-slate-300">
                            <span>Total GST Amount:</span>
                            <span className="font-mono">
                              ₹{(printModalInvoice.cgstAmount + printModalInvoice.sgstAmount + printModalInvoice.igstAmount).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}

                      {Math.abs(printModalInvoice.roundOff) > 0.001 && (
                        <div className="flex justify-between text-[11px] px-1">
                          <span>Round Off:</span>
                          <span className="font-mono">₹{printModalInvoice.roundOff.toFixed(2)}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center font-black border-t-2 border-b-2 border-black py-1 px-1">
                        <span className="tracking-wide text-xs sm:text-sm font-extrabold">GRAND TOTAL:</span>
                        <span className="font-mono text-base sm:text-lg font-black text-black">
                          ₹{printModalInvoice.grandTotal.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex justify-between text-xs px-1 pt-0.5">
                        <span>Payment ({printModalInvoice.payments[0]?.paymentMethod || 'Cash'}):</span>
                        <span className="font-mono font-bold">₹{printModalInvoice.amountPaid.toFixed(2)}</span>
                      </div>
                      {printModalInvoice.cashChange ? (
                        <div className="flex justify-between font-bold text-xs px-1">
                          <span>Change Returned:</span>
                          <span className="font-mono font-bold">₹{printModalInvoice.cashChange.toFixed(2)}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="text-center pt-2 mt-2 border-t-2 border-dashed border-black space-y-0.5 bg-white">
                      <div className="font-bold text-xs tracking-wider">*** THANK YOU, VISIT AGAIN! ***</div>
                      <div className="text-[10px] font-mono tracking-widest pt-0.5">
                        ||| | ||||| || |||| ||| |||||||
                      </div>
                      <div className="hidden print:block print:h-8"></div>
                    </div>
                  </div>
                ) : (
                  /* ======================================================== */
                  /* A4 Dot-Matrix Tax Invoice (Image 1 Format, No Bank Details) */
                  /* ======================================================== */
                  <div
                    id="printable-a4"
                    className="w-full max-w-[215mm] bg-white p-2 sm:p-4 shadow-md border border-slate-300 overflow-x-auto"
                  >
                    <A4DotMatrixInvoice
                      invoice={printModalInvoice}
                      settings={storeSettings}
                      copyTitle="Original for Receipient"
                    />
                  </div>
                )}

              </div>

              {/* Modal Actions */}
              <div className="print-modal-footer p-3 bg-slate-100 border-t border-slate-300 flex justify-between items-center shrink-0">
                <span className="text-xs text-slate-600 font-medium">
                  {printFormat === 'a4'
                    ? 'A4 Full Page (210×297mm) · Laser / Inkjet'
                    : printFormat === 'a5'
                    ? 'A5 Half Sheet (210×148mm - அரை தாள்) · Dot Matrix / Laser'
                    : printFormat === 'a4-dual'
                    ? 'A4 Dual Half-Sheet (2 Invoices on 1 A4 Page - 2-in-1)'
                    : printFormat === 'thermal-3inch'
                    ? '3-Inch Thermal (80mm POS Roll)'
                    : printFormat === 'thermal-2inch'
                    ? '2-Inch Thermal (58mm Portable Roll)'
                    : '4-Inch Thermal POS Printer (104mm)'}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setPrintModalInvoice(null)}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Close (Esc)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playScannerBeep('print');
                      if (printFormat.startsWith('thermal')) {
                        const widthMm =
                          printFormat === 'thermal-2inch' ? 58 : printFormat === 'thermal-4inch' ? 104 : 80;
                        printHtmlDirectly(
                          generateThermalReceiptHtml(printModalInvoice, storeSettings, widthMm),
                          `Thermal_Receipt_${printModalInvoice.invoiceNumber}`,
                          widthMm
                        );
                      } else {
                        printHtmlDirectly(
                          generateA4DotMatrixHtml(printModalInvoice, storeSettings),
                          `Tax_Invoice_${printModalInvoice.invoiceNumber}`,
                          210
                        );
                      }
                    }}
                    className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>
                      Print{' '}
                      {printFormat === 'a4'
                        ? 'A4 Tax Invoice'
                        : printFormat === 'a5'
                        ? 'A5 Half Sheet'
                        : printFormat === 'a4-dual'
                        ? 'Dual Copies'
                        : `${printFormat.replace('thermal-', '')} Thermal Receipt`}{' '}
                      (F9 / Enter)
                    </span>
                  </button>
                </div>

              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================= */}
      {/* MODAL: CAMERA BARCODE SCANNER                             */}
      {/* ========================================================= */}
      {isCameraOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-3 bg-[#1e395b] text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-300" />
                <span className="font-bold text-sm">Live Camera Barcode Scanner</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCameraOpen(false)}
                className="p-1 hover:bg-white/10 rounded text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Viewport & Scanning Reticle */}
            <div className="p-4 bg-slate-900 text-white flex flex-col items-center">
              <div className="relative w-full max-w-xs h-56 bg-black rounded-lg overflow-hidden border-2 border-cyan-400 flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Laser animation bar */}
                <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-rose-500 shadow-[0_0_12px_rgba(239,68,68,1)] animate-pulse pointer-events-none" />
                {/* Viewfinder corner guides */}
                <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-300 pointer-events-none" />
                <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-300 pointer-events-none" />
                <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-300 pointer-events-none" />
                <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-300 pointer-events-none" />
                <div className="absolute bottom-2 inset-x-0 text-center text-[10px] text-cyan-200 bg-black/60 py-0.5">
                  Align product barcode inside red laser
                </div>
              </div>
            </div>

            {/* Manual Entry & Quick Tap Barcodes for instantaneous testing */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 space-y-3">
              {/* Quick Scan Barcode Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (cameraManualBarcode.trim()) {
                    handleCameraScanItem(cameraManualBarcode.trim());
                    setCameraManualBarcode('');
                  }
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={cameraManualBarcode}
                  onChange={(e) => setCameraManualBarcode(e.target.value)}
                  placeholder="Or enter barcode directly..."
                  className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-mono focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold cursor-pointer shrink-0"
                >
                  Scan Code
                </button>
              </form>

              {/* Quick-tap sample product barcodes from store */}
              <div>
                <div className="text-[11px] font-semibold text-slate-600 mb-1 flex items-center justify-between">
                  <span>Quick-tap Store Barcodes:</span>
                  <span className="text-[10px] text-slate-400">Tap to instant add</span>
                </div>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {allProducts.slice(0, 8).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleCameraScanItem(p.barcode)}
                      className="px-2 py-0.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-400 rounded text-[10px] text-slate-700 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <BarcodeIcon className="w-2.5 h-2.5 text-slate-400" />
                      <span className="truncate max-w-[120px]">{p.nameEn}</span>
                      <span className="font-mono text-slate-400 text-[9px]">({p.barcode})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-2.5 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCameraOpen(false)}
                className="px-4 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Close Scanner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: QUICK ADD PRODUCT TO CATALOG & CART                */}
      {/* ========================================================= */}
      <ProductDialog
        product={null}
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        title="POS Store — Quick Add Product to Master Catalog & Cart"
        submitButtonText="Save & Add to Cart"
        onSaved={(newProduct) => {
          setIsQuickAddOpen(false);
          const refreshed = db.getAllProducts();
          setAllProducts(refreshed);
          if (newProduct) {
            addItemToCart(newProduct, 1);
            playScannerBeep('success');
            setAlertMessage({
              type: 'success',
              text: `Product "${newProduct.nameEn}" saved to master catalog & added to cart!`,
            });
            setTimeout(() => setAlertMessage(null), 4000);
          }
          onRefreshData?.();
        }}
      />

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
            className="bg-white rounded-lg shadow-2xl max-w-sm w-full p-4 space-y-3"
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

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. K. Selvam"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-[#106ebe] focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={newCustMobile}
                  onChange={(e) => setNewCustMobile(e.target.value)}
                  placeholder="10-digit mobile"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono focus:border-[#106ebe] focus:outline-none"
                />
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200">
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
                  <span className="text-slate-500">Payment Status:</span>{' '}
                  <span className="font-bold">{viewDetailsInvoice.paymentStatus}</span>
                </div>
                <div>
                  <span className="text-slate-500">Payment Method:</span>{' '}
                  <strong className="text-emerald-800">
                    {viewDetailsInvoice.payments?.map((p) => p.paymentMethod).filter(Boolean).join(', ') ||
                      viewDetailsInvoice.paymentMode ||
                      'Cash'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Amount Paid:</span>{' '}
                  <strong className="font-mono text-emerald-700">₹{viewDetailsInvoice.amountPaid.toFixed(2)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Balance Due:</span>{' '}
                  <strong
                    className={`font-mono ${viewDetailsInvoice.balanceDue > 0 ? 'text-amber-700' : 'text-slate-600'}`}
                  >
                    ₹{viewDetailsInvoice.balanceDue.toFixed(2)}
                  </strong>
                </div>
                {viewDetailsInvoice.payments?.[0]?.referenceNumber && (
                  <div className="col-span-2 sm:col-span-3">
                    <span className="text-slate-500">Reference / Txn No:</span>{' '}
                    <span className="font-mono font-medium text-slate-800">
                      {viewDetailsInvoice.payments[0].referenceNumber}
                    </span>
                  </div>
                )}
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

            <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-200 shrink-0 flex-wrap">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const inv = viewDetailsInvoice;
                    setViewDetailsInvoice(null);
                    handleOpenEditBill(inv);
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold flex items-center gap-1"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Bill</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const inv = viewDetailsInvoice;
                    setViewDetailsInvoice(null);
                    handleOpenEditPayment(inv);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center gap-1"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Edit Payment</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPrintFormat('thermal-4inch');
                    setPrintModalInvoice(viewDetailsInvoice);
                    setViewDetailsInvoice(null);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print 4" Thermal</span>
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
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: EDIT BILL MODAL                                  */}
      {/* ========================================================= */}
      {editBillInvoice && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3">
          <div className="bg-[#f0f0f0] rounded border border-[#0055ea] shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden">
            {/* Title Bar */}
            <div className="bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] text-white px-3 py-2 flex items-center justify-between select-none">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Edit className="w-4 h-4 text-emerald-300" />
                <span>Edit Bill — Invoice #{editBillInvoice.invoiceNumber}</span>
                <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded font-mono">
                  Status: {editBillInvoice.status}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditBillInvoice(null)}
                className="text-white/80 hover:text-white hover:bg-white/20 rounded p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editBillError && (
              <div className="bg-rose-100 border-b border-rose-300 text-rose-800 px-4 py-2 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editBillError}</span>
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-white text-xs">
              {/* Row 1: Header metadata */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded border border-slate-300">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Invoice Number</label>
                  <input
                    type="text"
                    readOnly
                    value={editBillInvoice.invoiceNumber}
                    className="w-full bg-slate-100 border border-slate-300 rounded px-2 py-1 font-mono font-bold text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Invoice Date & Time</label>
                  <input
                    type="datetime-local"
                    value={editBillDate}
                    onChange={(e) => setEditBillDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Select Customer</label>
                  <select
                    value={editBillCustomerId}
                    onChange={(e) => {
                      const cId = Number(e.target.value);
                      setEditBillCustomerId(cId);
                      const cust = allCustomers.find((c) => c.id === cId);
                      if (cust) {
                        setEditBillCustomerName(cust.name);
                        setEditBillCustomerMobile(cust.mobile || '');
                        setEditBillCustomerGstin('');
                      }
                    }}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800"
                  >
                    {allCustomers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.mobile ? `(${c.mobile})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Customer Mobile</label>
                  <input
                    type="text"
                    value={editBillCustomerMobile}
                    onChange={(e) => setEditBillCustomerMobile(e.target.value)}
                    placeholder="Mobile number"
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono"
                  />
                </div>
              </div>

              {/* Row 2: Items Table */}
              <div className="border border-slate-300 rounded overflow-hidden">
                <div className="bg-[#1f4e79] text-white px-2.5 py-1.5 flex items-center justify-between font-semibold">
                  <span>Bill Items ({editBillItems.length})</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={editBillAddProductId}
                      onChange={(e) => {
                        const pId = Number(e.target.value);
                        if (!pId) return;
                        const prod = allProducts.find((p) => p.id === pId);
                        if (prod) {
                          handleAddProductToEditBill(prod);
                        }
                        setEditBillAddProductId('');
                      }}
                      className="bg-white text-slate-800 text-xs px-2 py-0.5 rounded font-normal"
                    >
                      <option value="">+ Add Product to Bill...</option>
                      {allProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nameEn} ({p.barcode}) - ₹{p.saleRate} [Stock: {p.currentStock}]
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-300">
                      <tr>
                        <th className="p-1.5 w-8 text-center">#</th>
                        <th className="p-1.5">Product Name</th>
                        <th className="p-1.5 text-center w-16">Qty</th>
                        <th className="p-1.5 text-right w-20">MRP (₹)</th>
                        <th className="p-1.5 text-right w-20 font-bold">Rate (₹)</th>
                        <th className="p-1.5 text-center w-14">Disc %</th>
                        <th className="p-1.5 text-center w-14">GST %</th>
                        <th className="p-1.5 text-right w-22">Total (₹)</th>
                        <th className="p-1.5 text-center w-10">Act</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {editBillItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/40">
                          <td className="p-1.5 text-center font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-1.5">
                            <div className="font-medium text-slate-800">{item.productName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{item.barcode}</div>
                          </td>
                          <td className="p-1.5 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateEditBillItemQty(idx, Number(e.target.value))}
                              className="w-14 text-center border border-slate-300 rounded px-1 py-0.5 font-mono text-xs"
                            />
                          </td>
                          <td className="p-1.5 text-right">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.mrp !== undefined ? item.mrp : item.rate}
                              onChange={(e) => handleUpdateEditBillItemMrp(idx, Number(e.target.value))}
                              className="w-16 text-right border border-slate-300 rounded px-1 py-0.5 font-mono text-xs"
                            />
                          </td>
                          <td className="p-1.5 text-right">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.rate}
                              onChange={(e) => handleUpdateEditBillItemRate(idx, Number(e.target.value))}
                              title="Final Price: GST deducted from rate"
                              className="w-18 text-right border border-emerald-300 rounded px-1 py-0.5 font-mono text-xs font-semibold"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discountPercent || 0}
                              onChange={(e) => handleUpdateEditBillItemDisc(idx, Number(e.target.value))}
                              className="w-14 text-center border border-slate-300 rounded px-1 py-0.5 font-mono text-xs"
                            />
                          </td>
                          <td className="p-1.5 text-center font-mono">{item.taxRate}%</td>
                          <td className="p-1.5 text-right font-mono font-bold text-slate-800">
                            ₹{item.lineTotal.toFixed(2)}
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveEditBillItem(idx)}
                              className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Row 3: Discounts, Charges & Payment Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Left: Discounts and Notes */}
                <div className="bg-slate-50 p-2.5 rounded border border-slate-300 space-y-2">
                  <div className="font-semibold text-slate-700 text-xs border-b border-slate-200 pb-1">
                    Discounts & Charges
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-0.5">Bill Discount (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={editBillDiscount}
                        onChange={(e) => setEditBillDiscount(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-0.5">Other Charges (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={editBillOtherCharges}
                        onChange={(e) => setEditBillOtherCharges(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-0.5">Bill Notes / Remarks</label>
                    <textarea
                      rows={2}
                      value={editBillNotes}
                      onChange={(e) => setEditBillNotes(e.target.value)}
                      placeholder="Optional notes or remarks"
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                    />
                  </div>
                </div>

                {/* Right: Payment Method & Payment Editing */}
                <div className="bg-emerald-50/60 p-2.5 rounded border border-emerald-300 space-y-2">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-1">
                    <span className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Payment Settlement</span>
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        editBillAmountPaid >= (editBillCalculated?.grandTotal || 0)
                          ? 'bg-emerald-200 text-emerald-900'
                          : editBillAmountPaid > 0
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-rose-200 text-rose-900'
                      }`}
                    >
                      {editBillAmountPaid >= (editBillCalculated?.grandTotal || 0)
                        ? 'Paid'
                        : editBillAmountPaid > 0
                        ? 'Partial'
                        : 'Unpaid'}
                    </span>
                  </div>

                  {/* Payment Method Selector */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Payment Method:
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
                      {(['Cash', 'UPI', 'Card', 'Bank Transfer', 'Credit'] as const).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setEditBillPaymentMethod(method)}
                          className={`py-1 px-1 rounded text-[11px] font-bold transition-all border text-center ${
                            editBillPaymentMethod === method
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {method === 'Cash' && '💵 '}
                          {method === 'UPI' && '📱 '}
                          {method === 'Card' && '💳 '}
                          {method === 'Bank Transfer' && '🏦 '}
                          {method === 'Credit' && '⏳ '}
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Amount Paid and Quick Buttons */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-700">Amount Tendered / Paid (₹):</label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditBillAmountPaid(editBillCalculated?.grandTotal || 0)}
                          className="text-[10px] bg-emerald-700 hover:bg-emerald-800 text-white px-2 py-0.5 rounded font-bold"
                        >
                          Exact (₹{editBillCalculated?.grandTotal || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditBillAmountPaid(0)}
                          className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-0.5 rounded font-medium"
                        >
                          ₹0 (Due)
                        </button>
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editBillAmountPaid}
                      onChange={(e) => setEditBillAmountPaid(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-white border border-emerald-400 rounded px-2 py-1.5 font-mono font-bold text-sm text-emerald-900"
                    />
                  </div>

                  {/* Reference Number */}
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-0.5">
                      Reference / Transaction No. (UPI ID / Cheque / Card Slip):
                    </label>
                    <input
                      type="text"
                      value={editBillRefNumber}
                      onChange={(e) => setEditBillRefNumber(e.target.value)}
                      placeholder={editBillPaymentMethod === 'Cash' ? 'CASH-COUNTER' : 'e.g. UPI-92837482'}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: Totals Summary Strip */}
              {editBillCalculated && (
                <div className="bg-slate-100 p-2.5 rounded border border-slate-300 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-slate-500">Gross:</span>{' '}
                      <strong className="font-mono">₹{editBillCalculated.grossAmount.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Taxable:</span>{' '}
                      <strong className="font-mono">₹{editBillCalculated.taxableAmount.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">GST:</span>{' '}
                      <strong className="font-mono">₹{editBillCalculated.totalTaxAmount.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Roundoff:</span>{' '}
                      <span className="font-mono">
                        {editBillCalculated.roundOff >= 0
                          ? `+₹${editBillCalculated.roundOff.toFixed(2)}`
                          : `-₹${Math.abs(editBillCalculated.roundOff).toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-slate-600 font-semibold">Grand Total:</span>{' '}
                      <span className="font-mono font-bold text-base text-[#106ebe]">
                        ₹{editBillCalculated.grandTotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-right border-l border-slate-300 pl-4">
                      <span className="text-slate-600 font-semibold">Balance Due:</span>{' '}
                      <span
                        className={`font-mono font-bold text-sm ${
                          editBillCalculated.balanceDue > 0 ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        ₹{editBillCalculated.balanceDue.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-[#e5e5e5] border-t border-[#d0d0d0] px-3 py-2 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  setCartItems(editBillItems);
                  setSelectedCustomerId(editBillCustomerId);
                  setBillDiscount(editBillDiscount);
                  setOtherCharges(editBillOtherCharges);
                  setPaymentMethod(editBillPaymentMethod);
                  setTenderedAmount(editBillAmountPaid);
                  setEditBillInvoice(null);
                  setActiveSubTab('pos');
                  setAlertMessage({
                    type: 'info' as any,
                    text: `Loaded Bill #${editBillInvoice.invoiceNumber} into POS register screen.`,
                  });
                  setTimeout(() => setAlertMessage(null), 3000);
                }}
                className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded font-semibold text-xs flex items-center gap-1.5 border border-blue-300"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Open in POS Counter</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditBillInvoice(null)}
                  className="px-4 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded font-medium text-xs text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditBill}
                  className="px-5 py-1.5 bg-[#1b5e20] hover:bg-[#2e7d32] text-white rounded font-bold text-xs shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save Bill Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 6: EDIT PAYMENT MODAL                               */}
      {/* ========================================================= */}
      {editPaymentInvoice && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3">
          <div className="bg-[#f0f0f0] rounded border border-[#0055ea] shadow-2xl max-w-lg w-full flex flex-col overflow-hidden">
            {/* Title Bar */}
            <div className="bg-gradient-to-r from-[#0055ea] to-[#106ebe] text-white px-3 py-2 flex items-center justify-between select-none">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CreditCard className="w-4 h-4 text-cyan-200" />
                <span>Edit Payment — Invoice #{editPaymentInvoice.invoiceNumber}</span>
              </div>
              <button
                type="button"
                onClick={() => setEditPaymentInvoice(null)}
                className="text-white/80 hover:text-white hover:bg-white/20 rounded p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editPayError && (
              <div className="bg-rose-100 border-b border-rose-300 text-rose-800 px-4 py-2 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editPayError}</span>
              </div>
            )}

            {/* Body */}
            <div className="p-4 space-y-3 bg-white text-xs">
              {/* Bill Summary */}
              <div className="bg-slate-50 p-3 rounded border border-slate-200 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Customer:</span>{' '}
                  <strong>{editPaymentInvoice.customerName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Bill Date:</span>{' '}
                  <span className="font-mono">{new Date(editPaymentInvoice.invoiceDate).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-slate-500">Bill Total:</span>{' '}
                  <strong className="font-mono text-blue-900 text-sm">
                    ₹{editPaymentInvoice.grandTotal.toFixed(2)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Current Status:</span>{' '}
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      editPaymentInvoice.paymentStatus === 'Paid'
                        ? 'bg-emerald-100 text-emerald-800'
                        : editPaymentInvoice.paymentStatus === 'Partial'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {editPaymentInvoice.paymentStatus}
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  Select Payment Method:
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {(['Cash', 'UPI', 'Card', 'Bank Transfer', 'Credit'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setEditPayMethod(method)}
                      className={`py-1.5 px-2 rounded text-xs font-bold transition-all border text-center flex flex-col items-center gap-0.5 ${
                        editPayMethod === method
                          ? 'bg-[#106ebe] text-white border-[#005a9e] shadow-xs ring-2 ring-blue-300'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-sm">
                        {method === 'Cash' && '💵'}
                        {method === 'UPI' && '📱'}
                        {method === 'Card' && '💳'}
                        {method === 'Bank Transfer' && '🏦'}
                        {method === 'Credit' && '⏳'}
                      </span>
                      <span className="text-[10px]">{method}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Paid */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700">Amount Paid (₹):</label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditPayAmount(editPaymentInvoice.grandTotal)}
                      className="text-[10px] bg-emerald-700 hover:bg-emerald-800 text-white px-2 py-0.5 rounded font-bold"
                    >
                      Mark Full (₹{editPaymentInvoice.grandTotal})
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditPayAmount(0)}
                      className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-0.5 rounded font-medium"
                    >
                      ₹0 (Credit/Due)
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editPayAmount}
                  onChange={(e) => setEditPayAmount(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-white border border-blue-400 rounded px-2.5 py-1.5 font-mono font-bold text-base text-slate-900"
                />
              </div>

              {/* Dynamic Balance / Change preview */}
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-500">Balance Due:</span>{' '}
                  <strong
                    className={`font-mono text-sm ${
                      editPayAmount < editPaymentInvoice.grandTotal ? 'text-amber-700' : 'text-emerald-700'
                    }`}
                  >
                    ₹{Math.max(0, editPaymentInvoice.grandTotal - editPayAmount).toFixed(2)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Resulting Status:</span>{' '}
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      editPayAmount >= editPaymentInvoice.grandTotal
                        ? 'bg-emerald-100 text-emerald-800'
                        : editPayAmount > 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {editPayAmount >= editPaymentInvoice.grandTotal
                      ? 'Paid'
                      : editPayAmount > 0
                      ? 'Partial'
                      : 'Unpaid'}
                  </span>
                </div>
              </div>

              {/* Reference Number */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Payment Reference / Transaction ID:
                </label>
                <input
                  type="text"
                  value={editPayRefNumber}
                  onChange={(e) => setEditPayRefNumber(e.target.value)}
                  placeholder={
                    editPayMethod === 'Cash'
                      ? 'CASH-COUNTER'
                      : editPayMethod === 'UPI'
                      ? 'e.g. UPI-9830219482'
                      : editPayMethod === 'Card'
                      ? 'Card last 4 digits / Auth Code'
                      : 'Cheque No. / NEFT Ref'
                  }
                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono text-xs"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Payment Notes / Remarks:
                </label>
                <input
                  type="text"
                  value={editPayNotes}
                  onChange={(e) => setEditPayNotes(e.target.value)}
                  placeholder="e.g. Received via GPay from customer"
                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-[#e5e5e5] border-t border-[#d0d0d0] px-3 py-2 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditPaymentInvoice(null)}
                className="px-4 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded font-medium text-xs text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditPayment}
                className="px-5 py-1.5 bg-[#106ebe] hover:bg-[#005a9e] text-white rounded font-bold text-xs shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Save Payment</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
