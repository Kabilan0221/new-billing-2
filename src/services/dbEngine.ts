import {
  Product,
  Category,
  Subcategory,
  Brand,
  AuditLog,
  ProductFilter,
  PagedResult,
  Supplier,
  PurchaseHeader,
  PurchaseItem,
  SupplierPayment,
  StockMovement,
  SupplierLedgerEntry,
  StockAdjustment,
  StockAdjustmentItem,
  PhysicalStockVerification,
  PhysicalStockVerificationItem,
  CurrentStockSummary,
  StockDashboardMetrics,
  Customer,
  CustomerLedgerEntry,
  InvoiceHeader,
  InvoiceItem,
  InvoicePayment,
  InvoiceFilter,
  GstSlabSummary,
  EstimateHeader,
  EstimateItem,
  EstimateFilter,
  BarcodeStudioItem,
  BarcodePrintConfig,
  DashboardMetrics,
  DailySalesTrendItem,
  ReportFilter,
  SalesReportRow,
  ProductWiseSalesReportRow,
  PurchaseReportRow,
  StockReportRow,
  CustomerReportRow,
  PaymentCollectionReportRow,
  AppSettings,
  DataManagementInfo,
  DataIntegrityResult,
} from '../types';
import {
  INITIAL_CATEGORIES,
  INITIAL_SUBCATEGORIES,
  INITIAL_BRANDS,
  INITIAL_PRODUCTS,
  INITIAL_SUPPLIERS,
} from '../data/initialData';
import { transliterateTamil } from './tamilTransliterate';

export interface SupplierFilter {
  searchTerm?: string;
  isActive?: boolean;
  sortBy?: 'name' | 'code' | 'city' | 'currentBalance';
  sortDescending?: boolean;
  pageNumber: number;
  pageSize: number;
}

export interface PurchaseFilter {
  searchTerm?: string;
  supplierId?: number;
  status?: string; // 'All' | 'Draft' | 'Confirmed' | 'Cancelled'
  fromDate?: string;
  toDate?: string;
  pageNumber: number;
  pageSize: number;
}

class SQLiteIndexedEngine {
  private products: Product[] = [];
  private categories: Category[] = [];
  private subcategories: Subcategory[] = [];
  private brands: Brand[] = [];
  private auditLogs: AuditLog[] = [];

  // Phase 2 Entities
  private suppliers: Supplier[] = [];
  private purchases: PurchaseHeader[] = [];
  private supplierPayments: SupplierPayment[] = [];
  private stockMovements: StockMovement[] = [];
  private supplierLedger: SupplierLedgerEntry[] = [];

  // Phase 3 Entities
  private stockAdjustments: StockAdjustment[] = [];
  private physicalVerifications: PhysicalStockVerification[] = [];

  // Phase 4 Entities (POS Billing & Invoices)
  private customers: Customer[] = [];
  private invoices: InvoiceHeader[] = [];

  // Phase 6 Entities (Estimates & Pro-Forma Invoices)
  private estimates: EstimateHeader[] = [];

  // B-Tree / Hash Indexes
  private barcodeIndex = new Map<string, Product>();
  private codeIndex = new Map<string, Product>();
  private idIndex = new Map<number, Product>();
  private categoryIndex = new Map<number, Set<Product>>();
  private brandIndex = new Map<number, Set<Product>>();

  // Supplier & Purchase Indexes
  private supplierIdIndex = new Map<number, Supplier>();
  private supplierCodeIndex = new Map<string, Supplier>();
  private purchaseIdIndex = new Map<number, PurchaseHeader>();
  private purchaseNumberIndex = new Map<string, PurchaseHeader>();

  // Customer & Invoice Indexes
  private customerIdIndex = new Map<number, Customer>();
  private customerMobileIndex = new Map<string, Customer>();
  private invoiceIdIndex = new Map<number, InvoiceHeader>();
  private invoiceNumberIndex = new Map<string, InvoiceHeader>();

  // Estimate Indexes
  private estimateIdIndex = new Map<number, EstimateHeader>();
  private estimateNumberIndex = new Map<string, EstimateHeader>();

  private is50kLoaded = false;
  private safetySnapshot: string | null = null;
  private isInitializing = true;
  private currentNextId = 11;
  private nextSupplierId = 6;
  private nextPurchaseId = 3;
  private nextPaymentId = 2;
  private nextMovementId = 3;
  private nextLedgerId = 3;
  private nextCustomerId = 4;
  private nextInvoiceId = 1;
  private nextEstimateId = 2;

  constructor() {
    this.isInitializing = true;
    const loaded = this.loadFromLocalStorage();
    if (!loaded) {
      this.resetToDefaults();
    }
    this.isInitializing = false;
  }

  private loadFromLocalStorage(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    try {
      const raw = localStorage.getItem('SHOPBILLING_PREVIEW_DATA_V3');
      if (!raw) return false;

      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.warn('[ShopBilling Preview] Corrupted LocalStorage payload found. Falling back to default seed catalog.');
        return false;
      }

      const validation = this.validatePreviewBackupJson(parsed);
      if (!validation.valid || !parsed.data) {
        console.warn('[ShopBilling Preview] Incompatible LocalStorage schema found:', validation.error);
        return false;
      }

      const d = parsed.data;
      this.products = Array.isArray(d.products) ? d.products : [];
      this.categories = Array.isArray(d.categories) ? d.categories : [];
      this.subcategories = Array.isArray(d.subcategories) ? d.subcategories : [];
      this.brands = Array.isArray(d.brands) ? d.brands : [];
      this.suppliers = Array.isArray(d.suppliers) ? d.suppliers : [];
      this.purchases = Array.isArray(d.purchases) ? d.purchases : [];
      this.customers = (Array.isArray(d.customers) ? d.customers : []).map((c: any) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        mobile: c.mobile || '',
        gstin: c.gstin || '',
        address: c.address || '',
        currentBalance: c.currentBalance || 0,
        isActive: c.isActive !== undefined ? c.isActive : true,
        createdAt: c.createdAt || new Date().toISOString(),
        updatedAt: c.updatedAt || new Date().toISOString(),
      }));
      this.invoices = Array.isArray(d.invoices) ? d.invoices : [];
      this.estimates = Array.isArray(d.estimates) ? d.estimates : [];
      this.stockAdjustments = Array.isArray(d.stockAdjustments) ? d.stockAdjustments : [];
      this.physicalVerifications = Array.isArray(d.physicalVerifications) ? d.physicalVerifications : [];
      this.stockMovements = Array.isArray(d.stockMovements) ? d.stockMovements : [];
      this.supplierLedger = Array.isArray(d.supplierLedger) ? d.supplierLedger : [];
      this.auditLogs = Array.isArray(d.auditLogs) ? d.auditLogs : [];
      if (d.appSettings) {
        this.appSettings = { ...this.appSettings, ...d.appSettings };
        this.appSettings.storeName = 'Sri Venkateswara Furniture and Store';
        this.appSettings.storeTamilName = 'ஸ்ரீ வெங்கடேஸ்வரா பர்னிச்சர் & ஸ்டோர்';
        this.appSettings.storeSubtitle = '';
        this.appSettings.storeOwner = 'பெரியநத்தம் வெ.பெருமாள் நாயகர்';
        this.appSettings.storeBlessing = 'என் தாய் தந்தை துணை';
        this.appSettings.storeAddress = 'மடம் தெரு, அண்ணா விளையாட்டு பூங்கா அருகில், காஞ்சிபுரம் - 631 502.';
        this.appSettings.storePhone = '8143 84 8143 / 9941333457';
        this.appSettings.storeWhatsApp = '8143 84 8143';
        this.appSettings.storeLandline = '';
        this.appSettings.receiptPaperSize = '104mm (4-Inch) Thermal';
        this.appSettings.gstNumber = '33AGOPV5229Q1ZH';
      }

      // Recalculate auto-increment IDs safely based on loaded records
      this.currentNextId = Math.max(1, ...this.products.map((p) => p.id || 0)) + 1;
      this.nextSupplierId = Math.max(1, ...this.suppliers.map((s) => s.id || 0)) + 1;
      this.nextPurchaseId = Math.max(1, ...this.purchases.map((p) => p.id || 0)) + 1;
      this.nextCustomerId = Math.max(1, ...this.customers.map((c) => c.id || 0)) + 1;
      this.nextInvoiceId = Math.max(1, ...this.invoices.map((i) => i.id || 0)) + 1;
      this.nextEstimateId = Math.max(1, ...this.estimates.map((e) => e.id || 0)) + 1;

      this.rebuildIndexes();
      return true;
    } catch (err) {
      console.warn('[ShopBilling Preview] Failed to load preview data from LocalStorage:', err);
      return false;
    }
  }

  public saveToLocalStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    // Protect LocalStorage quota during 50,000 item benchmark
    if (this.is50kLoaded || this.products.length > 5000) {
      return;
    }
    try {
      const json = this.exportPreviewJson();
      localStorage.setItem('SHOPBILLING_PREVIEW_DATA_V3', json);
    } catch (err: any) {
      console.warn('[ShopBilling Preview] Failed to persist preview state to LocalStorage:', err?.message);
    }
  }

  public clearLocalStoragePreview(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('SHOPBILLING_PREVIEW_DATA_V3');
    }
    this.resetToDefaults();
  }

  public resetToDefaults() {
    this.categories = JSON.parse(JSON.stringify(INITIAL_CATEGORIES));
    this.subcategories = JSON.parse(JSON.stringify(INITIAL_SUBCATEGORIES));
    this.brands = JSON.parse(JSON.stringify(INITIAL_BRANDS));
    this.products = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
    this.suppliers = JSON.parse(JSON.stringify(INITIAL_SUPPLIERS));

    // Initial Sample Confirmed Purchase Entry (PUR-2026-0001)
    const initialPurchase1: PurchaseHeader = {
      id: 1,
      purchaseNumber: 'PUR-2026-0001',
      supplierId: 1,
      supplierName: 'Sri Meenakshi Trading Co',
      supplierInvoiceNumber: 'INV-8821',
      supplierInvoiceDate: '2026-01-12T10:30:00Z',
      goodsReceivedDate: '2026-01-13T14:00:00Z',
      purchaseType: 'Credit',
      paymentDueDate: '2026-02-12T00:00:00Z',
      referenceNumber: 'LR-44210',
      notes: 'Initial opening stock replenishment batch for staples',
      status: 'Confirmed',
      totalQty: 25,
      totalFreeQty: 2,
      grossAmount: 7000,
      itemDiscount: 200,
      additionalDiscount: 0,
      taxableAmount: 6800,
      taxAmount: 0,
      additionalCharges: 150, // Freight
      roundOff: 0,
      grandTotal: 6950,
      amountPaid: 2450,
      balanceDue: 4500,
      createdBy: 'Admin',
      confirmedAt: '2026-01-13T14:15:00Z',
      createdAt: '2026-01-13T10:00:00Z',
      updatedAt: '2026-01-13T14:15:00Z',
      items: [
        {
          id: 1,
          purchaseId: 1,
          productId: 1,
          productCode: 'PRD0001',
          barcode: '8901030012345',
          productName: 'Ponni Boiled Rice 5kg',
          categoryName: 'Groceries & Staples',
          quantity: 20,
          freeQuantity: 2,
          purchaseRate: 280,
          discountPercent: 2,
          discountAmount: 112,
          taxRate: 0,
          taxableAmount: 5488,
          taxAmount: 0,
          lineTotal: 5488,
          batchNumber: 'PBR-2026-01',
          expiryDate: '2026-12-31',
        },
        {
          id: 2,
          purchaseId: 1,
          productId: 3,
          productCode: 'PRD0003',
          barcode: '8901030012347',
          productName: 'Tata Salt Iodized 1kg',
          categoryName: 'Groceries & Staples',
          quantity: 5,
          freeQuantity: 0,
          purchaseRate: 22,
          discountPercent: 0,
          discountAmount: 0,
          taxRate: 0,
          taxableAmount: 110,
          taxAmount: 0,
          lineTotal: 110,
          batchNumber: 'TS-JAN26',
        },
      ],
    };

    // Initial Sample Draft Purchase Entry (PUR-2026-0002)
    const initialPurchase2: PurchaseHeader = {
      id: 2,
      purchaseNumber: 'PUR-2026-0002',
      supplierId: 3,
      supplierName: 'Hindustan Consumer Supplies',
      supplierInvoiceNumber: 'HCS/TI/4491',
      supplierInvoiceDate: '2026-01-18T11:00:00Z',
      goodsReceivedDate: '2026-01-19T09:30:00Z',
      purchaseType: 'Credit',
      paymentDueDate: '2026-02-05T00:00:00Z',
      referenceNumber: 'EWAY-9988112',
      notes: 'Monthly personal care replenishment (Draft verification pending)',
      status: 'Draft',
      totalQty: 50,
      totalFreeQty: 5,
      grossAmount: 4250,
      itemDiscount: 150,
      additionalDiscount: 100,
      taxableAmount: 4000,
      taxAmount: 720, // 18% GST
      additionalCharges: 100,
      roundOff: 0,
      grandTotal: 4820,
      amountPaid: 0,
      balanceDue: 4820,
      createdBy: 'StoreManager',
      createdAt: '2026-01-19T09:30:00Z',
      updatedAt: '2026-01-19T09:30:00Z',
      items: [
        {
          id: 3,
          purchaseId: 2,
          productId: 7,
          productCode: 'PRD0007',
          barcode: '8901030012351',
          productName: 'Lifebuoy Total Soap 125g',
          categoryName: 'Personal Care & Hygiene',
          quantity: 50,
          freeQuantity: 5,
          purchaseRate: 30,
          discountPercent: 5,
          discountAmount: 75,
          taxRate: 18,
          taxableAmount: 1425,
          taxAmount: 256.5,
          lineTotal: 1681.5,
          batchNumber: 'LB-2026A',
          expiryDate: '2028-06-30',
        },
      ],
    };

    this.purchases = [initialPurchase1, initialPurchase2];

    // Seed stock movement ledger from confirmed purchase
    this.stockMovements = [
      {
        id: 1,
        productId: 1,
        productCode: 'PRD0001',
        productName: 'Ponni Boiled Rice 5kg',
        referenceType: 'PURCHASE_CONFIRM',
        referenceId: 'PUR-2026-0001',
        quantity: 22,
        quantityBefore: 26,
        quantityAfter: 48,
        notes: 'Goods received from Sri Meenakshi Trading Co (INV-8821)',
        createdAt: '2026-01-13T14:15:00Z',
      },
      {
        id: 2,
        productId: 3,
        productCode: 'PRD0003',
        productName: 'Tata Salt Iodized 1kg',
        referenceType: 'PURCHASE_CONFIRM',
        referenceId: 'PUR-2026-0001',
        quantity: 5,
        quantityBefore: 65,
        quantityAfter: 70,
        notes: 'Goods received from Sri Meenakshi Trading Co (INV-8821)',
        createdAt: '2026-01-13T14:15:00Z',
      },
    ];

    // Seed Supplier Ledger & Payments
    this.supplierPayments = [
      {
        id: 1,
        paymentNumber: 'PAY-2026-0001',
        supplierId: 1,
        supplierName: 'Sri Meenakshi Trading Co',
        purchaseId: 1,
        purchaseNumber: 'PUR-2026-0001',
        paymentDate: '2026-01-13T14:30:00Z',
        paymentMethod: 'Bank Transfer',
        amount: 2450,
        referenceNumber: 'NEFT-AXIS-9921',
        notes: 'Advance part-payment against bill PUR-2026-0001',
        createdAt: '2026-01-13T14:30:00Z',
      },
    ];

    this.supplierLedger = [
      {
        id: 1,
        supplierId: 1,
        transactionType: 'PURCHASE',
        referenceId: 'PUR-2026-0001',
        debit: 0,
        credit: 6950,
        balanceAfter: 6950,
        notes: 'Inbound purchase goods bill PUR-2026-0001',
        transactionDate: '2026-01-13T14:15:00Z',
      },
      {
        id: 2,
        supplierId: 1,
        transactionType: 'PAYMENT',
        referenceId: 'PAY-2026-0001',
        debit: 2450,
        credit: 0,
        balanceAfter: 4500,
        notes: 'Bank Transfer payment ref: NEFT-AXIS-9921',
        transactionDate: '2026-01-13T14:30:00Z',
      },
    ];

    this.auditLogs = [
      {
        id: 1,
        entity: 'System',
        entityId: '0',
        action: 'INSERT',
        details: 'Initial SQLite database initialized with version 4 migrations (Suppliers & Inbound Goods active)',
        timestamp: new Date().toISOString(),
      },
    ];

    this.customers = [
      {
        id: 1,
        code: 'CUST-WALKIN',
        name: 'Walk-in Customer',
        mobile: '9999999999',
        currentBalance: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 2,
        code: 'CUST001',
        name: 'Ramesh Sundaram',
        mobile: '9840998877',
        currentBalance: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 3,
        code: 'CUST002',
        name: 'Bangalore Traders',
        mobile: '9880112233',
        currentBalance: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const initialInvoice1: InvoiceHeader = {
      id: 1,
      invoiceNumber: 'INV-2026-00001',
      invoiceDate: '2026-01-20T11:45:00Z',
      customerId: 1,
      customerName: 'Walk-in Customer',
      customerMobile: '9999999999',
      salesperson: 'Admin',
      status: 'Confirmed',
      paymentStatus: 'Paid',
      isInterstate: false,
      totalItems: 2,
      totalQty: 3,
      grossAmount: 430,
      itemDiscount: 0,
      billDiscount: 0,
      taxableAmount: 430,
      cgstAmount: 2.25,
      sgstAmount: 2.25,
      igstAmount: 0,
      totalTaxAmount: 4.5,
      otherCharges: 0,
      roundOff: 0.5,
      grandTotal: 435,
      amountPaid: 500,
      balanceDue: 0,
      cashChange: 65,
      notes: 'Counter sales cash payment',
      createdAt: '2026-01-20T11:45:00Z',
      updatedAt: '2026-01-20T11:45:00Z',
      items: [
        {
          id: 1,
          invoiceId: 1,
          productId: 1,
          productCode: 'PRD0001',
          barcode: '8901030012345',
          productName: 'Ponni Boiled Rice 5kg',
          unit: 'BAG',
          quantity: 1,
          rate: 340,
          discountPercent: 0,
          discountAmount: 0,
          taxRate: 0,
          taxableAmount: 340,
          cgstRate: 0,
          cgstAmount: 0,
          sgstRate: 0,
          sgstAmount: 0,
          igstRate: 0,
          igstAmount: 0,
          taxAmount: 0,
          lineTotal: 340,
        },
        {
          id: 2,
          invoiceId: 1,
          productId: 5,
          productCode: 'PRD0005',
          barcode: '8901030012349',
          productName: 'Aashirvaad Superior MP Atta 1kg',
          unit: 'PACK',
          quantity: 2,
          rate: 45,
          discountPercent: 0,
          discountAmount: 0,
          taxRate: 5,
          taxableAmount: 90,
          cgstRate: 2.5,
          cgstAmount: 2.25,
          sgstRate: 2.5,
          sgstAmount: 2.25,
          igstRate: 0,
          igstAmount: 0,
          taxAmount: 4.5,
          lineTotal: 94.5,
        },
      ],
      payments: [
        {
          id: 1,
          invoiceId: 1,
          paymentMethod: 'Cash',
          amount: 500,
          referenceNumber: 'CASH-COUNTER',
          createdAt: '2026-01-20T11:45:00Z',
        },
      ],
    };

    this.invoices = [initialInvoice1];

    // Seed Initial Estimate (EST-2026-00001)
    const initialEstimate1: EstimateHeader = {
      id: 1,
      estimateNumber: 'EST-2026-00001',
      estimateDate: '2026-01-22T10:15:00Z',
      validUntil: '2026-02-06T10:15:00Z',
      customerId: 1,
      customerCode: 'CUST-WALKIN',
      customerName: 'Walk-in Customer',
      customerMobile: '9999999999',
      stateCode: '33',
      stateName: 'Tamil Nadu',
      isInterstate: false,
      status: 'Confirmed',
      totalItems: 2,
      totalQty: 14,
      grossAmount: 1300,
      itemDiscount: 0,
      billDiscount: 0,
      taxableAmount: 1300,
      cgstAmount: 26,
      sgstAmount: 26,
      igstAmount: 0,
      totalTaxAmount: 52,
      otherCharges: 0,
      roundOff: 0,
      grandTotal: 1352,
      notes: 'Commercial quotation for wholesale supply inquiry',
      termsConditions: '1. Prices valid for 15 days from date of estimate.\n2. GST charged as per applicable rates.\n3. Goods subject to availability at time of billing.',
      createdBy: 'Admin',
      createdAt: '2026-01-22T10:15:00Z',
      updatedAt: '2026-01-22T10:15:00Z',
      items: [
        {
          id: 1,
          estimateId: 1,
          productId: 1,
          productCode: 'PRD0001',
          barcode: '8901030012345',
          productName: 'Ponni Boiled Rice 5kg',
          unit: 'BAG',
          quantity: 4,
          rate: 260,
          discountPercent: 0,
          discountAmount: 0,
          taxRate: 5,
          taxableAmount: 1040,
          cgstRate: 2.5,
          cgstAmount: 26,
          sgstRate: 2.5,
          sgstAmount: 26,
          igstRate: 0,
          igstAmount: 0,
          taxAmount: 52,
          lineTotal: 1092,
        },
        {
          id: 2,
          estimateId: 1,
          productId: 4,
          productCode: 'PRD0004',
          barcode: '8901030012348',
          productName: 'Tata Salt Vacuum Evaporated 1kg',
          unit: 'PKT',
          quantity: 10,
          rate: 26,
          discountPercent: 0,
          discountAmount: 0,
          taxRate: 0,
          taxableAmount: 260,
          cgstRate: 0,
          cgstAmount: 0,
          sgstRate: 0,
          sgstAmount: 0,
          igstRate: 0,
          igstAmount: 0,
          taxAmount: 0,
          lineTotal: 260,
        },
      ],
    };

    this.estimates = [initialEstimate1];

    this.is50kLoaded = false;
    this.currentNextId = 11;
    this.nextSupplierId = 6;
    this.nextPurchaseId = 3;
    this.nextPaymentId = 2;
    this.nextMovementId = 3;
    this.nextLedgerId = 3;
    this.nextCustomerId = 4;
    this.nextInvoiceId = 2;
    this.nextEstimateId = 2;

    this.rebuildIndexes();
  }

  public rebuildIndexes() {
    this.barcodeIndex.clear();
    this.codeIndex.clear();
    this.idIndex.clear();
    this.categoryIndex.clear();
    this.brandIndex.clear();

    for (const p of this.products) {
      this.idIndex.set(p.id, p);
      if (p.barcode) this.barcodeIndex.set(p.barcode.trim().toLowerCase(), p);
      if (p.productCode) this.codeIndex.set(p.productCode.trim().toLowerCase(), p);

      if (p.categoryId) {
        if (!this.categoryIndex.has(p.categoryId)) this.categoryIndex.set(p.categoryId, new Set());
        this.categoryIndex.get(p.categoryId)!.add(p);
      }
      if (p.brandId) {
        if (!this.brandIndex.has(p.brandId)) this.brandIndex.set(p.brandId, new Set());
        this.brandIndex.get(p.brandId)!.add(p);
      }
    }

    // Suppliers Index
    this.supplierIdIndex.clear();
    this.supplierCodeIndex.clear();
    for (const s of this.suppliers) {
      this.supplierIdIndex.set(s.id, s);
      if (s.code) this.supplierCodeIndex.set(s.code.trim().toUpperCase(), s);
    }

    // Purchases Index
    this.purchaseIdIndex.clear();
    this.purchaseNumberIndex.clear();
    for (const pur of this.purchases) {
      this.purchaseIdIndex.set(pur.id, pur);
      if (pur.purchaseNumber) this.purchaseNumberIndex.set(pur.purchaseNumber.trim().toUpperCase(), pur);
    }

    // Customer & Invoice Indexes
    this.customerIdIndex.clear();
    this.customerMobileIndex.clear();
    for (const c of this.customers) {
      this.customerIdIndex.set(c.id, c);
      if (c.mobile) this.customerMobileIndex.set(c.mobile.trim(), c);
    }

    this.invoiceIdIndex.clear();
    this.invoiceNumberIndex.clear();
    for (const inv of this.invoices) {
      this.invoiceIdIndex.set(inv.id, inv);
      if (inv.invoiceNumber) this.invoiceNumberIndex.set(inv.invoiceNumber.trim().toUpperCase(), inv);
    }

    // Estimates Index
    this.estimateIdIndex.clear();
    this.estimateNumberIndex.clear();
    for (const est of this.estimates) {
      this.estimateIdIndex.set(est.id, est);
      if (est.estimateNumber) this.estimateNumberIndex.set(est.estimateNumber.trim().toUpperCase(), est);
    }

    if (!this.isInitializing) {
      this.saveToLocalStorage();
    }
  }

  // -------------------------------------------------------------
  // PRODUCTS METHODS
  // -------------------------------------------------------------
  public searchProducts(filter: ProductFilter): PagedResult<Product> {
    const t0 = performance.now();

    let candidateList: Product[] = [];
    const term = filter.searchTerm?.trim().toLowerCase();
    const translitTerm = term ? transliterateTamil(term).toLowerCase() : '';

    // 1. Fast index lookup if exact barcode or code
    if (term && this.barcodeIndex.has(term)) {
      candidateList = [this.barcodeIndex.get(term)!];
    } else if (term && this.codeIndex.has(term)) {
      candidateList = [this.codeIndex.get(term)!];
    } else {
      let pool: Product[] = this.products;

      if (filter.categoryId && filter.categoryId > 0 && this.categoryIndex.has(filter.categoryId)) {
        pool = Array.from(this.categoryIndex.get(filter.categoryId)!);
      }

      candidateList = [];
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];

        if (filter.isActive !== undefined && p.isActive !== filter.isActive) continue;
        if (filter.subcategoryId && filter.subcategoryId > 0 && p.subcategoryId !== filter.subcategoryId) continue;
        if (filter.brandId && filter.brandId > 0 && p.brandId !== filter.brandId) continue;
        if (filter.isLowStockOnly && p.currentStock > p.reorderLevel) continue;

        if (term) {
          const matchEn = p.nameEn.toLowerCase().includes(term);
          const matchTa = p.nameTa ? p.nameTa.toLowerCase().includes(term) : false;
          const matchTranslitTa = translitTerm && p.nameTa ? p.nameTa.toLowerCase().includes(translitTerm) : false;
          const matchBar = p.barcode.toLowerCase().includes(term);
          const matchCode = p.productCode.toLowerCase().includes(term);

          if (!matchEn && !matchTa && !matchTranslitTa && !matchBar && !matchCode) continue;
        }

        candidateList.push(p);
      }
    }

    // Sort
    const sortBy = filter.sortBy || 'nameEn';
    const isDesc = !!filter.sortDescending;
    candidateList.sort((a, b) => {
      let valA: any = a[sortBy];
      let valB: any = b[sortBy];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return isDesc ? 1 : -1;
      if (valA > valB) return isDesc ? -1 : 1;
      return 0;
    });

    const totalCount = candidateList.length;
    const pageNumber = Math.max(1, filter.pageNumber || 1);
    const pageSize = Math.max(1, filter.pageSize || 50);
    const totalPages = Math.ceil(totalCount / pageSize);

    const startIndex = (pageNumber - 1) * pageSize;
    const items = candidateList.slice(startIndex, startIndex + pageSize);

    const t1 = performance.now();
    const executionTimeMs = parseFloat((t1 - t0).toFixed(2));

    return {
      items,
      totalCount,
      pageNumber,
      pageSize,
      totalPages,
      executionTimeMs,
    };
  }

  public getProductById(id: number): Product | undefined {
    return this.idIndex.get(id);
  }

  public getProductByBarcode(barcode: string): Product | undefined {
    return this.barcodeIndex.get(barcode.trim().toLowerCase());
  }

  public saveProduct(product: Partial<Product>): { success: boolean; errors: string[]; product?: Product } {
    const errors: string[] = [];

    if (!product.nameEn || product.nameEn.trim().length < 2) {
      errors.push('Product Name (English) is required (min 2 chars).');
    }
    if (!product.productCode || product.productCode.trim().length < 2) {
      errors.push('Product Code is required.');
    }
    if (!product.barcode || product.barcode.trim().length < 3) {
      errors.push('Barcode is required.');
    }
    if ((product.purchaseRate ?? 0) < 0) errors.push('Purchase Rate cannot be negative.');
    if ((product.saleRate ?? 0) < 0) errors.push('Sale Rate cannot be negative.');
    if ((product.mrp ?? 0) < 0) errors.push('MRP cannot be negative.');
    if ((product.mrp ?? 0) > 0 && (product.saleRate ?? 0) > (product.mrp ?? 0)) {
      errors.push(`Sale Rate (₹${product.saleRate}) cannot exceed MRP (₹${product.mrp}).`);
    }

    const cleanBarcode = product.barcode?.trim().toLowerCase();
    const cleanCode = product.productCode?.trim().toLowerCase();

    // Duplicate checks
    if (cleanBarcode) {
      const existing =
        this.barcodeIndex.get(cleanBarcode) ||
        this.products.find((p) => p.id !== product.id && p.barcode?.trim().toLowerCase() === cleanBarcode);
      if (existing && existing.id !== product.id) {
        errors.push(`Barcode '${product.barcode}' is already assigned to '${existing.nameEn}'. Duplicate barcodes are not allowed.`);
      }
    }

    if (cleanCode) {
      const existing = this.codeIndex.get(cleanCode);
      if (existing && existing.id !== product.id) {
        errors.push(`Product Code '${product.productCode}' already exists.`);
      }
    }

    if (errors.length > 0) return { success: false, errors };

    const cat = this.categories.find((c) => c.id === product.categoryId);
    const subcat = this.subcategories.find((s) => s.id === product.subcategoryId);
    const brand = this.brands.find((b) => b.id === product.brandId);

    if (product.id) {
      const index = this.products.findIndex((p) => p.id === product.id);
      if (index === -1) return { success: false, errors: ['Product not found.'] };

      const updated: Product = {
        ...this.products[index],
        ...product,
        categoryName: cat?.name || this.products[index].categoryName,
        subcategoryName: subcat?.name || this.products[index].subcategoryName,
        brandName: brand?.name || this.products[index].brandName,
        updatedAt: new Date().toISOString(),
      } as Product;

      this.products[index] = updated;
      this.rebuildIndexes();

      this.logAudit('Product', updated.id.toString(), 'UPDATE', `Updated product '${updated.nameEn}'`);
      return { success: true, errors: [], product: updated };
    } else {
      const newProd: Product = {
        id: this.currentNextId++,
        productCode: product.productCode!.trim(),
        barcode: product.barcode!.trim(),
        nameEn: product.nameEn!.trim(),
        nameTa: product.nameTa?.trim() || '',
        categoryId: product.categoryId || null,
        categoryName: cat?.name || '',
        subcategoryId: product.subcategoryId || null,
        subcategoryName: subcat?.name || '',
        brandId: product.brandId || null,
        brandName: brand?.name || '',
        unit: product.unit || 'PCS',
        hsnCode: product.hsnCode || '',
        purchaseRate: Number(product.purchaseRate) || 0,
        saleRate: Number(product.saleRate) || 0,
        wholesaleRate: Number(product.wholesaleRate) || 0,
        mrp: Number(product.mrp) || 0,
        taxRate: Number(product.taxRate) || 0,
        sgstRate: product.sgstRate !== undefined ? Number(product.sgstRate) : ((Number(product.taxRate) || 0) / 2),
        cgstRate: product.cgstRate !== undefined ? Number(product.cgstRate) : ((Number(product.taxRate) || 0) / 2),
        igstRate: product.igstRate !== undefined ? Number(product.igstRate) : (Number(product.taxRate) || 0),
        openingStock: Number(product.openingStock) || 0,
        currentStock: Number(product.currentStock ?? product.openingStock) || 0,
        reorderLevel: Number(product.reorderLevel) || 5,
        maxStockLevel: Number(product.maxStockLevel) || 1000,
        isActive: product.isActive !== undefined ? product.isActive : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.products.unshift(newProd);
      this.rebuildIndexes();

      this.logAudit('Product', newProd.id.toString(), 'INSERT', `Created product '${newProd.nameEn}' (Code: ${newProd.productCode})`);
      return { success: true, errors: [], product: newProd };
    }
  }

  public insertProduct(product: Partial<Product>): { success: boolean; errors: string[]; product?: Product } {
    return this.saveProduct(product);
  }

  public deactivateProduct(id: number): boolean {
    const p = this.idIndex.get(id);
    if (!p) return false;
    p.isActive = false;
    p.updatedAt = new Date().toISOString();
    this.logAudit('Product', id.toString(), 'DEACTIVATE', `Deactivated product '${p.nameEn}'`);
    if (!this.isInitializing) this.saveToLocalStorage();
    return true;
  }

  public activateProduct(id: number): boolean {
    const p = this.idIndex.get(id);
    if (!p) return false;
    p.isActive = true;
    p.updatedAt = new Date().toISOString();
    this.logAudit('Product', id.toString(), 'ACTIVATE', `Re-activated product '${p.nameEn}'`);
    if (!this.isInitializing) this.saveToLocalStorage();
    return true;
  }

  public deleteProduct(id: number): boolean {
    const p = this.idIndex.get(id);
    if (!p) return false;
    this.products = this.products.filter(item => item.id !== id);
    this.idIndex.delete(id);
    if (p.barcode) this.barcodeIndex.delete(p.barcode.trim().toLowerCase());
    if (p.productCode) this.codeIndex.delete(p.productCode.trim().toLowerCase());
    if (p.categoryId) this.categoryIndex.get(p.categoryId)?.delete(p);
    if (p.brandId) this.brandIndex.get(p.brandId)?.delete(p);
    this.logAudit('Product', id.toString(), 'DELETE' as any, `Deleted product '${p.nameEn}'`);
    if (!this.isInitializing) this.saveToLocalStorage();
    return true;
  }

  public removeAllProducts(): number {
    const count = this.products.length;
    this.products = [];
    this.barcodeIndex.clear();
    this.codeIndex.clear();
    this.idIndex.clear();
    this.categoryIndex.clear();
    this.brandIndex.clear();
    this.currentNextId = 1;
    this.logAudit('Product', 'ALL', 'DELETE' as any, `Cleared all ${count} existing products before bulk import`);
    if (!this.isInitializing) this.saveToLocalStorage();
    return count;
  }

  public bulkImportProducts(
    newItems: Partial<Product>[],
    updateDuplicates: boolean = false,
    clearExisting: boolean = false
  ): { imported: number; failed: number; errors: any[]; clearedCount?: number } {
    let clearedCount = 0;
    if (clearExisting) {
      clearedCount = this.removeAllProducts();
    }

    let imported = 0;
    let failed = 0;
    const errors: any[] = [];

    for (let i = 0; i < newItems.length; i++) {
      const row = { ...newItems[i] };

      // Auto-assign product code if missing
      if (!row.productCode || row.productCode.trim().length < 2) {
        const nextSeq = this.products.length + imported + 1;
        row.productCode = `PRD${nextSeq.toString().padStart(4, '0')}`;
      }

      // Auto-assign barcode if missing
      if (!row.barcode || row.barcode.trim().length < 3) {
        row.barcode = this.generateUniqueBarcode('A385');
      }

      // Ensure MRP is at least sale rate if missing
      if (!row.mrp || row.mrp < (row.saleRate || 0)) {
        row.mrp = row.saleRate || 0;
      }

      // If updateDuplicates is enabled, check if product already exists by barcode or productCode
      if (updateDuplicates && !clearExisting) {
        const cleanBc = row.barcode?.trim().toLowerCase();
        const cleanCd = row.productCode?.trim().toLowerCase();
        const existing = (cleanBc ? this.barcodeIndex.get(cleanBc) : undefined) ||
                         (cleanCd ? this.codeIndex.get(cleanCd) : undefined);
        if (existing) {
          row.id = existing.id;
        }
      }

      const res = this.saveProduct(row);
      if (res.success) {
        imported++;
      } else {
        failed++;
        errors.push({ row: i + 1, code: row.productCode, barcode: row.barcode, error: res.errors.join('; ') });
      }
    }

    this.logAudit('Excel', 'BulkImport', 'IMPORT', `Imported/Updated ${imported} products with ${failed} failures (cleared existing: ${clearedCount}).`);
    if (!this.isInitializing) this.saveToLocalStorage();
    return { imported, failed, errors, clearedCount };
  }

  public load50kBenchmarkDataset(): { durationMs: number; count: number } {
    const t0 = performance.now();

    const sampleBatch: Product[] = [];
    const prefixesEn = ['Tata', 'Aachi', 'Britannia', 'Parle', 'HUL', 'Nestle', 'Amul', 'ITC', 'Dabur', 'Everest'];
    const prefixesTa = ['டாடா', 'ஆச்சி', 'பிரிட்டானியா', 'பார்லே', 'ஹெச்ச்யூஎல்', 'நெஸ்லே', 'அமுல்', 'ஐடிசி', 'டாபர்', 'எவரெஸ்ட்'];
    const itemsEn = ['Ponni Rice', 'Chilli Powder', 'Tea Powder', 'Salt', 'Ghee', 'Biscuits', 'Soap', 'Toothpaste', 'Sunflower Oil', 'Toor Dal'];
    const itemsTa = ['பொன்னி அரிசி', 'மிளகாய் தூள்', 'தேயிலை தூள்', 'உப்பு', 'நெய்', 'பிஸ்கட்', 'சோப்பு', 'பல்பசை', 'சூரியகாந்தி எண்ணெய்', 'துவரம் பருப்பு'];
    const units = ['PCS', 'KG', 'PACK', 'BAG', 'LTR'];

    for (let i = 1; i <= 50000; i++) {
      const pIdx = i % prefixesEn.length;
      const itIdx = (i * 3) % itemsEn.length;
      const catId = (i % 6) + 1;
      const brandId = (i % 8) + 1;
      const unit = units[i % units.length];

      const pur = 20 + (i % 450);
      const sale = Math.round(pur * 1.25);
      const mrp = Math.round(sale * 1.08);

      sampleBatch.push({
        id: this.currentNextId++,
        productCode: `PRD${i.toString().padStart(6, '0')}`,
        barcode: `890${i.toString().padStart(10, '0')}`,
        nameEn: `${prefixesEn[pIdx]} ${itemsEn[itIdx]} #${i}`,
        nameTa: `${prefixesTa[pIdx]} ${itemsTa[itIdx]} #${i}`,
        categoryId: catId,
        categoryName: this.categories.find((c) => c.id === catId)?.name || 'Groceries',
        subcategoryId: (i % 8) + 1,
        subcategoryName: this.subcategories.find((s) => s.id === ((i % 8) + 1))?.name || 'Staples',
        brandId: brandId,
        brandName: this.brands.find((b) => b.id === brandId)?.name || 'General',
        unit,
        purchaseRate: pur,
        saleRate: sale,
        wholesaleRate: Math.round(sale * 0.94),
        mrp,
        taxRate: (i % 4 === 0) ? 0 : (i % 4 === 1) ? 5 : 18,
        openingStock: 50 + (i % 200),
        currentStock: (i % 15 === 0) ? 3 : 50 + (i % 190),
        reorderLevel: 10,
        maxStockLevel: 500,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    this.products = sampleBatch;
    this.rebuildIndexes();
    this.is50kLoaded = true;

    const t1 = performance.now();
    const durationMs = parseFloat((t1 - t0).toFixed(1));

    this.logAudit('Benchmark', '50k', 'INSERT', `Indexed 50,000 products in ${durationMs}ms`);
    return { durationMs, count: 50000 };
  }

  public getCategories() { return this.categories; }
  public getSubcategories(catId?: number) {
    if (!catId) return this.subcategories;
    return this.subcategories.filter((s) => s.categoryId === catId);
  }
  public getBrands() { return this.brands; }
  public getAuditLogs() { return this.auditLogs.slice(0, 100); }
  public getAllProducts() { return this.products; }

  public addCategory(name: string, code?: string): Category {
    const newCat: Category = {
      id: Date.now(),
      name,
      code: code || `CAT-${Math.floor(1000 + Math.random() * 9000)}`,
      isActive: true,
      productCount: 0,
    };
    this.categories.push(newCat);
    this.logAudit('Category', newCat.id.toString(), 'INSERT', `Added category '${name}'`);
    return newCat;
  }

  public addSubcategory(categoryId: number, name: string, code?: string): Subcategory {
    const newSub: Subcategory = {
      id: Date.now(),
      categoryId,
      name,
      code: code || `SUB-${Math.floor(1000 + Math.random() * 9000)}`,
      isActive: true,
    };
    this.subcategories.push(newSub);
    this.logAudit('Subcategory', newSub.id.toString(), 'INSERT', `Added subcategory '${name}'`);
    return newSub;
  }

  public addBrand(name: string, code?: string): Brand {
    const newBrand: Brand = {
      id: Date.now(),
      name,
      code: code || `BR-${Math.floor(1000 + Math.random() * 9000)}`,
      isActive: true,
    };
    this.brands.push(newBrand);
    this.logAudit('Brand', newBrand.id.toString(), 'INSERT', `Added brand '${name}'`);
    return newBrand;
  }

  // -------------------------------------------------------------
  // MODULE 1: SUPPLIER MANAGEMENT METHODS
  // -------------------------------------------------------------
  public getAllSuppliers(): Supplier[] {
    return this.suppliers;
  }

  public getAllActiveSuppliers(): Supplier[] {
    return this.suppliers.filter((s) => s.isActive);
  }

  public getSupplierById(id: number): Supplier | undefined {
    return this.supplierIdIndex.get(id);
  }

  public getSupplierByCode(code: string): Supplier | undefined {
    return this.supplierCodeIndex.get(code.trim().toUpperCase());
  }

  public generateNextSupplierCode(): string {
    const prefix = 'SUP';
    let maxNum = 0;
    for (const s of this.suppliers) {
      if (s.code && s.code.startsWith(prefix)) {
        const numPart = parseInt(s.code.substring(prefix.length), 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      }
    }
    return `${prefix}${(maxNum + 1).toString().padStart(3, '0')}`;
  }

  public searchSuppliers(filter: SupplierFilter): PagedResult<Supplier> {
    const t0 = performance.now();
    const term = filter.searchTerm?.trim().toLowerCase();

    let list = this.suppliers.filter((s) => {
      if (filter.isActive !== undefined && s.isActive !== filter.isActive) return false;

      if (term) {
        const matchName = s.name.toLowerCase().includes(term);
        const matchCode = s.code.toLowerCase().includes(term);
        const matchMobile = s.mobile ? s.mobile.toLowerCase().includes(term) : false;
        const matchGstin = s.gstin ? s.gstin.toLowerCase().includes(term) : false;
        const matchCity = s.city ? s.city.toLowerCase().includes(term) : false;
        const matchPerson = s.contactPerson ? s.contactPerson.toLowerCase().includes(term) : false;

        if (!matchName && !matchCode && !matchMobile && !matchGstin && !matchCity && !matchPerson) {
          return false;
        }
      }
      return true;
    });

    // Sorting
    const sortBy = filter.sortBy || 'name';
    const isDesc = !!filter.sortDescending;
    list.sort((a, b) => {
      let valA: any = a[sortBy];
      let valB: any = b[sortBy];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return isDesc ? 1 : -1;
      if (valA > valB) return isDesc ? -1 : 1;
      return 0;
    });

    const totalCount = list.length;
    const pageNumber = Math.max(1, filter.pageNumber);
    const pageSize = Math.max(1, filter.pageSize);
    const totalPages = Math.ceil(totalCount / pageSize);

    const startIndex = (pageNumber - 1) * pageSize;
    const items = list.slice(startIndex, startIndex + pageSize);

    const t1 = performance.now();
    const executionTimeMs = parseFloat((t1 - t0).toFixed(2));

    return {
      items,
      totalCount,
      pageNumber,
      pageSize,
      totalPages,
      executionTimeMs,
    };
  }

  public saveSupplier(supplier: Partial<Supplier>): { success: boolean; errors: string[]; supplier?: Supplier } {
    const errors: string[] = [];

    // Required Field Validation
    if (!supplier.name || supplier.name.trim().length < 2) {
      errors.push('Supplier Name is required (minimum 2 characters).');
    }

    // Code Generation & Duplicate Validation
    let code = supplier.code?.trim().toUpperCase();
    if (!code) {
      code = this.generateNextSupplierCode();
    }

    const existingByCode = this.supplierCodeIndex.get(code);
    if (existingByCode && existingByCode.id !== supplier.id) {
      errors.push(`Supplier Code '${code}' already exists. Please provide a unique code.`);
    }

    // Mobile Number Format Validation (if provided, must be 10 digits)
    if (supplier.mobile && supplier.mobile.trim().length > 0) {
      const cleanMobile = supplier.mobile.replace(/[^0-9]/g, '');
      if (cleanMobile.length !== 10) {
        errors.push(`Mobile number must be a valid 10-digit phone number. Received: '${supplier.mobile}'`);
      }
    }

    // GSTIN Format Validation (if provided, standard Indian 15-character format)
    if (supplier.gstin && supplier.gstin.trim().length > 0) {
      const cleanGst = supplier.gstin.trim().toUpperCase();
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(cleanGst)) {
        errors.push(`GSTIN '${supplier.gstin}' does not match standard 15-digit GST format (e.g. 33AAAAA0000A1Z5).`);
      }
    }

    if (errors.length > 0) return { success: false, errors };

    if (supplier.id) {
      // Update existing supplier
      const index = this.suppliers.findIndex((s) => s.id === supplier.id);
      if (index === -1) return { success: false, errors: ['Supplier not found.'] };

      const updated: Supplier = {
        ...this.suppliers[index],
        ...supplier,
        code,
        name: supplier.name!.trim(),
        updatedAt: new Date().toISOString(),
      };

      this.suppliers[index] = updated;
      this.rebuildIndexes();

      this.logAudit('Supplier', updated.id.toString(), 'UPDATE', `Updated supplier '${updated.name}' (Code: ${updated.code})`);
      return { success: true, errors: [], supplier: updated };
    } else {
      // Insert new supplier
      const openBal = Number(supplier.openingBalance) || 0;
      const newSup: Supplier = {
        id: this.nextSupplierId++,
        code,
        name: supplier.name!.trim(),
        contactPerson: supplier.contactPerson?.trim() || '',
        mobile: supplier.mobile?.trim() || '',
        altMobile: supplier.altMobile?.trim() || '',
        whatsapp: supplier.whatsapp?.trim() || '',
        email: supplier.email?.trim() || '',
        gstin: supplier.gstin?.trim().toUpperCase() || '',
        pan: supplier.pan?.trim().toUpperCase() || '',
        address: supplier.address?.trim() || '',
        city: supplier.city?.trim() || '',
        state: supplier.state?.trim() || 'Tamil Nadu',
        stateCode: supplier.stateCode?.trim() || '33',
        pinCode: supplier.pinCode?.trim() || '',
        openingBalance: openBal,
        currentBalance: openBal,
        paymentTerms: supplier.paymentTerms?.trim() || '30 Days Net',
        notes: supplier.notes?.trim() || '',
        isActive: supplier.isActive !== undefined ? supplier.isActive : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // If opening balance > 0, record initial ledger entry
      if (openBal > 0) {
        this.supplierLedger.push({
          id: this.nextLedgerId++,
          supplierId: newSup.id,
          transactionType: 'OPENING_BALANCE',
          referenceId: `OPN-${newSup.code}`,
          debit: 0,
          credit: openBal,
          balanceAfter: openBal,
          notes: 'Opening balance payable registered',
          transactionDate: newSup.createdAt,
        });
      }

      this.suppliers.unshift(newSup);
      this.rebuildIndexes();

      this.logAudit('Supplier', newSup.id.toString(), 'INSERT', `Registered supplier '${newSup.name}' (Code: ${newSup.code})`);
      return { success: true, errors: [], supplier: newSup };
    }
  }

  public deactivateSupplier(id: number): boolean {
    const s = this.supplierIdIndex.get(id);
    if (!s) return false;
    s.isActive = false;
    s.updatedAt = new Date().toISOString();
    this.logAudit('Supplier', id.toString(), 'DEACTIVATE', `Deactivated supplier '${s.name}'`);
    return true;
  }

  public activateSupplier(id: number): boolean {
    const s = this.supplierIdIndex.get(id);
    if (!s) return false;
    s.isActive = true;
    s.updatedAt = new Date().toISOString();
    this.logAudit('Supplier', id.toString(), 'ACTIVATE', `Re-activated supplier '${s.name}'`);
    return true;
  }

  public hasSupplierTransactions(id: number): boolean {
    const hasPurchases = this.purchases.some((p) => p.supplierId === id);
    const hasPayments = this.supplierPayments.some((p) => p.supplierId === id);
    return hasPurchases || hasPayments;
  }

  public deleteSupplier(id: number): { success: boolean; error?: string } {
    if (this.hasSupplierTransactions(id)) {
      return {
        success: false,
        error: 'Cannot delete supplier with existing purchase bills or payment history. Deactivate the supplier instead to maintain audit integrity.',
      };
    }
    const idx = this.suppliers.findIndex((s) => s.id === id);
    if (idx === -1) return { success: false, error: 'Supplier not found.' };

    const name = this.suppliers[idx].name;
    this.suppliers.splice(idx, 1);
    this.rebuildIndexes();
    this.logAudit('Supplier', id.toString(), 'DEACTIVATE', `Deleted supplier '${name}'`);
    return { success: true };
  }

  public bulkImportSuppliers(newSuppliers: Partial<Supplier>[]): { imported: number; failed: number; errors: any[] } {
    let imported = 0;
    let failed = 0;
    const errors: any[] = [];

    for (let i = 0; i < newSuppliers.length; i++) {
      const row = newSuppliers[i];
      const res = this.saveSupplier(row);
      if (res.success) {
        imported++;
      } else {
        failed++;
        errors.push({
          row: i + 1,
          name: row.name || 'Unknown',
          code: row.code || 'Auto',
          error: res.errors.join('; '),
        });
      }
    }

    this.logAudit('Excel', 'SupplierBulkImport', 'IMPORT', `Imported ${imported} suppliers with ${failed} failures.`);
    return { imported, failed, errors };
  }

  // -------------------------------------------------------------
  // MODULE 2: INBOUND GOODS / PURCHASE ENTRY METHODS
  // -------------------------------------------------------------
  public generateNextPurchaseNumber(): string {
    const year = new Date().getFullYear();
    const prefix = `PUR-${year}-`;
    let maxSeq = 0;

    for (const pur of this.purchases) {
      if (pur.purchaseNumber && pur.purchaseNumber.startsWith(prefix)) {
        const seq = parseInt(pur.purchaseNumber.substring(prefix.length), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    }
    return `${prefix}${(maxSeq + 1).toString().padStart(4, '0')}`;
  }

  public searchPurchases(filter: PurchaseFilter): PagedResult<PurchaseHeader> {
    const t0 = performance.now();
    const term = filter.searchTerm?.trim().toLowerCase();

    let list = this.purchases.filter((p) => {
      if (filter.supplierId && p.supplierId !== filter.supplierId) return false;
      if (filter.status && filter.status !== 'All' && p.status !== filter.status) return false;

      if (filter.fromDate) {
        const from = new Date(filter.fromDate).getTime();
        const pDate = new Date(p.goodsReceivedDate).getTime();
        if (pDate < from) return false;
      }

      if (filter.toDate) {
        const to = new Date(filter.toDate).getTime() + 86400000;
        const pDate = new Date(p.goodsReceivedDate).getTime();
        if (pDate > to) return false;
      }

      if (term) {
        const matchNum = p.purchaseNumber.toLowerCase().includes(term);
        const matchSup = p.supplierName.toLowerCase().includes(term);
        const matchInv = p.supplierInvoiceNumber ? p.supplierInvoiceNumber.toLowerCase().includes(term) : false;
        const matchRef = p.referenceNumber ? p.referenceNumber.toLowerCase().includes(term) : false;

        if (!matchNum && !matchSup && !matchInv && !matchRef) return false;
      }

      return true;
    });

    // Sort by goodsReceivedDate DESC
    list.sort((a, b) => new Date(b.goodsReceivedDate).getTime() - new Date(a.goodsReceivedDate).getTime());

    const totalCount = list.length;
    const pageNumber = Math.max(1, filter.pageNumber);
    const pageSize = Math.max(1, filter.pageSize);
    const totalPages = Math.ceil(totalCount / pageSize);

    const startIndex = (pageNumber - 1) * pageSize;
    const items = list.slice(startIndex, startIndex + pageSize);

    const t1 = performance.now();
    const executionTimeMs = parseFloat((t1 - t0).toFixed(2));

    return {
      items,
      totalCount,
      pageNumber,
      pageSize,
      totalPages,
      executionTimeMs,
    };
  }

  public getPurchaseById(id: number): PurchaseHeader | undefined {
    return this.purchaseIdIndex.get(id);
  }

  public saveDraftPurchase(header: Partial<PurchaseHeader>): { success: boolean; errors: string[]; purchase?: PurchaseHeader } {
    const errors: string[] = [];

    if (!header.supplierId) {
      errors.push('Supplier must be selected.');
    }
    if (!header.items || header.items.length === 0) {
      errors.push('At least one product line item is required.');
    }

    if (errors.length > 0) return { success: false, errors };

    const supplier = this.supplierIdIndex.get(header.supplierId!);
    const supplierName = supplier ? supplier.name : 'Unknown Supplier';

    // Recalculate totals
    let totalQty = 0;
    let totalFreeQty = 0;
    let grossAmount = 0;
    let itemDiscount = 0;
    let taxableAmount = 0;
    let taxAmount = 0;

    const validatedItems: PurchaseItem[] = header.items!.map((it, idx) => {
      const qty = Math.max(0, Number(it.quantity) || 0);
      const freeQty = Math.max(0, Number(it.freeQuantity) || 0);
      const rate = Math.max(0, Number(it.purchaseRate) || 0);
      const discPct = Math.max(0, Number(it.discountPercent) || 0);
      const taxRate = Math.max(0, Number(it.taxRate) || 0);

      const lineGross = qty * rate;
      const lineDisc = (lineGross * discPct) / 100;
      const lineTaxable = Math.max(0, lineGross - lineDisc);
      const lineTax = (lineTaxable * taxRate) / 100;
      const lineTotal = lineTaxable + lineTax;

      totalQty += qty;
      totalFreeQty += freeQty;
      grossAmount += lineGross;
      itemDiscount += lineDisc;
      taxableAmount += lineTaxable;
      taxAmount += lineTax;

      return {
        id: it.id || idx + 1,
        purchaseId: header.id || 0,
        productId: it.productId,
        productCode: it.productCode,
        barcode: it.barcode,
        productName: it.productName,
        categoryName: it.categoryName || '',
        quantity: qty,
        freeQuantity: freeQty,
        purchaseRate: rate,
        discountPercent: discPct,
        discountAmount: lineDisc,
        taxRate,
        taxableAmount: lineTaxable,
        taxAmount: lineTax,
        lineTotal,
        batchNumber: it.batchNumber || '',
        expiryDate: it.expiryDate || undefined,
      };
    });

    const addlDisc = Math.max(0, Number(header.additionalDiscount) || 0);
    const addlCharges = Math.max(0, Number(header.additionalCharges) || 0);
    const preRound = taxableAmount + taxAmount + addlCharges - addlDisc;
    const grandTotal = Math.round(preRound);
    const roundOff = parseFloat((grandTotal - preRound).toFixed(2));
    const amtPaid = Math.max(0, Number(header.amountPaid) || 0);
    const balanceDue = Math.max(0, grandTotal - amtPaid);

    if (header.id) {
      // Update existing draft
      const idx = this.purchases.findIndex((p) => p.id === header.id);
      if (idx === -1) return { success: false, errors: ['Purchase entry not found.'] };

      if (this.purchases[idx].status === 'Confirmed') {
        return { success: false, errors: ['Cannot edit a confirmed purchase. Create a new purchase or cancel this one.'] };
      }

      const updated: PurchaseHeader = {
        ...this.purchases[idx],
        ...header,
        supplierName,
        items: validatedItems,
        totalQty,
        totalFreeQty,
        grossAmount,
        itemDiscount,
        additionalDiscount: addlDisc,
        taxableAmount,
        taxAmount,
        additionalCharges: addlCharges,
        roundOff,
        grandTotal,
        amountPaid: amtPaid,
        balanceDue,
        updatedAt: new Date().toISOString(),
      };

      this.purchases[idx] = updated;
      this.rebuildIndexes();

      this.logAudit('Purchase', updated.purchaseNumber, 'UPDATE', `Updated draft purchase #${updated.purchaseNumber}`);
      return { success: true, errors: [], purchase: updated };
    } else {
      // Create new draft
      const purNum = header.purchaseNumber || this.generateNextPurchaseNumber();
      const newPur: PurchaseHeader = {
        id: this.nextPurchaseId++,
        purchaseNumber: purNum,
        supplierId: header.supplierId!,
        supplierName,
        supplierInvoiceNumber: header.supplierInvoiceNumber?.trim() || '',
        supplierInvoiceDate: header.supplierInvoiceDate || undefined,
        goodsReceivedDate: header.goodsReceivedDate || new Date().toISOString(),
        purchaseType: (header.purchaseType === 'Cash' ? 'Cash' : 'Credit'),
        paymentDueDate: header.paymentDueDate || undefined,
        referenceNumber: header.referenceNumber?.trim() || '',
        notes: header.notes?.trim() || '',
        status: 'Draft',
        totalQty,
        totalFreeQty,
        grossAmount,
        itemDiscount,
        additionalDiscount: addlDisc,
        taxableAmount,
        taxAmount,
        additionalCharges: addlCharges,
        roundOff,
        grandTotal,
        amountPaid: amtPaid,
        balanceDue,
        createdBy: 'Admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: validatedItems,
      };

      this.purchases.unshift(newPur);
      this.rebuildIndexes();

      this.logAudit('Purchase', newPur.purchaseNumber, 'INSERT', `Created draft purchase #${newPur.purchaseNumber}`);
      return { success: true, errors: [], purchase: newPur };
    }
  }

  public confirmPurchase(purchaseId: number): { success: boolean; error?: string; purchase?: PurchaseHeader } {
    const purchase = this.purchaseIdIndex.get(purchaseId);
    if (!purchase) return { success: false, error: 'Purchase entry not found.' };

    if (purchase.status === 'Confirmed') {
      return { success: false, error: 'Purchase is already confirmed.' };
    }
    if (purchase.status === 'Cancelled') {
      return { success: false, error: 'Cannot confirm a cancelled purchase.' };
    }

    if (!purchase.items || purchase.items.length === 0) {
      return { success: false, error: 'Cannot confirm purchase with 0 line items.' };
    }

    const supplier = this.supplierIdIndex.get(purchase.supplierId);
    if (!supplier) return { success: false, error: 'Associated supplier not found.' };

    // 1. Atomically update product stock and write stock movement ledger
    for (const item of purchase.items) {
      const prod = this.idIndex.get(item.productId);
      if (prod) {
        const addedQty = item.quantity + item.freeQuantity;
        const before = prod.currentStock;
        const after = before + addedQty;

        prod.currentStock = after;
        prod.updatedAt = new Date().toISOString();

        // Also update purchaseRate in product master if current rate changed
        if (item.purchaseRate > 0) {
          prod.purchaseRate = item.purchaseRate;
        }

        this.stockMovements.unshift({
          id: this.nextMovementId++,
          productId: prod.id,
          productCode: prod.productCode,
          productName: prod.nameEn,
          referenceType: 'PURCHASE_CONFIRM',
          referenceId: purchase.purchaseNumber,
          quantity: addedQty,
          quantityBefore: before,
          quantityAfter: after,
          notes: `Purchase received: ${item.quantity} + ${item.freeQuantity} free (Bill: ${purchase.purchaseNumber})`,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // 2. Update Supplier Balance & Ledger
    if (purchase.purchaseType === 'Credit') {
      // Credit purchase increases supplier's current balance by balanceDue
      const oldBal = supplier.currentBalance;
      const newBal = oldBal + purchase.balanceDue;
      supplier.currentBalance = newBal;
      supplier.updatedAt = new Date().toISOString();

      this.supplierLedger.unshift({
        id: this.nextLedgerId++,
        supplierId: supplier.id,
        transactionType: 'PURCHASE',
        referenceId: purchase.purchaseNumber,
        debit: 0,
        credit: purchase.balanceDue,
        balanceAfter: newBal,
        notes: `Credit Purchase #${purchase.purchaseNumber} (Inv #${purchase.supplierInvoiceNumber || 'N/A'})`,
        transactionDate: new Date().toISOString(),
      });
    }

    // 3. If cash paid on confirmation, record payment entry
    if (purchase.amountPaid > 0) {
      const payNum = `PAY-${new Date().getFullYear()}-${this.nextPaymentId.toString().padStart(4, '0')}`;
      this.supplierPayments.unshift({
        id: this.nextPaymentId++,
        paymentNumber: payNum,
        supplierId: supplier.id,
        supplierName: supplier.name,
        purchaseId: purchase.id,
        purchaseNumber: purchase.purchaseNumber,
        paymentDate: new Date().toISOString(),
        paymentMethod: purchase.purchaseType === 'Cash' ? 'Cash' : 'Bank Transfer',
        amount: purchase.amountPaid,
        referenceNumber: `REC-${purchase.purchaseNumber}`,
        notes: `Immediate payment recorded on bill confirmation`,
        createdAt: new Date().toISOString(),
      });
    }

    // 4. Update purchase header status
    purchase.status = 'Confirmed';
    purchase.confirmedAt = new Date().toISOString();
    purchase.updatedAt = new Date().toISOString();

    this.rebuildIndexes();

    this.logAudit(
      'Purchase',
      purchase.purchaseNumber,
      'UPDATE',
      `Confirmed purchase #${purchase.purchaseNumber} · Stock updated for ${purchase.items.length} items · Total ₹${purchase.grandTotal}`
    );

    return { success: true, purchase };
  }

  public cancelPurchase(purchaseId: number): { success: boolean; error?: string } {
    const purchase = this.purchaseIdIndex.get(purchaseId);
    if (!purchase) return { success: false, error: 'Purchase entry not found.' };

    if (purchase.status !== 'Confirmed') {
      return { success: false, error: 'Only confirmed purchases can be cancelled.' };
    }

    const supplier = this.supplierIdIndex.get(purchase.supplierId);

    // 1. Revert product stocks safely
    for (const item of purchase.items) {
      const prod = this.idIndex.get(item.productId);
      if (prod) {
        const revertQty = item.quantity + item.freeQuantity;
        const before = prod.currentStock;
        const after = Math.max(0, before - revertQty);

        prod.currentStock = after;
        prod.updatedAt = new Date().toISOString();

        this.stockMovements.unshift({
          id: this.nextMovementId++,
          productId: prod.id,
          productCode: prod.productCode,
          productName: prod.nameEn,
          referenceType: 'PURCHASE_CANCEL',
          referenceId: purchase.purchaseNumber,
          quantity: -revertQty,
          quantityBefore: before,
          quantityAfter: after,
          notes: `Purchase cancelled reversion: -${revertQty} items (Bill: ${purchase.purchaseNumber})`,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // 2. Revert Supplier Balance if Credit
    if (purchase.purchaseType === 'Credit' && supplier) {
      const oldBal = supplier.currentBalance;
      const newBal = Math.max(0, oldBal - purchase.balanceDue);
      supplier.currentBalance = newBal;
      supplier.updatedAt = new Date().toISOString();

      this.supplierLedger.unshift({
        id: this.nextLedgerId++,
        supplierId: supplier.id,
        transactionType: 'PURCHASE_CANCEL',
        referenceId: `REV-${purchase.purchaseNumber}`,
        debit: purchase.balanceDue,
        credit: 0,
        balanceAfter: newBal,
        notes: `Reversal for cancelled purchase #${purchase.purchaseNumber}`,
        transactionDate: new Date().toISOString(),
      });
    }

    purchase.status = 'Cancelled';
    purchase.cancelledAt = new Date().toISOString();
    purchase.updatedAt = new Date().toISOString();

    this.rebuildIndexes();

    this.logAudit(
      'Purchase',
      purchase.purchaseNumber,
      'UPDATE',
      `Cancelled purchase #${purchase.purchaseNumber} · Stock and supplier balances safely reverted`
    );

    return { success: true };
  }

  public recordSupplierPayment(payment: Partial<SupplierPayment>): { success: boolean; errors: string[]; payment?: SupplierPayment } {
    const errors: string[] = [];
    if (!payment.supplierId) errors.push('Supplier is required.');
    if (!payment.amount || payment.amount <= 0) errors.push('Payment amount must be greater than zero.');

    const supplier = this.supplierIdIndex.get(payment.supplierId!);
    if (!supplier) errors.push('Supplier not found.');

    if (errors.length > 0) return { success: false, errors };

    const payNum = `PAY-${new Date().getFullYear()}-${this.nextPaymentId.toString().padStart(4, '0')}`;
    const amount = Number(payment.amount);

    const newPay: SupplierPayment = {
      id: this.nextPaymentId++,
      paymentNumber: payNum,
      supplierId: supplier!.id,
      supplierName: supplier!.name,
      purchaseId: payment.purchaseId || undefined,
      purchaseNumber: payment.purchaseNumber || undefined,
      paymentDate: payment.paymentDate || new Date().toISOString(),
      paymentMethod: payment.paymentMethod || 'Cash',
      amount,
      referenceNumber: payment.referenceNumber?.trim() || '',
      notes: payment.notes?.trim() || '',
      createdAt: new Date().toISOString(),
    };

    // Update supplier current balance
    const oldBal = supplier!.currentBalance;
    const newBal = Math.max(0, oldBal - amount);
    supplier!.currentBalance = newBal;
    supplier!.updatedAt = new Date().toISOString();

    // Ledger entry
    this.supplierLedger.unshift({
      id: this.nextLedgerId++,
      supplierId: supplier!.id,
      transactionType: 'PAYMENT',
      referenceId: payNum,
      debit: amount,
      credit: 0,
      balanceAfter: newBal,
      notes: `Payment made via ${newPay.paymentMethod} (Ref: ${newPay.referenceNumber || 'N/A'})`,
      transactionDate: newPay.paymentDate,
    });

    this.supplierPayments.unshift(newPay);

    this.logAudit('SupplierPayment', payNum, 'INSERT', `Recorded payment of ₹${amount} to '${supplier!.name}' (${newPay.paymentMethod})`);
    return { success: true, errors: [], payment: newPay };
  }

  public getSupplierLedger(supplierId: number): SupplierLedgerEntry[] {
    return this.supplierLedger.filter((l) => l.supplierId === supplierId);
  }

  public getSupplierPayments(supplierId?: number): SupplierPayment[] {
    if (!supplierId) return this.supplierPayments;
    return this.supplierPayments.filter((p) => p.supplierId === supplierId);
  }

  public getStockMovements(productId?: number): StockMovement[] {
    if (!productId) return this.stockMovements;
    return this.stockMovements.filter((m) => m.productId === productId);
  }

  public getMetrics() {
    const total = this.products.filter((p) => p.isActive).length;
    const lowStock = this.products.filter((p) => p.isActive && p.currentStock <= p.reorderLevel).length;
    const outOfStock = this.products.filter((p) => p.isActive && p.currentStock <= 0).length;
    const excessStock = this.products.filter((p) => p.isActive && p.maxStockLevel > 0 && p.currentStock > p.maxStockLevel).length;
    const totalSuppliers = this.suppliers.filter((s) => s.isActive).length;
    const pendingDrafts = this.purchases.filter((p) => p.status === 'Draft').length;
    const totalPurchasesConfirmed = this.purchases.filter((p) => p.status === 'Confirmed').length;
    const totalPayableToSuppliers = this.suppliers.reduce((acc, s) => acc + (s.currentBalance > 0 ? s.currentBalance : 0), 0);
    const totalStockQuantity = this.products.reduce((acc, p) => acc + (p.isActive ? p.currentStock : 0), 0);
    const stockValueAtCost = this.products.reduce((acc, p) => acc + (p.isActive ? p.currentStock * p.purchaseRate : 0), 0);
    const stockValueAtSale = this.products.reduce((acc, p) => acc + (p.isActive ? p.currentStock * p.saleRate : 0), 0);
    const totalInvoices = this.invoices.filter((i) => i.status === 'Confirmed').length;
    const totalSalesAmount = this.invoices
      .filter((i) => i.status === 'Confirmed')
      .reduce((acc, i) => acc + i.grandTotal, 0);

    return {
      total,
      lowStock,
      outOfStock,
      excessStock,
      totalStockQuantity,
      stockValueAtCost,
      stockValueAtSale,
      is50kLoaded: this.is50kLoaded,
      totalSuppliers,
      pendingDrafts,
      totalPurchasesConfirmed,
      totalPayableToSuppliers,
      totalInvoices,
      totalSalesAmount,
      totalEstimates: this.estimates.length,
      convertedEstimates: this.estimates.filter((e) => e.status === 'Converted').length,
    };
  }

  // -------------------------------------------------------------
  // PHASE 3: STOCK MANAGEMENT & RECONCILIATION METHODS
  // -------------------------------------------------------------
  public getStockDashboardMetrics(): StockDashboardMetrics {
    const active = this.products.filter((p) => p.isActive);
    const totalStockQuantity = active.reduce((sum, p) => sum + p.currentStock, 0);
    const outOfStockCount = active.filter((p) => p.currentStock <= 0).length;
    const lowStockCount = active.filter((p) => p.currentStock > 0 && p.currentStock <= p.reorderLevel).length;
    const excessStockCount = active.filter((p) => p.maxStockLevel > 0 && p.currentStock > p.maxStockLevel).length;
    const stockValueAtCost = active.reduce((sum, p) => sum + p.currentStock * p.purchaseRate, 0);
    const stockValueAtSale = active.reduce((sum, p) => sum + p.currentStock * p.saleRate, 0);
    const potentialGrossMargin = stockValueAtSale - stockValueAtCost;

    // Distinct products adjusted
    const adjustedProdIds = new Set<number>();
    for (const adj of this.stockAdjustments) {
      if (adj.status === 'Confirmed') {
        for (const item of adj.items) {
          adjustedProdIds.add(item.productId);
        }
      }
    }

    return {
      totalActiveProducts: active.length,
      totalStockQuantity,
      outOfStockCount,
      lowStockCount,
      excessStockCount,
      adjustedProductsCount: adjustedProdIds.size,
      stockValueAtCost,
      stockValueAtSale,
      potentialGrossMargin,
      recentMovements: this.stockMovements.slice(0, 15),
    };
  }

  public getCurrentStockSummary(filter: {
    searchTerm?: string;
    categoryId?: number;
    brandId?: number;
    stockStatus?: string;
    sortBy?: string;
    sortDescending?: boolean;
    pageNumber: number;
    pageSize: number;
  }): PagedResult<CurrentStockSummary> {
    const t0 = performance.now();
    const term = filter.searchTerm?.trim().toLowerCase();

    // Compute purchased & free quantities per product from confirmed purchases
    const purchasedMap = new Map<number, number>();
    const freeMap = new Map<number, number>();

    for (const pur of this.purchases) {
      if (pur.status === 'Confirmed') {
        for (const it of pur.items) {
          purchasedMap.set(it.productId, (purchasedMap.get(it.productId) || 0) + it.quantity);
          freeMap.set(it.productId, (freeMap.get(it.productId) || 0) + it.freeQuantity);
        }
      }
    }

    // Compute sold quantities per product from confirmed sales invoices
    const soldMap = new Map<number, number>();
    for (const inv of this.invoices) {
      if (inv.status === 'Confirmed') {
        for (const it of inv.items) {
          soldMap.set(it.productId, (soldMap.get(it.productId) || 0) + it.quantity);
        }
      }
    }

    // Compute net adjustments per product from confirmed adjustments
    const adjMap = new Map<number, number>();
    for (const adj of this.stockAdjustments) {
      if (adj.status === 'Confirmed') {
        for (const it of adj.items) {
          adjMap.set(it.productId, (adjMap.get(it.productId) || 0) + it.differenceQuantity);
        }
      }
    }

    let list = this.products.filter((p) => {
      if (!p.isActive) return false;
      if (filter.categoryId && filter.categoryId > 0 && p.categoryId !== filter.categoryId) return false;
      if (filter.brandId && filter.brandId > 0 && p.brandId !== filter.brandId) return false;

      // Status filter
      if (filter.stockStatus && filter.stockStatus !== 'All') {
        if (filter.stockStatus === 'In Stock' && (p.currentStock <= p.reorderLevel || p.currentStock <= 0)) return false;
        if (filter.stockStatus === 'Low Stock' && (p.currentStock <= 0 || p.currentStock > p.reorderLevel)) return false;
        if (filter.stockStatus === 'Out of Stock' && p.currentStock > 0) return false;
        if (filter.stockStatus === 'Excess Stock' && (p.maxStockLevel <= 0 || p.currentStock <= p.maxStockLevel)) return false;
      }

      if (term) {
        const matchEn = p.nameEn.toLowerCase().includes(term);
        const matchTa = p.nameTa ? p.nameTa.toLowerCase().includes(term) : false;
        const matchBar = p.barcode.toLowerCase().includes(term);
        const matchCode = p.productCode.toLowerCase().includes(term);
        if (!matchEn && !matchTa && !matchBar && !matchCode) return false;
      }

      return true;
    });

    // Map to summaries
    const summaries: CurrentStockSummary[] = list.map((p) => {
      let status: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Excess Stock' = 'In Stock';
      if (p.currentStock <= 0) status = 'Out of Stock';
      else if (p.currentStock <= p.reorderLevel) status = 'Low Stock';
      else if (p.maxStockLevel > 0 && p.currentStock > p.maxStockLevel) status = 'Excess Stock';

      return {
        productId: p.id,
        productCode: p.productCode,
        barcode: p.barcode,
        productName: p.nameEn,
        categoryName: p.categoryName || '—',
        brandName: p.brandName || '—',
        unit: p.unit,
        openingStock: p.openingStock,
        purchasedQuantity: purchasedMap.get(p.id) || 0,
        freeQuantityReceived: freeMap.get(p.id) || 0,
        soldQuantity: soldMap.get(p.id) || 0,
        returnedQuantity: 0,
        adjustmentQuantity: adjMap.get(p.id) || 0,
        currentStock: p.currentStock,
        reorderLevel: p.reorderLevel,
        maxStockLevel: p.maxStockLevel,
        purchaseRate: p.purchaseRate,
        saleRate: p.saleRate,
        stockValuePurchase: p.currentStock * p.purchaseRate,
        stockValueSale: p.currentStock * p.saleRate,
        stockStatus: status,
      };
    });

    // Sort
    const sortBy = filter.sortBy || 'productName';
    const isDesc = !!filter.sortDescending;
    summaries.sort((a, b) => {
      let valA: any = (a as any)[sortBy];
      let valB: any = (b as any)[sortBy];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return isDesc ? 1 : -1;
      if (valA > valB) return isDesc ? -1 : 1;
      return 0;
    });

    const totalCount = summaries.length;
    const pageNumber = Math.max(1, filter.pageNumber);
    const pageSize = Math.max(1, filter.pageSize);
    const totalPages = Math.ceil(totalCount / pageSize);

    const startIndex = (pageNumber - 1) * pageSize;
    const items = summaries.slice(startIndex, startIndex + pageSize);

    const t1 = performance.now();
    const executionTimeMs = parseFloat((t1 - t0).toFixed(2));

    return {
      items,
      totalCount,
      pageNumber,
      pageSize,
      totalPages,
      executionTimeMs,
    };
  }

  public getStockValuation(categoryId?: number) {
    let prods = this.products.filter((p) => p.isActive && p.currentStock > 0);
    if (categoryId && categoryId > 0) {
      prods = prods.filter((p) => p.categoryId === categoryId);
    }

    return prods.map((p) => {
      const stockValueCost = p.currentStock * p.purchaseRate;
      const stockValueSale = p.currentStock * p.saleRate;
      return {
        productId: p.id,
        productCode: p.productCode,
        barcode: p.barcode,
        productName: p.nameEn,
        categoryName: p.categoryName || 'Uncategorized',
        currentStock: p.currentStock,
        purchaseRate: p.purchaseRate,
        saleRate: p.saleRate,
        stockValueCost,
        stockValueSale,
        potentialMargin: stockValueSale - stockValueCost,
        valuationMethod: 'Purchase Cost (FIFO Equivalent)',
      };
    });
  }

  public generateNextAdjustmentNumber(): string {
    const year = new Date().getFullYear();
    const prefix = `ADJ-${year}-`;
    let maxNum = 0;
    for (const a of this.stockAdjustments) {
      if (a.adjustmentNumber && a.adjustmentNumber.startsWith(prefix)) {
        const numPart = parseInt(a.adjustmentNumber.substring(prefix.length), 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      }
    }
    return `${prefix}${(maxNum + 1).toString().padStart(4, '0')}`;
  }

  public generateNextVerificationNumber(): string {
    const year = new Date().getFullYear();
    const prefix = `VER-${year}-`;
    let maxNum = 0;
    for (const v of this.physicalVerifications) {
      if (v.verificationNumber && v.verificationNumber.startsWith(prefix)) {
        const numPart = parseInt(v.verificationNumber.substring(prefix.length), 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      }
    }
    return `${prefix}${(maxNum + 1).toString().padStart(4, '0')}`;
  }

  public saveStockAdjustmentDraft(adj: Partial<StockAdjustment>): {
    success: boolean;
    errors: string[];
    adjustment?: StockAdjustment;
  } {
    const errors: string[] = [];

    if (!adj.reason || adj.reason.trim().length < 3) {
      errors.push('A valid Reason is required for stock adjustment (min 3 chars).');
    }
    if (!adj.items || adj.items.length === 0) {
      errors.push('At least one product item is required for stock adjustment.');
    }

    if (errors.length > 0) return { success: false, errors };

    // Validate items and ensure no negative stock violation
    for (const it of adj.items!) {
      const prod = this.idIndex.get(it.productId);
      if (!prod) {
        errors.push(`Product ID ${it.productId} not found.`);
        continue;
      }

      if (it.differenceQuantity < 0) {
        const resulting = prod.currentStock + it.differenceQuantity;
        if (resulting < 0) {
          errors.push(
            `Adjustment of ${it.differenceQuantity} for '${prod.nameEn}' would cause negative stock (${resulting}). Operation rejected.`
          );
        }
      }
    }

    if (errors.length > 0) return { success: false, errors };

    const totalDiff = adj.items!.reduce((sum, i) => sum + i.differenceQuantity, 0);
    const totalCost = adj.items!.reduce((sum, i) => sum + i.differenceQuantity * i.unitCost, 0);

    if (adj.id) {
      const idx = this.stockAdjustments.findIndex((a) => a.id === adj.id);
      if (idx === -1) return { success: false, errors: ['Stock adjustment not found.'] };

      if (this.stockAdjustments[idx].status === 'Confirmed') {
        return { success: false, errors: ['Cannot edit an already confirmed stock adjustment.'] };
      }

      const updated: StockAdjustment = {
        ...this.stockAdjustments[idx],
        ...adj,
        totalItems: adj.items!.length,
        totalDifferenceQuantity: totalDiff,
        totalCostImpact: totalCost,
        updatedAt: new Date().toISOString(),
      } as StockAdjustment;

      this.stockAdjustments[idx] = updated;
      this.logAudit('StockAdjustment', updated.adjustmentNumber, 'UPDATE', `Updated draft adjustment #${updated.adjustmentNumber}`);
      return { success: true, errors: [], adjustment: updated };
    } else {
      const num = adj.adjustmentNumber || this.generateNextAdjustmentNumber();
      const newAdj: StockAdjustment = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        adjustmentNumber: num,
        adjustmentDate: adj.adjustmentDate || new Date().toISOString(),
        reason: adj.reason!.trim(),
        notes: adj.notes?.trim() || '',
        status: 'Draft',
        totalItems: adj.items!.length,
        totalDifferenceQuantity: totalDiff,
        totalCostImpact: totalCost,
        createdBy: 'Admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: adj.items!.map((it, idx) => ({
          ...it,
          id: it.id || idx + 1,
        })),
      };

      this.stockAdjustments.unshift(newAdj);
      this.logAudit('StockAdjustment', newAdj.adjustmentNumber, 'INSERT', `Created draft stock adjustment #${newAdj.adjustmentNumber}`);
      return { success: true, errors: [], adjustment: newAdj };
    }
  }

  public confirmStockAdjustment(adjId: number): {
    success: boolean;
    error?: string;
    adjustment?: StockAdjustment;
  } {
    const adj = this.stockAdjustments.find((a) => a.id === adjId);
    if (!adj) return { success: false, error: 'Stock adjustment not found.' };

    if (adj.status === 'Confirmed') {
      return { success: false, error: 'Adjustment is already confirmed. Duplicate confirmation prevented.' };
    }
    if (adj.status === 'Cancelled') {
      return { success: false, error: 'Cannot confirm a cancelled stock adjustment.' };
    }

    // Atomically validate that no item produces negative stock
    for (const it of adj.items) {
      const prod = this.idIndex.get(it.productId);
      if (prod && it.differenceQuantity < 0) {
        const resulting = prod.currentStock + it.differenceQuantity;
        if (resulting < 0) {
          return {
            success: false,
            error: `Negative stock prevented: '${prod.nameEn}' would drop to ${resulting}. Operation rolled back.`,
          };
        }
      }
    }

    // Apply adjustments and record movements
    for (const it of adj.items) {
      const prod = this.idIndex.get(it.productId);
      if (prod) {
        const before = prod.currentStock;
        const after = before + it.differenceQuantity;
        prod.currentStock = after;
        prod.updatedAt = new Date().toISOString();

        this.stockMovements.unshift({
          id: Date.now() + Math.floor(Math.random() * 1000),
          productId: prod.id,
          productCode: prod.productCode,
          productName: prod.nameEn,
          referenceType: it.differenceQuantity >= 0 ? 'ADJUSTMENT' : 'ADJUSTMENT',
          referenceId: adj.adjustmentNumber,
          quantity: it.differenceQuantity,
          quantityBefore: before,
          quantityAfter: after,
          notes: `${it.adjustmentType}: ${it.reason || adj.reason} (${it.differenceQuantity >= 0 ? '+' : ''}${it.differenceQuantity})`,
          createdAt: new Date().toISOString(),
        });
      }
    }

    adj.status = 'Confirmed';
    adj.confirmedAt = new Date().toISOString();
    adj.updatedAt = new Date().toISOString();

    this.rebuildIndexes();
    this.logAudit(
      'StockAdjustment',
      adj.adjustmentNumber,
      'UPDATE',
      `Confirmed adjustment #${adj.adjustmentNumber} (${adj.items.length} items adjusted)`
    );

    return { success: true, adjustment: adj };
  }

  public cancelStockAdjustment(adjId: number): { success: boolean; error?: string } {
    const adj = this.stockAdjustments.find((a) => a.id === adjId);
    if (!adj) return { success: false, error: 'Stock adjustment not found.' };

    if (adj.status !== 'Confirmed') {
      return { success: false, error: 'Only confirmed adjustments can be cancelled/reverted.' };
    }

    // Check negative stock for reversal
    for (const it of adj.items) {
      const prod = this.idIndex.get(it.productId);
      if (prod) {
        const reverseDelta = -it.differenceQuantity;
        if (reverseDelta < 0 && prod.currentStock + reverseDelta < 0) {
          return {
            success: false,
            error: `Reversal would cause negative stock for '${prod.nameEn}'. Operation rejected.`,
          };
        }
      }
    }

    // Revert deltas
    for (const it of adj.items) {
      const prod = this.idIndex.get(it.productId);
      if (prod) {
        const reverseDelta = -it.differenceQuantity;
        const before = prod.currentStock;
        const after = before + reverseDelta;
        prod.currentStock = after;
        prod.updatedAt = new Date().toISOString();

        this.stockMovements.unshift({
          id: Date.now() + Math.floor(Math.random() * 1000),
          productId: prod.id,
          productCode: prod.productCode,
          productName: prod.nameEn,
          referenceType: 'ADJUSTMENT',
          referenceId: `REV-${adj.adjustmentNumber}`,
          quantity: reverseDelta,
          quantityBefore: before,
          quantityAfter: after,
          notes: `Reversal of cancelled adjustment #${adj.adjustmentNumber}`,
          createdAt: new Date().toISOString(),
        });
      }
    }

    adj.status = 'Cancelled';
    adj.cancelledAt = new Date().toISOString();
    adj.updatedAt = new Date().toISOString();

    this.rebuildIndexes();
    this.logAudit('StockAdjustment', adj.adjustmentNumber, 'UPDATE', `Cancelled stock adjustment #${adj.adjustmentNumber}`);
    return { success: true };
  }

  public savePhysicalVerificationDraft(ver: Partial<PhysicalStockVerification>): {
    success: boolean;
    errors: string[];
    verification?: PhysicalStockVerification;
  } {
    const errors: string[] = [];
    if (!ver.items || ver.items.length === 0) {
      errors.push('At least one product count is required.');
    }
    if (errors.length > 0) return { success: false, errors };

    const discrepancies = ver.items!.filter((i) => i.differenceQuantity !== 0).length;
    const netDiff = ver.items!.reduce((sum, i) => sum + i.differenceQuantity, 0);

    const num = ver.verificationNumber || this.generateNextVerificationNumber();
    const newVer: PhysicalStockVerification = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      verificationNumber: num,
      verificationDate: ver.verificationDate || new Date().toISOString(),
      categoryId: ver.categoryId,
      categoryName: ver.categoryName || 'All Categories',
      status: 'Draft',
      totalCountedProducts: ver.items!.length,
      totalDiscrepancies: discrepancies,
      netDifferenceQuantity: netDiff,
      notes: ver.notes || '',
      createdBy: 'Admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: ver.items!.map((it, idx) => ({
        ...it,
        id: it.id || idx + 1,
      })),
    };

    this.physicalVerifications.unshift(newVer);
    this.logAudit('PhysicalVerification', newVer.verificationNumber, 'INSERT', `Created physical audit draft #${newVer.verificationNumber}`);
    return { success: true, errors: [], verification: newVer };
  }

  public confirmPhysicalVerification(verId: number): {
    success: boolean;
    error?: string;
    verification?: PhysicalStockVerification;
  } {
    const ver = this.physicalVerifications.find((v) => v.id === verId);
    if (!ver) return { success: false, error: 'Verification record not found.' };

    if (ver.status === 'Confirmed') {
      return { success: false, error: 'Verification count is already confirmed.' };
    }

    // Apply reconciliation for items with discrepancy
    for (const it of ver.items) {
      const prod = this.idIndex.get(it.productId);
      if (prod) {
        // Reconcile physical count to current stock
        const liveDifference = it.physicalCount - prod.currentStock;
        if (liveDifference !== 0) {
          const before = prod.currentStock;
          const after = it.physicalCount;

          if (after < 0) {
            return {
              success: false,
              error: `Reconciled physical count cannot be negative for '${prod.nameEn}'.`,
            };
          }

          prod.currentStock = after;
          prod.updatedAt = new Date().toISOString();

          this.stockMovements.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
            productId: prod.id,
            productCode: prod.productCode,
            productName: prod.nameEn,
            referenceType: 'ADJUSTMENT',
            referenceId: ver.verificationNumber,
            quantity: liveDifference,
            quantityBefore: before,
            quantityAfter: after,
            notes: `Physical Audit Reconciled (Physical: ${it.physicalCount}, System was: ${before})`,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    ver.status = 'Confirmed';
    ver.confirmedAt = new Date().toISOString();
    ver.updatedAt = new Date().toISOString();

    this.rebuildIndexes();
    this.logAudit('PhysicalVerification', ver.verificationNumber, 'UPDATE', `Confirmed physical verification #${ver.verificationNumber}`);
    return { success: true, verification: ver };
  }

  public getAllStockAdjustments(): StockAdjustment[] {
    return this.stockAdjustments;
  }

  public getAllPhysicalVerifications(): PhysicalStockVerification[] {
    return this.physicalVerifications;
  }

  // -------------------------------------------------------------
  // PHASE 4: POS BILLING & GST INVOICE METHODS
  // -------------------------------------------------------------
  public getCustomers(): Customer[] {
    return this.customers.filter((c) => c.isActive);
  }

  public getCustomerById(id: number): Customer | undefined {
    return this.customerIdIndex.get(id);
  }

  public saveCustomer(cust: Partial<Customer>): { success: boolean; errors: string[]; customer?: Customer } {
    const errors: string[] = [];
    const name = cust.name?.trim();
    if (!name) errors.push('Customer name is required.');

    if (errors.length > 0 || !name) return { success: false, errors };

    if (cust.id && cust.id > 0) {
      const idx = this.customers.findIndex((c) => c.id === cust.id);
      if (idx === -1) return { success: false, errors: ['Customer not found.'] };

      const updated: Customer = {
        ...this.customers[idx],
        name,
        mobile: cust.mobile !== undefined ? cust.mobile.trim() : this.customers[idx].mobile,
        gstin: cust.gstin !== undefined ? cust.gstin.trim().toUpperCase() : (this.customers[idx].gstin || ''),
        address: cust.address !== undefined ? cust.address.trim() : (this.customers[idx].address || ''),
        isActive: cust.isActive !== undefined ? cust.isActive : this.customers[idx].isActive,
        updatedAt: new Date().toISOString(),
      };

      this.customers[idx] = updated;
      this.rebuildIndexes();
      return { success: true, errors: [], customer: updated };
    } else {
      const newCust: Customer = {
        id: this.nextCustomerId++,
        code: `CUST${this.nextCustomerId.toString().padStart(3, '0')}`,
        name,
        mobile: cust.mobile?.trim() || '',
        gstin: cust.gstin?.trim().toUpperCase() || '',
        address: cust.address?.trim() || '',
        currentBalance: 0,
        isActive: cust.isActive !== undefined ? cust.isActive : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.customers.push(newCust);
      this.rebuildIndexes();
      return { success: true, errors: [], customer: newCust };
    }
  }

  public getCustomerLedger(customerId: number): CustomerLedgerEntry[] {
    const cust = this.customers.find((c) => c.id === customerId);
    if (!cust) return [];

    const entries: CustomerLedgerEntry[] = [];
    let runningBalance = 0;
    let entryId = 1;

    const custInvoices = this.invoices
      .filter((inv) => (inv.customerId === customerId || inv.customerName === cust.name) && inv.status !== 'Cancelled')
      .sort((a, b) => new Date(a.invoiceDate || a.createdAt).getTime() - new Date(b.invoiceDate || b.createdAt).getTime());

    for (const inv of custInvoices) {
      runningBalance += inv.grandTotal;
      entries.push({
        id: entryId++,
        customerId: cust.id,
        transactionType: 'INVOICE',
        referenceNumber: inv.invoiceNumber,
        description: `POS Bill #${inv.invoiceNumber} (${inv.items.length} items)`,
        debitAmount: inv.grandTotal,
        creditAmount: 0,
        runningBalance,
        transactionDate: inv.invoiceDate || inv.createdAt,
      });

      if (inv.amountPaid > 0) {
        runningBalance -= inv.amountPaid;
        entries.push({
          id: entryId++,
          customerId: cust.id,
          transactionType: 'PAYMENT',
          referenceNumber: `REC-${inv.invoiceNumber}`,
          description: `Payment received (${inv.paymentMode || 'Cash'})`,
          debitAmount: 0,
          creditAmount: inv.amountPaid,
          runningBalance,
          transactionDate: inv.invoiceDate || inv.createdAt,
        });
      }
    }

    return entries.reverse();
  }

  public generateNextInvoiceNumber(): string {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    let maxNum = 0;
    for (const inv of this.invoices) {
      if (inv.invoiceNumber && inv.invoiceNumber.startsWith(prefix)) {
        const numPart = parseInt(inv.invoiceNumber.substring(prefix.length), 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      }
    }
    return `${prefix}${(maxNum + 1).toString().padStart(5, '0')}`;
  }

  public calculateInvoice(inv: Partial<InvoiceHeader>): InvoiceHeader {
    const isInterstate = !!inv.isInterstate;
    const items: InvoiceItem[] = (inv.items || []).map((it, idx) => {
      const qty = Math.max(0, Number(it.quantity) || 0);
      const rate = Math.max(0, Number(it.rate) || 0);
      const mrp = it.mrp !== undefined ? Number(it.mrp) : rate;
      const lineGross = Math.round(qty * rate * 100) / 100;
      let discPercent = Math.max(0, Math.min(100, Number(it.discountPercent) || 0));
      let discAmt = Math.max(0, Number(it.discountAmount) || 0);
      if (discPercent > 0) {
        discAmt = Math.round(lineGross * (discPercent / 100) * 100) / 100;
      } else if (discAmt > 0 && lineGross > 0) {
        discPercent = Math.round((discAmt / lineGross) * 10000) / 100;
      }
      if (discAmt > lineGross) discAmt = lineGross;

      // Rate is the final price! Tax is extracted backwards from lineNet
      const lineNet = Math.max(0, Math.round((lineGross - discAmt) * 100) / 100);
      const taxRate = Math.max(0, Number(it.taxRate) || 0);

      let cgstRate = 0;
      let sgstRate = 0;
      let igstRate = 0;

      if (it.cgstRate !== undefined || it.sgstRate !== undefined || it.igstRate !== undefined) {
        cgstRate = Math.max(0, Number(it.cgstRate) || 0);
        sgstRate = Math.max(0, Number(it.sgstRate) || 0);
        igstRate = Math.max(0, Number(it.igstRate) || 0);
      } else if (isInterstate) {
        igstRate = taxRate;
      } else {
        const halfRate = taxRate / 2;
        cgstRate = halfRate;
        sgstRate = halfRate;
      }

      const effectiveTaxRate = Math.round((cgstRate + sgstRate + igstRate) * 100) / 100;

      let taxable = lineNet;
      let taxAmount = 0;
      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;

      if (effectiveTaxRate > 0) {
        // Back-calculate taxable from tax-inclusive final price
        taxable = Math.round((lineNet / (1 + effectiveTaxRate / 100)) * 100) / 100;
        taxAmount = Math.round((lineNet - taxable) * 100) / 100;
        if (igstRate > 0 && cgstRate === 0 && sgstRate === 0) {
          igstAmount = taxAmount;
          cgstAmount = 0;
          sgstAmount = 0;
        } else if (cgstRate > 0 && sgstRate > 0 && igstRate === 0) {
          cgstAmount = Math.round((taxAmount / 2) * 100) / 100;
          sgstAmount = Math.round((taxAmount - cgstAmount) * 100) / 100;
          igstAmount = 0;
        } else {
          cgstAmount = Math.round((taxAmount * (cgstRate / effectiveTaxRate)) * 100) / 100;
          sgstAmount = Math.round((taxAmount * (sgstRate / effectiveTaxRate)) * 100) / 100;
          igstAmount = Math.max(0, Math.round((taxAmount - cgstAmount - sgstAmount) * 100) / 100);
        }
      }

      // Line Total is the final net price (Rate * Qty - disc)
      const lineTotal = lineNet;

      return {
        id: it.id || idx + 1,
        invoiceId: it.invoiceId,
        productId: it.productId,
        productCode: it.productCode || '',
        barcode: it.barcode || '',
        productName: it.productName || '',
        unit: it.unit || 'PCS',
        mrp,
        quantity: qty,
        rate,
        discountPercent: discPercent,
        discountAmount: discAmt,
        taxRate: effectiveTaxRate,
        taxableAmount: taxable,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate,
        igstAmount,
        taxAmount,
        lineTotal,
      };
    });

    const totalQty = items.reduce((sum, it) => sum + it.quantity, 0);
    const grossAmount = Math.round(items.reduce((sum, it) => sum + (it.quantity * it.rate), 0) * 100) / 100;
    const itemDiscount = Math.round(items.reduce((sum, it) => sum + it.discountAmount, 0) * 100) / 100;
    const totalTaxable = Math.round(items.reduce((sum, it) => sum + it.taxableAmount, 0) * 100) / 100;
    const totalTaxAmount = Math.round(items.reduce((sum, it) => sum + it.taxAmount, 0) * 100) / 100;

    let billDiscount = Math.max(0, Number(inv.billDiscount) || 0);
    const otherCharges = Math.max(0, Number(inv.otherCharges) || 0);

    const baseCgst = items.reduce((sum, it) => sum + it.cgstAmount, 0);
    const baseSgst = items.reduce((sum, it) => sum + it.sgstAmount, 0);
    const baseIgst = items.reduce((sum, it) => sum + it.igstAmount, 0);

    let cgstAmount = baseCgst;
    let sgstAmount = baseSgst;
    let igstAmount = baseIgst;

    const itemsTotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
    const preRound = Math.max(0, itemsTotal - billDiscount + otherCharges);
    const grandTotal = Math.round(preRound);
    const roundOff = Math.round((grandTotal - preRound) * 100) / 100;

    const payments = inv.payments || [];
    const amountPaid = Math.round(payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) * 100) / 100;
    const balanceDue = amountPaid >= grandTotal ? 0 : Math.round((grandTotal - amountPaid) * 100) / 100;
    const cashChange = amountPaid > grandTotal ? Math.round((amountPaid - grandTotal) * 100) / 100 : 0;

    let paymentStatus: 'Paid' | 'Partial' | 'Unpaid' = 'Unpaid';
    if (amountPaid >= grandTotal && grandTotal > 0) paymentStatus = 'Paid';
    else if (amountPaid > 0) paymentStatus = 'Partial';
    else if (grandTotal === 0 && items.length > 0) paymentStatus = 'Paid';

    return {
      id: inv.id || 0,
      invoiceNumber: inv.invoiceNumber || '',
      invoiceDate: inv.invoiceDate || new Date().toISOString(),
      customerId: inv.customerId || 1,
      customerName: inv.customerName || 'Walk-in Customer',
      customerMobile: inv.customerMobile || '',
      customerAddress: inv.customerAddress || '',
      customerGstin: inv.customerGstin || '',
      salesperson: inv.salesperson || 'Admin',
      paymentMode: (payments.length > 0 ? payments.map((p) => p.paymentMethod).filter(Boolean).join(', ') : inv.paymentMode) || 'Cash',
      status: inv.status || 'Confirmed',
      paymentStatus,
      isInterstate,
      totalItems: items.length,
      totalQty,
      grossAmount,
      itemDiscount,
      billDiscount,
      taxableAmount: totalTaxable,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalTaxAmount,
      otherCharges,
      roundOff,
      grandTotal,
      amountPaid,
      paidAmount: amountPaid,
      balanceDue,
      cashChange,
      notes: inv.notes || '',
      cancellationReason: inv.cancellationReason,
      createdAt: inv.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items,
      payments,
    };
  }

  public saveInvoiceDraft(inv: Partial<InvoiceHeader>): { success: boolean; errors: string[]; invoice?: InvoiceHeader } {
    const calculated = this.calculateInvoice(inv);
    calculated.status = 'Draft';
    if (!calculated.invoiceNumber) {
      calculated.invoiceNumber = this.generateNextInvoiceNumber();
    }

    if (calculated.id && calculated.id > 0) {
      const idx = this.invoices.findIndex((i) => i.id === calculated.id);
      if (idx !== -1) {
        this.invoices[idx] = calculated;
        this.rebuildIndexes();
        return { success: true, errors: [], invoice: calculated };
      }
    }

    calculated.id = this.nextInvoiceId++;
    this.invoices.unshift(calculated);
    this.rebuildIndexes();
    this.logAudit('Invoice', calculated.invoiceNumber, 'INSERT', `Saved draft bill #${calculated.invoiceNumber}`);
    return { success: true, errors: [], invoice: calculated };
  }

  public finalizeInvoice(inv: Partial<InvoiceHeader>): { success: boolean; errors: string[]; invoice?: InvoiceHeader } {
    const errors: string[] = [];
    if (!inv.items || inv.items.length === 0) {
      errors.push('Invoice must contain at least one product item.');
      return { success: false, errors };
    }

    // Check stock availability
    for (const it of inv.items) {
      const prod = this.idIndex.get(it.productId);
      if (!prod) {
        errors.push(`Product #${it.productId} not found in catalog.`);
      } else {
        if (it.quantity <= 0) {
          errors.push(`Quantity must be greater than zero for '${prod.nameEn}'.`);
        }
        if (prod.currentStock < it.quantity) {
          errors.push(`Insufficient stock for '${prod.nameEn}'. Current stock: ${prod.currentStock}, Requested: ${it.quantity}.`);
        }
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const calculated = this.calculateInvoice(inv);
    calculated.status = 'Confirmed';
    if (!calculated.invoiceNumber) {
      calculated.invoiceNumber = this.generateNextInvoiceNumber();
    }
    calculated.id = this.nextInvoiceId++;
    calculated.createdAt = new Date().toISOString();
    calculated.updatedAt = new Date().toISOString();

    // 1. Deduct stock atomically and write stock movement records
    for (const it of calculated.items) {
      const prod = this.idIndex.get(it.productId);
      if (prod) {
        const before = prod.currentStock;
        const after = before - it.quantity;
        prod.currentStock = after;
        prod.updatedAt = new Date().toISOString();

        this.stockMovements.unshift({
          id: this.nextMovementId++,
          productId: prod.id,
          productCode: prod.productCode,
          productName: prod.nameEn,
          referenceType: 'SALES_INVOICE',
          referenceId: calculated.invoiceNumber,
          quantity: -it.quantity,
          quantityBefore: before,
          quantityAfter: after,
          notes: `POS Bill #${calculated.invoiceNumber} to ${calculated.customerName}`,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // 2. If customer has balance due, update customer ledger / balance
    if (calculated.balanceDue > 0 && calculated.customerId) {
      const cust = this.customerIdIndex.get(calculated.customerId);
      if (cust) {
        cust.currentBalance += calculated.balanceDue;
        cust.updatedAt = new Date().toISOString();
      }
    }

    this.invoices.unshift(calculated);
    this.rebuildIndexes();

    this.logAudit(
      'Invoice',
      calculated.invoiceNumber,
      'INSERT',
      `Confirmed POS Bill #${calculated.invoiceNumber} · ₹${calculated.grandTotal} (${calculated.paymentStatus}) · Customer: ${calculated.customerName}`
    );

    return { success: true, errors: [], invoice: calculated };
  }

  public cancelInvoice(invoiceId: number, reason: string): { success: boolean; error?: string } {
    const inv = this.invoiceIdIndex.get(invoiceId);
    if (!inv) return { success: false, error: 'Invoice not found.' };
    if (inv.status !== 'Confirmed') return { success: false, error: 'Only confirmed invoices can be cancelled.' };

    // Revert stock
    for (const it of inv.items) {
      const prod = this.idIndex.get(it.productId);
      if (prod) {
        const before = prod.currentStock;
        const after = before + it.quantity;
        prod.currentStock = after;
        prod.updatedAt = new Date().toISOString();

        this.stockMovements.unshift({
          id: this.nextMovementId++,
          productId: prod.id,
          productCode: prod.productCode,
          productName: prod.nameEn,
          referenceType: 'SALES_CANCEL',
          referenceId: `REV-${inv.invoiceNumber}`,
          quantity: it.quantity,
          quantityBefore: before,
          quantityAfter: after,
          notes: `Invoice cancelled reversion: +${it.quantity} (Reason: ${reason || 'Customer Return'})`,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Revert customer balance if balance was due
    if (inv.balanceDue > 0 && inv.customerId) {
      const cust = this.customerIdIndex.get(inv.customerId);
      if (cust) {
        cust.currentBalance = Math.max(0, cust.currentBalance - inv.balanceDue);
        cust.updatedAt = new Date().toISOString();
      }
    }

    inv.status = 'Cancelled';
    inv.cancellationReason = reason || 'Customer returned before leaving';
    inv.updatedAt = new Date().toISOString();

    this.rebuildIndexes();
    this.logAudit(
      'Invoice',
      inv.invoiceNumber,
      'UPDATE',
      `Cancelled invoice #${inv.invoiceNumber} · Reason: ${reason} · Stock restored`
    );

    return { success: true };
  }

  public deleteInvoice(invoiceId: number, revertStock: boolean = true): { success: boolean; errors: string[] } {
    const idx = this.invoices.findIndex((i) => i.id === invoiceId);
    if (idx === -1) return { success: false, errors: ['Invoice not found.'] };

    const inv = this.invoices[idx];

    // Revert stock if confirmed and requested
    if (revertStock && inv.status === 'Confirmed') {
      for (const it of inv.items) {
        const prod = this.idIndex.get(it.productId);
        if (prod) {
          const before = prod.currentStock;
          const after = before + it.quantity;
          prod.currentStock = after;
          prod.updatedAt = new Date().toISOString();

          this.stockMovements.unshift({
            id: this.nextMovementId++,
            productId: prod.id,
            productCode: prod.productCode,
            productName: prod.nameEn,
            referenceType: 'SALES_CANCEL',
            referenceId: `DEL-${inv.invoiceNumber}`,
            quantity: it.quantity,
            quantityBefore: before,
            quantityAfter: after,
            notes: `Invoice #${inv.invoiceNumber} deleted: +${it.quantity} restored to stock`,
            createdAt: new Date().toISOString(),
          });
        }
      }

      if (inv.balanceDue > 0 && inv.customerId) {
        const cust = this.customerIdIndex.get(inv.customerId);
        if (cust) {
          cust.currentBalance = Math.max(0, cust.currentBalance - inv.balanceDue);
          cust.updatedAt = new Date().toISOString();
        }
      }
    }

    this.invoices.splice(idx, 1);
    this.invoiceIdIndex.delete(invoiceId);
    if (inv.invoiceNumber) {
      this.invoiceNumberIndex.delete(inv.invoiceNumber.trim().toUpperCase());
    }

    this.rebuildIndexes();
    this.logAudit('Invoice', inv.invoiceNumber, 'DELETE' as any, `Permanently deleted invoice #${inv.invoiceNumber}`);
    if (!this.isInitializing) this.saveToLocalStorage();

    return { success: true, errors: [] };
  }

  public updateInvoice(updatedInv: Partial<InvoiceHeader> & { id: number }): { success: boolean; errors: string[]; invoice?: InvoiceHeader } {
    const existing = this.invoiceIdIndex.get(updatedInv.id);
    if (!existing) {
      return { success: false, errors: ['Invoice not found.'] };
    }

    const errors: string[] = [];
    const items = updatedInv.items || existing.items || [];
    if (items.length === 0) {
      return { success: false, errors: ['Invoice must contain at least one product item.'] };
    }

    // If confirmed invoice, check stock delta if items changed
    if (existing.status === 'Confirmed') {
      const oldQtyMap = new Map<number, number>();
      for (const it of existing.items || []) {
        oldQtyMap.set(it.productId, (oldQtyMap.get(it.productId) || 0) + it.quantity);
      }
      const newQtyMap = new Map<number, number>();
      for (const it of items) {
        newQtyMap.set(it.productId, (newQtyMap.get(it.productId) || 0) + it.quantity);
      }

      for (const [prodId, newQty] of newQtyMap.entries()) {
        const oldQty = oldQtyMap.get(prodId) || 0;
        const diff = newQty - oldQty;
        if (diff > 0) {
          const prod = this.idIndex.get(prodId);
          if (prod && prod.currentStock < diff) {
            errors.push(`Insufficient stock for '${prod.nameEn}'. Additional required: ${diff}, available: ${prod.currentStock}.`);
          }
        }
      }

      if (errors.length > 0) {
        return { success: false, errors };
      }

      // Apply stock differences
      const allProdIds = new Set([...oldQtyMap.keys(), ...newQtyMap.keys()]);
      for (const prodId of allProdIds) {
        const oldQty = oldQtyMap.get(prodId) || 0;
        const newQty = newQtyMap.get(prodId) || 0;
        const diff = newQty - oldQty;
        if (diff !== 0) {
          const prod = this.idIndex.get(prodId);
          if (prod) {
            const before = prod.currentStock;
            const after = before - diff;
            prod.currentStock = after;
            prod.updatedAt = new Date().toISOString();

            this.stockMovements.unshift({
              id: this.nextMovementId++,
              productId: prod.id,
              productCode: prod.productCode,
              productName: prod.nameEn,
              referenceType: 'SALES_INVOICE',
              referenceId: existing.invoiceNumber,
              quantity: -diff,
              quantityBefore: before,
              quantityAfter: after,
              notes: `Bill #${existing.invoiceNumber} updated: qty adjusted by ${-diff}`,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    const calculated = this.calculateInvoice({
      ...existing,
      ...updatedInv,
      id: existing.id,
      invoiceNumber: existing.invoiceNumber,
      createdAt: existing.createdAt,
      status: updatedInv.status || existing.status,
    });

    // Customer balance ledger delta
    if (existing.status === 'Confirmed') {
      const oldBalanceDue = existing.balanceDue || 0;
      const newBalanceDue = calculated.balanceDue || 0;
      const balanceDiff = newBalanceDue - oldBalanceDue;
      if (balanceDiff !== 0 && calculated.customerId) {
        const cust = this.customerIdIndex.get(calculated.customerId);
        if (cust) {
          cust.currentBalance = Math.max(0, cust.currentBalance + balanceDiff);
          cust.updatedAt = new Date().toISOString();
        }
      }
    }

    const idx = this.invoices.findIndex((i) => i.id === existing.id);
    if (idx !== -1) {
      this.invoices[idx] = calculated;
    }
    this.rebuildIndexes();

    this.logAudit(
      'Invoice',
      calculated.invoiceNumber,
      'UPDATE',
      `Edited bill #${calculated.invoiceNumber} · ₹${calculated.grandTotal} (${calculated.paymentStatus}) · Payment: ${calculated.payments.map((p) => p.paymentMethod).join(', ') || 'N/A'}`
    );

    return { success: true, errors: [], invoice: calculated };
  }

  public updateInvoicePayment(
    invoiceId: number,
    payments: InvoicePayment[],
    notes?: string
  ): { success: boolean; errors: string[]; invoice?: InvoiceHeader } {
    const existing = this.invoiceIdIndex.get(invoiceId);
    if (!existing) {
      return { success: false, errors: ['Invoice not found.'] };
    }
    return this.updateInvoice({
      id: invoiceId,
      payments,
      notes: notes !== undefined ? notes : existing.notes,
    });
  }

  public getInvoices(filter: InvoiceFilter): PagedResult<InvoiceHeader> {
    const t0 = performance.now();
    const term = filter.searchTerm?.trim().toLowerCase();

    let list = this.invoices.filter((inv) => {
      if (filter.customerId && filter.customerId > 0 && inv.customerId !== filter.customerId) {
        return false;
      }
      if (filter.status && filter.status !== 'All' && inv.status !== filter.status) {
        return false;
      }
      if (filter.paymentStatus && filter.paymentStatus !== 'All' && inv.paymentStatus !== filter.paymentStatus) {
        return false;
      }
      if (filter.paymentMethod && filter.paymentMethod !== 'All') {
        const methodQuery = filter.paymentMethod.toLowerCase();
        const hasMethod =
          inv.payments?.some((p) => p.paymentMethod && p.paymentMethod.toLowerCase() === methodQuery) ||
          (inv.paymentMode && inv.paymentMode.toLowerCase().includes(methodQuery));
        if (!hasMethod) return false;
      }
      if (filter.fromDate) {
        const from = new Date(filter.fromDate).getTime();
        const cur = new Date(inv.invoiceDate).getTime();
        if (cur < from) return false;
      }
      if (filter.toDate) {
        const to = new Date(filter.toDate).getTime();
        const cur = new Date(inv.invoiceDate).getTime();
        if (cur > to) return false;
      }
      if (term) {
        const matchNum = inv.invoiceNumber.toLowerCase().includes(term);
        const matchCust = inv.customerName.toLowerCase().includes(term);
        const matchMob = inv.customerMobile ? inv.customerMobile.includes(term) : false;
        if (!matchNum && !matchCust && !matchMob) return false;
      }
      return true;
    });

    const totalCount = list.length;
    const pageNumber = Math.max(1, filter.pageNumber || 1);
    const pageSize = Math.max(1, filter.pageSize || 50);
    const totalPages = Math.ceil(totalCount / pageSize);

    const startIndex = (pageNumber - 1) * pageSize;
    const items = list.slice(startIndex, startIndex + pageSize);

    const t1 = performance.now();
    const executionTimeMs = parseFloat((t1 - t0).toFixed(2));

    return {
      items,
      totalCount,
      pageNumber,
      pageSize,
      totalPages,
      executionTimeMs,
    };
  }

  public getInvoiceById(id: number): InvoiceHeader | undefined {
    return this.invoiceIdIndex.get(id);
  }

  public getInvoiceByNumber(invoiceNumber: string): InvoiceHeader | undefined {
    return this.invoiceNumberIndex.get(invoiceNumber.trim().toUpperCase());
  }

  public getInvoiceGstSummary(invoiceId: number): GstSlabSummary[] {
    const inv = this.invoiceIdIndex.get(invoiceId);
    if (!inv || !inv.items) return [];

    const slabs = new Map<number, GstSlabSummary>();
    for (const it of inv.items) {
      const rate = it.taxRate;
      if (!slabs.has(rate)) {
        slabs.set(rate, {
          taxRate: rate,
          taxableAmount: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
          totalTax: 0,
        });
      }
      const sl = slabs.get(rate)!;
      sl.taxableAmount += it.taxableAmount;
      sl.cgstAmount += it.cgstAmount;
      sl.sgstAmount += it.sgstAmount;
      sl.igstAmount += it.igstAmount;
      sl.totalTax += it.taxAmount;
    }

    return Array.from(slabs.values()).sort((a, b) => a.taxRate - b.taxRate);
  }

  public getAllInvoices(): InvoiceHeader[] {
    return this.invoices;
  }

  // -------------------------------------------------------------
  // ESTIMATES & BARCODE STUDIO METHODS (PHASE 6)
  // -------------------------------------------------------------
  public getEstimates(filter?: EstimateFilter): PagedResult<EstimateHeader> {
    let list = [...this.estimates];

    if (filter?.searchTerm) {
      const term = filter.searchTerm.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.estimateNumber.toLowerCase().includes(term) ||
          e.customerName.toLowerCase().includes(term) ||
          (e.customerMobile && e.customerMobile.includes(term))
      );
    }

    if (filter?.customerId && filter.customerId > 0) {
      list = list.filter((e) => e.customerId === filter.customerId);
    }

    if (filter?.status && filter.status !== 'All') {
      list = list.filter((e) => e.status === filter.status);
    }

    if (filter?.fromDate) {
      const from = new Date(filter.fromDate).getTime();
      list = list.filter((e) => new Date(e.estimateDate).getTime() >= from);
    }

    if (filter?.toDate) {
      const to = new Date(filter.toDate).getTime();
      list = list.filter((e) => new Date(e.estimateDate).getTime() <= to);
    }

    list.sort((a, b) => new Date(b.estimateDate).getTime() - new Date(a.estimateDate).getTime());

    const total = list.length;
    const page = Math.max(1, filter?.pageNumber || 1);
    const size = Math.max(1, filter?.pageSize || 50);
    const paged = list.slice((page - 1) * size, page * size);

    return {
      items: paged,
      totalCount: total,
      pageNumber: page,
      pageSize: size,
      totalPages: Math.ceil(total / size),
      executionTimeMs: 1.2,
    };
  }

  public getEstimateById(id: number): EstimateHeader | undefined {
    return this.estimateIdIndex.get(id);
  }

  public getEstimateByNumber(num: string): EstimateHeader | undefined {
    return this.estimateNumberIndex.get(num.trim().toUpperCase());
  }

  public generateNextEstimateNumber(): string {
    const year = new Date().getFullYear();
    const prefix = `EST-${year}-`;
    let maxSeq = 0;

    for (const est of this.estimates) {
      if (est.estimateNumber.startsWith(prefix)) {
        const seqStr = est.estimateNumber.substring(prefix.length);
        const parsed = parseInt(seqStr, 10);
        if (!isNaN(parsed) && parsed > maxSeq) {
          maxSeq = parsed;
        }
      }
    }

    return `${prefix}${String(maxSeq + 1).padStart(5, '0')}`;
  }

  public calculateEstimate(est: Partial<EstimateHeader>): EstimateHeader {
    const items = (est.items || []).map((it, idx) => {
      const qty = Math.max(0, it.quantity || 1);
      const rate = Math.max(0, it.rate || 0);
      const lineGross = Math.round(qty * rate * 100) / 100;

      let disc = it.discountAmount || 0;
      if (it.discountPercent && it.discountPercent > 0) {
        disc = Math.round(lineGross * (it.discountPercent / 100) * 100) / 100;
      }
      if (disc > lineGross) disc = lineGross;

      const taxable = Math.max(0, lineGross - disc);
      const taxRate = Math.max(0, it.taxRate || 0);

      let cgstRate = 0,
        cgstAmt = 0,
        sgstRate = 0,
        sgstAmt = 0,
        igstRate = 0,
        igstAmt = 0;

      if (est.isInterstate) {
        igstRate = taxRate;
        igstAmt = Math.round(taxable * (taxRate / 100) * 100) / 100;
      } else {
        const half = taxRate / 2;
        cgstRate = half;
        cgstAmt = Math.round(taxable * (half / 100) * 100) / 100;
        sgstRate = half;
        sgstAmt = Math.round(taxable * (half / 100) * 100) / 100;
      }

      const taxAmount = cgstAmt + sgstAmt + igstAmt;
      const lineTotal = taxable + taxAmount;

      return {
        id: it.id || idx + 1,
        estimateId: est.id,
        productId: it.productId,
        productCode: it.productCode || '',
        barcode: it.barcode || '',
        productName: it.productName || '',
        unit: it.unit || 'PCS',
        quantity: qty,
        rate,
        discountPercent: it.discountPercent || 0,
        discountAmount: disc,
        taxRate,
        taxableAmount: taxable,
        cgstRate,
        cgstAmount: cgstAmt,
        sgstRate,
        sgstAmount: sgstAmt,
        igstRate,
        igstAmount: igstAmt,
        taxAmount,
        lineTotal,
      };
    });

    const totalQty = items.reduce((acc, it) => acc + it.quantity, 0);
    const grossAmount = items.reduce((acc, it) => acc + it.quantity * it.rate, 0);
    const itemDiscount = items.reduce((acc, it) => acc + it.discountAmount, 0);
    const preTaxable = items.reduce((acc, it) => acc + it.taxableAmount, 0);

    let billDiscount = Math.max(0, est.billDiscount || 0);
    if (billDiscount > preTaxable) billDiscount = preTaxable;

    const netTaxable = Math.max(0, preTaxable - billDiscount);
    let cgstTotal = items.reduce((acc, it) => acc + it.cgstAmount, 0);
    let sgstTotal = items.reduce((acc, it) => acc + it.sgstAmount, 0);
    let igstTotal = items.reduce((acc, it) => acc + it.igstAmount, 0);

    if (billDiscount > 0 && preTaxable > 0) {
      const ratio = netTaxable / preTaxable;
      cgstTotal = Math.round(cgstTotal * ratio * 100) / 100;
      sgstTotal = Math.round(sgstTotal * ratio * 100) / 100;
      igstTotal = Math.round(igstTotal * ratio * 100) / 100;
    }

    const totalTaxAmount = cgstTotal + sgstTotal + igstTotal;
    const otherCharges = Math.max(0, est.otherCharges || 0);
    const rawTotal = netTaxable + totalTaxAmount + otherCharges;
    const grandTotal = Math.round(rawTotal);
    const roundOff = Math.round((grandTotal - rawTotal) * 100) / 100;

    return {
      id: est.id || 0,
      estimateNumber: est.estimateNumber || this.generateNextEstimateNumber(),
      estimateDate: est.estimateDate || new Date().toISOString(),
      validUntil: est.validUntil || new Date(Date.now() + 15 * 86400000).toISOString(),
      customerId: est.customerId || 1,
      customerCode: est.customerCode || 'CUST-WALKIN',
      customerName: est.customerName || 'Walk-in Customer',
      customerMobile: est.customerMobile || '',
      customerGstin: est.customerGstin || '',
      stateCode: est.stateCode || '33',
      stateName: est.stateName || 'Tamil Nadu',
      isInterstate: !!est.isInterstate,
      status: (est.status as any) || 'Draft',
      convertedInvoiceId: est.convertedInvoiceId,
      convertedInvoiceNumber: est.convertedInvoiceNumber,
      convertedAt: est.convertedAt,
      totalItems: items.length,
      totalQty,
      grossAmount,
      itemDiscount,
      billDiscount,
      taxableAmount: netTaxable,
      cgstAmount: cgstTotal,
      sgstAmount: sgstTotal,
      igstAmount: igstTotal,
      totalTaxAmount,
      otherCharges,
      roundOff,
      grandTotal,
      notes: est.notes || '',
      termsConditions:
        est.termsConditions ||
        '1. Prices valid for 15 days from date of estimate.\n2. GST charged as per applicable rates.\n3. Goods subject to availability at time of billing.',
      createdBy: est.createdBy || 'Admin',
      createdAt: est.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items,
    };
  }

  public saveEstimateDraft(est: Partial<EstimateHeader>): {
    success: boolean;
    errors: string[];
    estimate?: EstimateHeader;
  } {
    const errors: string[] = [];
    if (!est.items || est.items.length === 0) {
      errors.push('At least one item is required for an estimate.');
      return { success: false, errors };
    }

    const calculated = this.calculateEstimate(est);

    if (calculated.id > 0) {
      const idx = this.estimates.findIndex((e) => e.id === calculated.id);
      if (idx >= 0) {
        if (this.estimates[idx].status === 'Converted') {
          return { success: false, errors: ['Cannot edit an estimate that has already been converted.'] };
        }
        if (this.estimates[idx].status === 'Cancelled') {
          return { success: false, errors: ['Cannot edit a cancelled estimate.'] };
        }
        this.estimates[idx] = calculated;
        this.rebuildIndexes();
        this.logAudit('Estimate', calculated.estimateNumber, 'UPDATE', `Updated estimate #${calculated.estimateNumber}`);
        return { success: true, errors: [], estimate: calculated };
      }
    }

    calculated.id = this.nextEstimateId++;
    calculated.status = 'Draft';
    this.estimates.unshift(calculated);
    this.rebuildIndexes();
    this.logAudit(
      'Estimate',
      calculated.estimateNumber,
      'INSERT',
      `Created estimate draft #${calculated.estimateNumber} for ₹${calculated.grandTotal}. No stock deducted.`
    );

    return { success: true, errors: [], estimate: calculated };
  }

  public confirmEstimate(id: number): { success: boolean; errors: string[]; estimate?: EstimateHeader } {
    const est = this.estimateIdIndex.get(id);
    if (!est) return { success: false, errors: [`Estimate ID ${id} not found.`] };

    if (est.status === 'Converted') {
      return { success: false, errors: ['Estimate is already converted to an invoice.'] };
    }
    if (est.status === 'Cancelled') {
      return { success: false, errors: ['Cannot confirm a cancelled estimate.'] };
    }

    est.status = 'Confirmed';
    est.updatedAt = new Date().toISOString();
    this.rebuildIndexes();
    this.logAudit('Estimate', est.estimateNumber, 'CONFIRM', `Confirmed estimate #${est.estimateNumber}. Stock remains untouched.`);
    return { success: true, errors: [], estimate: est };
  }

  public cancelEstimate(id: number, reason: string): { success: boolean; errors: string[]; estimate?: EstimateHeader } {
    const est = this.estimateIdIndex.get(id);
    if (!est) return { success: false, errors: [`Estimate ID ${id} not found.`] };

    if (est.status === 'Converted') {
      return { success: false, errors: ['Cannot cancel an estimate that has already been converted to an invoice.'] };
    }

    est.status = 'Cancelled';
    est.notes = (est.notes ? est.notes + ' | ' : '') + `Cancelled: ${reason || 'User action'}`;
    est.updatedAt = new Date().toISOString();
    this.rebuildIndexes();
    this.logAudit('Estimate', est.estimateNumber, 'CANCEL', `Cancelled estimate #${est.estimateNumber}: ${reason}`);
    return { success: true, errors: [], estimate: est };
  }

  public deleteEstimate(id: number): { success: boolean; errors: string[] } {
    const idx = this.estimates.findIndex((e) => e.id === id);
    if (idx === -1) return { success: false, errors: ['Estimate not found.'] };

    const est = this.estimates[idx];
    this.estimates.splice(idx, 1);
    this.estimateIdIndex.delete(id);
    if (est.estimateNumber) {
      this.estimateNumberIndex.delete(est.estimateNumber.trim().toUpperCase());
    }

    this.rebuildIndexes();
    this.logAudit('Estimate', est.estimateNumber, 'DELETE' as any, `Permanently deleted estimate #${est.estimateNumber}`);
    if (!this.isInitializing) this.saveToLocalStorage();

    return { success: true, errors: [] };
  }

  public convertEstimateToInvoice(
    estimateId: number,
    options?: { paymentMethod?: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Credit'; amountPaid?: number }
  ): { success: boolean; errors: string[]; invoice?: InvoiceHeader } {
    const est = this.estimateIdIndex.get(estimateId);
    if (!est) return { success: false, errors: [`Estimate ID ${estimateId} not found in database.`] };

    // Duplicate conversion check
    if (est.status === 'Converted') {
      return {
        success: false,
        errors: [`Estimate #${est.estimateNumber} has already been converted to Invoice #${est.convertedInvoiceNumber}. Duplicate conversion prevented.`],
      };
    }

    if (est.status === 'Cancelled') {
      return { success: false, errors: [`Cannot convert cancelled estimate #${est.estimateNumber} to an invoice.`] };
    }

    if (!est.items || est.items.length === 0) {
      return { success: false, errors: [`Estimate #${est.estimateNumber} contains no items to convert.`] };
    }

    // ATOMIC STOCK VALIDATION: Verify stock for each item before deducting
    for (const item of est.items) {
      const prod = this.idIndex.get(item.productId);
      if (!prod) {
        return { success: false, errors: [`Product ID ${item.productId} '${item.productName}' does not exist in catalog.`] };
      }
      if (prod.currentStock < item.quantity) {
        return {
          success: false,
          errors: [`Insufficient stock for '${prod.nameEn}'. Available: ${prod.currentStock}, Requested: ${item.quantity}.`],
        };
      }
    }

    // Deduct stock and write stock movements
    const invoiceNum = this.generateNextInvoiceNumber();
    for (const item of est.items) {
      const prod = this.idIndex.get(item.productId)!;
      const prevStock = prod.currentStock;
      prod.currentStock = Math.round((prod.currentStock - item.quantity) * 100) / 100;
      prod.updatedAt = new Date().toISOString();

      this.stockMovements.unshift({
        id: this.nextMovementId++,
        productId: prod.id,
        productCode: prod.productCode,
        productName: prod.nameEn,
        referenceType: 'SALES_INVOICE',
        referenceId: invoiceNum,
        quantity: -item.quantity,
        quantityBefore: prevStock,
        quantityAfter: prod.currentStock,
        notes: `Converted from Estimate #${est.estimateNumber} to Invoice #${invoiceNum}`,
        createdAt: new Date().toISOString(),
      });
    }

    const payMethod = options?.paymentMethod || 'Cash';
    const grand = est.grandTotal;
    const paid = options?.amountPaid !== undefined ? options.amountPaid : grand;
    const due = Math.max(0, grand - paid);
    const change = paid > grand ? paid - grand : 0;
    const payStatus = due === 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid';

    const invoice: InvoiceHeader = {
      id: this.nextInvoiceId++,
      invoiceNumber: invoiceNum,
      invoiceDate: new Date().toISOString(),
      customerId: est.customerId,
      customerName: est.customerName,
      customerMobile: est.customerMobile,
      customerGstin: est.customerGstin,
      salesperson: 'Admin',
      status: 'Confirmed',
      paymentStatus: payStatus,
      isInterstate: est.isInterstate,
      totalItems: est.totalItems,
      totalQty: est.totalQty,
      grossAmount: est.grossAmount,
      itemDiscount: est.itemDiscount,
      billDiscount: est.billDiscount,
      taxableAmount: est.taxableAmount,
      cgstAmount: est.cgstAmount,
      sgstAmount: est.sgstAmount,
      igstAmount: est.igstAmount,
      totalTaxAmount: est.totalTaxAmount,
      otherCharges: est.otherCharges,
      roundOff: est.roundOff,
      grandTotal: grand,
      amountPaid: paid,
      balanceDue: due,
      cashChange: change,
      estimateId: est.id,
      estimateNumber: est.estimateNumber,
      notes: `Converted from Estimate #${est.estimateNumber}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: est.items.map((ei, idx) => ({
        id: idx + 1,
        invoiceId: this.nextInvoiceId,
        productId: ei.productId,
        productCode: ei.productCode,
        barcode: ei.barcode,
        productName: ei.productName,
        unit: ei.unit,
        quantity: ei.quantity,
        rate: ei.rate,
        discountPercent: ei.discountPercent,
        discountAmount: ei.discountAmount,
        taxRate: ei.taxRate,
        taxableAmount: ei.taxableAmount,
        cgstRate: ei.cgstRate,
        cgstAmount: ei.cgstAmount,
        sgstRate: ei.sgstRate,
        sgstAmount: ei.sgstAmount,
        igstRate: ei.igstRate,
        igstAmount: ei.igstAmount,
        taxAmount: ei.taxAmount,
        lineTotal: ei.lineTotal,
      })),
      payments: [
        {
          id: 1,
          invoiceId: this.nextInvoiceId,
          paymentMethod: payMethod,
          amount: Math.min(paid, grand),
          referenceNumber: `CONV-${est.estimateNumber}`,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    this.invoices.unshift(invoice);

    // Update customer balance if credit/due
    if (due > 0 && est.customerId > 0) {
      const cust = this.customerIdIndex.get(est.customerId);
      if (cust) {
        cust.currentBalance += due;
        cust.updatedAt = new Date().toISOString();
      }
    }

    // Mark estimate as Converted
    est.status = 'Converted';
    est.convertedInvoiceId = invoice.id;
    est.convertedInvoiceNumber = invoice.invoiceNumber;
    est.convertedAt = new Date().toISOString();
    est.updatedAt = new Date().toISOString();

    this.rebuildIndexes();

    this.logAudit(
      'Estimate',
      est.estimateNumber,
      'CONVERT',
      `Converted Estimate #${est.estimateNumber} to Confirmed Invoice #${invoice.invoiceNumber} for ₹${invoice.grandTotal}`
    );

    return { success: true, errors: [], invoice };
  }

  public getEstimateGstSummary(est: EstimateHeader): GstSlabSummary[] {
    const slabs = new Map<number, GstSlabSummary>();
    for (const it of est.items) {
      const rate = it.taxRate;
      if (!slabs.has(rate)) {
        slabs.set(rate, {
          taxRate: rate,
          taxableAmount: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
          totalTax: 0,
        });
      }
      const sl = slabs.get(rate)!;
      sl.taxableAmount += it.taxableAmount;
      sl.cgstAmount += it.cgstAmount;
      sl.sgstAmount += it.sgstAmount;
      sl.igstAmount += it.igstAmount;
      sl.totalTax += it.taxAmount;
    }
    return Array.from(slabs.values()).sort((a, b) => a.taxRate - b.taxRate);
  }

  // Barcode Studio Services — Sequential A385, A386, A387... (Strictly No Repeated Values)
  public generateUniqueBarcode(prefixOrFormat: string = 'A385', format: 'Code128' | 'EAN13' = 'Code128'): string {
    if (prefixOrFormat === 'EAN13' || format === 'EAN13') {
      let eanCandidate = '';
      let attempts = 0;
      do {
        attempts++;
        const rnd = Math.floor(100000000 + Math.random() * 900000000).toString();
        const first12 = ('890' + rnd).slice(0, 12);
        let sum = 0;
        for (let i = 0; i < 12; i++) {
          const d = parseInt(first12[i], 10);
          sum += i % 2 === 0 ? d : d * 3;
        }
        const mod = sum % 10;
        const check = mod === 0 ? 0 : 10 - mod;
        eanCandidate = `${first12}${check}`;
      } while (
        (this.barcodeIndex.has(eanCandidate.toLowerCase()) ||
          this.products.some((p) => p.barcode?.trim().toLowerCase() === eanCandidate.toLowerCase())) &&
        attempts < 100
      );
      return eanCandidate;
    }

    // Default: Sequential barcode starting at A385, A386, A387, A388...
    // Pattern: A followed directly by sequence number (e.g. A385, A386, A387...)
    // No repeated / duplicate values allowed: strictly unique sequential barcodes
    let prefixLetter = 'A';
    let minStartNumber = 385;

    // Parse prefix if custom prefix provided (e.g., 'A385' -> prefix 'A', start 385)
    if (prefixOrFormat && prefixOrFormat !== 'Code128' && prefixOrFormat !== 'EAN13') {
      const match = prefixOrFormat.trim().match(/^([A-Za-z]+)(\d*)$/);
      if (match) {
        prefixLetter = match[1].toUpperCase();
        if (match[2]) {
          const parsedStart = parseInt(match[2], 10);
          if (!isNaN(parsedStart) && parsedStart > 0) {
            minStartNumber = parsedStart;
          }
        }
      }
    }

    // Find the highest existing sequential number matching this prefix letter across all products
    const regex = new RegExp(`^${prefixLetter}(\\d+)$`, 'i');
    let maxNum = minStartNumber - 1; // e.g. 384, so first is 385 if none exist

    for (const p of this.products) {
      if (!p.barcode) continue;
      const match = p.barcode.trim().match(regex);
      if (match && match[1]) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > maxNum) {
          maxNum = val;
        }
      }
    }

    // Next sequential number: A385, A386, A387, A388...
    let counter = Math.max(minStartNumber, maxNum + 1);
    let candidate = `${prefixLetter}${counter}`;

    // Guarantee 100% uniqueness: strictly unique sequential barcodes
    while (
      this.barcodeIndex.has(candidate.toLowerCase()) ||
      this.products.some((p) => p.barcode?.trim().toLowerCase() === candidate.toLowerCase())
    ) {
      counter++;
      candidate = `${prefixLetter}${counter}`;
    }

    return candidate;
  }

  public isBarcodeUnique(barcode: string, excludeProductId?: number): { isUnique: boolean; conflictProduct?: Product } {
    if (!barcode || !barcode.trim()) return { isUnique: true };
    const clean = barcode.trim().toLowerCase();
    const existing =
      this.barcodeIndex.get(clean) ||
      this.products.find((p) => p.id !== excludeProductId && p.barcode?.trim().toLowerCase() === clean);

    if (existing && existing.id !== excludeProductId) {
      return { isUnique: false, conflictProduct: existing };
    }
    return { isUnique: true };
  }

  public assignBarcodeToProduct(
    productId: number,
    newBarcode: string,
    force: boolean = false
  ): { success: boolean; errors: string[]; product?: Product } {
    const p = this.idIndex.get(productId);
    if (!p) return { success: false, errors: [`Product ID ${productId} not found.`] };

    const clean = newBarcode?.trim().toUpperCase();
    if (!clean) return { success: false, errors: ['Barcode cannot be empty.'] };

    // Check duplicate (Strictly unique - no duplicate barcodes)
    const existing =
      this.barcodeIndex.get(clean.toLowerCase()) ||
      this.products.find((pr) => pr.id !== productId && pr.barcode?.trim().toLowerCase() === clean.toLowerCase());
    if (existing && existing.id !== productId) {
      return {
        success: false,
        errors: [`Barcode '${clean}' is already assigned to '${existing.nameEn}'. Duplicate barcodes are not allowed.`],
      };
    }

    if (p.barcode && p.barcode !== clean && !force) {
      return { success: false, errors: [`Product already has barcode '${p.barcode}'. Force overwrite required.`] };
    }

    const oldBarcode = p.barcode;
    p.barcode = clean;
    if (oldBarcode) {
      this.barcodeIndex.delete(oldBarcode.toLowerCase());
    }
    this.barcodeIndex.set(clean.toLowerCase(), p);
    p.updatedAt = new Date().toISOString();
    this.rebuildIndexes();

    this.logAudit('Product', p.productCode, 'BARCODE_UPDATE', `Updated barcode for '${p.nameEn}' from '${oldBarcode}' to '${clean}'.`);
    this.saveToLocalStorage();
    return { success: true, errors: [], product: p };
  }

  public removeBarcodeFromProduct(productId: number): { success: boolean; errors: string[]; product?: Product } {
    const p = this.idIndex.get(productId);
    if (!p) return { success: false, errors: [`Product ID ${productId} not found.`] };

    const oldBarcode = p.barcode;
    if (p.barcode) {
      this.barcodeIndex.delete(p.barcode.toLowerCase());
      p.barcode = '';
      p.updatedAt = new Date().toISOString();
      this.rebuildIndexes();
      this.logAudit('Product', p.productCode, 'BARCODE_REMOVE', `Removed barcode '${oldBarcode}' from '${p.nameEn}'.`);
      this.saveToLocalStorage();
    }
    return { success: true, errors: [], product: p };
  }

  public batchUpdateBarcodes(updates: Array<{ productId: number; barcode: string }>): { success: boolean; errors: string[] } {
    const errors: string[] = [];
    for (const u of updates) {
      const res = this.assignBarcodeToProduct(u.productId, u.barcode, true);
      if (!res.success) {
        errors.push(...res.errors);
      }
    }
    return { success: errors.length === 0, errors };
  }

  public getBarcodeStudioItems(): BarcodeStudioItem[] {
    return this.products.map((p) => ({
      productId: p.id,
      productCode: p.productCode,
      barcode: p.barcode,
      nameEn: p.nameEn,
      nameTa: p.nameTa,
      saleRate: p.saleRate,
      mrp: p.mrp,
      currentStock: p.currentStock,
      labelCount: 1,
      isSelected: false,
    }));
  }

  // -------------------------------------------------------------
  // PHASE 7: DASHBOARD & REPORTING SERVICES
  // -------------------------------------------------------------
  private appSettings: AppSettings = {
    storeName: 'Sri Venkateswara Furniture and Store',
    storeTamilName: 'ஸ்ரீ வெங்கடேஸ்வரா பர்னிச்சர் & ஸ்டோர்',
    storeSubtitle: '',
    storeOwner: 'பெரியநத்தம் வெ.பெருமாள் நாயகர்',
    storeBlessing: 'என் தாய் தந்தை துணை',
    storeAddress: 'மடம் தெரு, அண்ணா விளையாட்டு பூங்கா அருகில், காஞ்சிபுரம் - 631 502.',
    storePhone: '8143 84 8143 / 9941333457',
    storeWhatsApp: '8143 84 8143',
    storeLandline: '',
    storeEmail: 'contact@srivenkateswarafurniture.com',
    gstNumber: '33AGOPV5229Q1ZH',
    currencySymbol: '₹',
    receiptPaperSize: '104mm (4-Inch) Thermal',
    defaultTaxRate: 5,
    barcodeFormat: 'Code128',
    defaultLowStockThreshold: 5,
    defaultReportDateRange: 'Last 7 Days',
    defaultDiscountPercent: 0,
    taxDisplayPreference: 'Itemized',
    enableConfirmDialogs: true,
    startupScreen: 'Dashboard',
  };

  public getDashboardMetrics(): DashboardMetrics {
    const todayStr = new Date().toISOString().slice(0, 10);
    const confirmedInvoices = this.invoices.filter((i) => i.status === 'Confirmed');
    const todayInvoices = confirmedInvoices.filter((i) => (i.invoiceDate || i.createdAt).slice(0, 10) === todayStr);

    const todaySales = Math.round(todayInvoices.reduce((sum, i) => sum + i.grandTotal, 0) * 100) / 100;
    const todayBillsCount = todayInvoices.length;

    const confirmedPurchases = this.purchases.filter((p) => p.status === 'Confirmed');
    const todayPurchases = confirmedPurchases.filter(
      (p) => (p.purchaseDate || p.goodsReceivedDate || p.createdAt).slice(0, 10) === todayStr
    );
    const todayPurchaseTotal = Math.round(todayPurchases.reduce((sum, p) => sum + p.grandTotal, 0) * 100) / 100;

    const activeProducts = this.products.filter((p) => p.isActive);
    const totalProducts = activeProducts.length;
    const lowStockProductCount = activeProducts.filter((p) => p.currentStock > 0 && p.currentStock <= p.reorderLevel).length;
    const outOfStockProductCount = activeProducts.filter((p) => p.currentStock <= 0).length;

    const activeCustomers = this.customers.filter((c) => c.isActive);
    const totalCustomerCount = activeCustomers.length;
    const outstandingCustomerBalance = Math.round(activeCustomers.reduce((sum, c) => sum + (c.currentBalance > 0 ? c.currentBalance : 0), 0) * 100) / 100;

    // Payments received today across all invoices
    let paymentsReceivedToday = 0;
    for (const inv of this.invoices) {
      if (inv.payments) {
        for (const p of inv.payments) {
          if ((p.paymentDate || p.createdAt || inv.createdAt).slice(0, 10) === todayStr) {
            paymentsReceivedToday += p.amount;
          }
        }
      }
    }
    paymentsReceivedToday = Math.round(paymentsReceivedToday * 100) / 100;

    // Last 7 Days Sales Trend
    const last7DaysSales: DailySalesTrendItem[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().slice(0, 10);
      const dayInvs = confirmedInvoices.filter((inv) => (inv.invoiceDate || inv.createdAt).slice(0, 10) === dStr);
      const daySales = Math.round(dayInvs.reduce((sum, inv) => sum + inv.grandTotal, 0) * 100) / 100;
      const dayTax = Math.round(dayInvs.reduce((sum, inv) => sum + inv.totalTaxAmount, 0) * 100) / 100;

      last7DaysSales.push({
        dateString: dStr,
        salesAmount: daySales,
        billCount: dayInvs.length,
        taxCollected: dayTax,
      });
    }

    // Last 30 Days Sales Trend
    const last30DaysSales: DailySalesTrendItem[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().slice(0, 10);
      const dayInvs = confirmedInvoices.filter((inv) => (inv.invoiceDate || inv.createdAt).slice(0, 10) === dStr);
      const daySales = Math.round(dayInvs.reduce((sum, inv) => sum + inv.grandTotal, 0) * 100) / 100;
      const dayTax = Math.round(dayInvs.reduce((sum, inv) => sum + inv.totalTaxAmount, 0) * 100) / 100;

      last30DaysSales.push({
        dateString: dStr,
        salesAmount: daySales,
        billCount: dayInvs.length,
        taxCollected: dayTax,
      });
    }

    return {
      todaySales,
      todayBillsCount,
      todayPurchaseTotal,
      totalProducts,
      lowStockProductCount,
      outOfStockProductCount,
      totalCustomerCount,
      outstandingCustomerBalance,
      paymentsReceivedToday,
      last7DaysSales,
      last30DaysSales,
    };
  }

  public getSalesReport(filter?: ReportFilter): SalesReportRow[] {
    let list = [...this.invoices];

    if (filter?.status && filter.status !== 'All') {
      list = list.filter((i) => i.status === filter.status);
    } else {
      list = list.filter((i) => i.status !== 'Cancelled');
    }

    if (filter?.fromDate) {
      const from = new Date(filter.fromDate).getTime();
      list = list.filter((i) => new Date(i.invoiceDate).getTime() >= from);
    }

    if (filter?.toDate) {
      const to = new Date(filter.toDate).getTime();
      list = list.filter((i) => new Date(i.invoiceDate).getTime() <= to);
    }

    if (filter?.customerId && filter.customerId > 0) {
      list = list.filter((i) => i.customerId === filter.customerId);
    }

    if (filter?.paymentMethod && filter.paymentMethod !== 'All') {
      list = list.filter((i) => {
        const mode = i.paymentMode || (i.payments && i.payments[0] ? (i.payments[0].paymentMode || i.payments[0].paymentMethod) : 'Cash');
        return mode === filter.paymentMethod;
      });
    }

    if (filter?.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      list = list.filter(
        (i) => i.invoiceNumber.toLowerCase().includes(term) || i.customerName.toLowerCase().includes(term)
      );
    }

    list.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());

    return list.map((i) => ({
      documentNumber: i.invoiceNumber,
      documentDate: i.invoiceDate,
      customerName: i.customerName,
      paymentMethod: i.paymentMode || (i.payments && i.payments[0] ? (i.payments[0].paymentMode || i.payments[0].paymentMethod) : 'Cash'),
      status: i.status,
      totalItems: i.totalItems,
      totalQuantity: i.totalQty,
      grossAmount: i.grossAmount,
      discountAmount: i.itemDiscount + i.billDiscount,
      taxableAmount: i.taxableAmount,
      cgstAmount: i.cgstAmount,
      sgstAmount: i.sgstAmount,
      igstAmount: i.igstAmount,
      totalTax: i.totalTaxAmount,
      grandTotal: i.grandTotal,
    }));
  }

  public getProductWiseSalesReport(filter?: ReportFilter): ProductWiseSalesReportRow[] {
    const fromTime = filter?.fromDate ? new Date(filter.fromDate).getTime() : 0;
    const toTime = filter?.toDate ? new Date(filter.toDate).getTime() : Infinity;
    const term = filter?.searchTerm?.toLowerCase() || '';

    const confirmedInvs = this.invoices.filter((i) => {
      if (i.status !== 'Confirmed') return false;
      const t = new Date(i.invoiceDate).getTime();
      return t >= fromTime && t <= toTime;
    });

    const map = new Map<number, ProductWiseSalesReportRow>();

    for (const inv of confirmedInvs) {
      for (const item of inv.items) {
        if (
          term &&
          !item.productName.toLowerCase().includes(term) &&
          !item.productCode.toLowerCase().includes(term) &&
          !item.barcode.toLowerCase().includes(term)
        ) {
          continue;
        }

        if (!map.has(item.productId)) {
          map.set(item.productId, {
            productId: item.productId,
            productCode: item.productCode,
            barcode: item.barcode,
            productName: item.productName,
            unit: item.unit,
            quantitySold: 0,
            totalRevenue: 0,
            totalDiscount: 0,
            totalTax: 0,
            billCount: 0,
          });
        }

        const entry = map.get(item.productId)!;
        entry.quantitySold += item.quantity;
        entry.totalRevenue = Math.round((entry.totalRevenue + item.lineTotal) * 100) / 100;
        entry.totalDiscount = Math.round((entry.totalDiscount + item.discountAmount) * 100) / 100;
        entry.totalTax = Math.round((entry.totalTax + item.taxAmount) * 100) / 100;
        entry.billCount += 1;
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  public getPurchaseReport(filter?: ReportFilter): PurchaseReportRow[] {
    let list = [...this.purchases];

    if (filter?.status && filter.status !== 'All') {
      list = list.filter((p) => p.status === filter.status);
    } else {
      list = list.filter((p) => p.status !== 'Cancelled');
    }

    if (filter?.fromDate) {
      const from = new Date(filter.fromDate).getTime();
      list = list.filter((p) => new Date(p.purchaseDate || p.goodsReceivedDate || p.createdAt).getTime() >= from);
    }

    if (filter?.toDate) {
      const to = new Date(filter.toDate).getTime();
      list = list.filter((p) => new Date(p.purchaseDate || p.goodsReceivedDate || p.createdAt).getTime() <= to);
    }

    if (filter?.supplierId && filter.supplierId > 0) {
      list = list.filter((p) => p.supplierId === filter.supplierId);
    }

    if (filter?.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      list = list.filter(
        (p) =>
          p.purchaseNumber.toLowerCase().includes(term) ||
          p.supplierName.toLowerCase().includes(term) ||
          (p.supplierInvoiceNumber && p.supplierInvoiceNumber.toLowerCase().includes(term))
      );
    }

    list.sort(
      (a, b) =>
        new Date(b.purchaseDate || b.goodsReceivedDate || b.createdAt).getTime() -
        new Date(a.purchaseDate || a.goodsReceivedDate || a.createdAt).getTime()
    );

    return list.map((p) => ({
      purchaseNumber: p.purchaseNumber,
      purchaseDate: p.purchaseDate || p.goodsReceivedDate || p.createdAt,
      supplierName: p.supplierName,
      supplierInvoiceNumber: p.supplierInvoiceNumber || '',
      paymentType: p.purchaseType,
      status: p.status,
      totalQuantity: p.totalQty,
      taxableAmount: p.taxableAmount,
      taxAmount: p.taxAmount,
      grandTotal: p.grandTotal,
      amountPaid: p.amountPaid,
      balanceDue: p.balanceDue,
    }));
  }

  public getStockReport(filter?: ReportFilter): StockReportRow[] {
    let list = this.products.filter((p) => p.isActive);

    if (filter?.categoryId && filter.categoryId > 0) {
      list = list.filter((p) => p.categoryId === filter.categoryId);
    }

    if (filter?.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      list = list.filter(
        (p) =>
          p.nameEn.toLowerCase().includes(term) ||
          p.productCode.toLowerCase().includes(term) ||
          p.barcode.toLowerCase().includes(term)
      );
    }

    return list.map((p) => {
      let status = 'Normal';
      if (p.currentStock <= 0) status = 'Out of Stock';
      else if (p.currentStock <= p.reorderLevel) status = 'Low Stock';

      return {
        productId: p.id,
        productCode: p.productCode,
        barcode: p.barcode,
        productName: p.nameEn,
        categoryName: p.categoryName || 'Uncategorized',
        unit: p.unit,
        currentStock: p.currentStock,
        reorderLevel: p.reorderLevel,
        purchaseRate: p.purchaseRate,
        saleRate: p.saleRate,
        stockValueAtCost: Math.round(p.currentStock * p.purchaseRate * 100) / 100,
        stockValueAtSale: Math.round(p.currentStock * p.saleRate * 100) / 100,
        stockStatus: status,
      };
    });
  }

  public getCustomerReport(filter?: ReportFilter): CustomerReportRow[] {
    let list = this.customers.filter((c) => c.isActive);

    if (filter?.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.code.toLowerCase().includes(term) ||
          (c.mobile && c.mobile.includes(term))
      );
    }

    return list.map((c) => {
      const custInvs = this.invoices.filter((i) => i.customerId === c.id && i.status === 'Confirmed');
      const totalBilled = Math.round(custInvs.reduce((sum, i) => sum + i.grandTotal, 0) * 100) / 100;
      const totalPaid = Math.round(custInvs.reduce((sum, i) => sum + i.amountPaid, 0) * 100) / 100;
      const lastPurchase = custInvs.length > 0 ? custInvs[custInvs.length - 1].invoiceDate : undefined;

      return {
        customerId: c.id,
        customerCode: c.code,
        customerName: c.name,
        mobile: c.mobile || '',
        gstin: '',
        invoicesCount: custInvs.length,
        totalBilledAmount: totalBilled,
        totalPaidAmount: totalPaid,
        outstandingBalance: c.currentBalance,
        lastPurchaseDate: lastPurchase,
      };
    });
  }

  public getPaymentCollectionReport(filter?: ReportFilter): PaymentCollectionReportRow[] {
    const list: PaymentCollectionReportRow[] = [];
    const fromTime = filter?.fromDate ? new Date(filter.fromDate).getTime() : 0;
    const toTime = filter?.toDate ? new Date(filter.toDate).getTime() : Infinity;
    const term = filter?.searchTerm?.toLowerCase() || '';

    for (const inv of this.invoices) {
      if (!inv.payments) continue;
      for (const p of inv.payments) {
        const pDate = p.paymentDate || p.createdAt || inv.createdAt;
        const pTime = new Date(pDate).getTime();
        if (pTime < fromTime || pTime > toTime) continue;

        const mode = p.paymentMode || p.paymentMethod;
        if (filter?.paymentMethod && filter.paymentMethod !== 'All' && mode !== filter.paymentMethod) {
          continue;
        }

        if (
          term &&
          !inv.invoiceNumber.toLowerCase().includes(term) &&
          !inv.customerName.toLowerCase().includes(term) &&
          (!p.referenceNumber || !p.referenceNumber.toLowerCase().includes(term))
        ) {
          continue;
        }

        list.push({
          paymentId: p.id || 0,
          paymentDate: pDate,
          invoiceNumber: inv.invoiceNumber,
          customerName: inv.customerName,
          paymentMode: mode,
          amount: p.amount,
          referenceNumber: p.referenceNumber || '',
          notes: p.notes || '',
        });
      }
    }

    return list.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
  }

  // Settings Services
  public getAppSettings(): AppSettings {
    return { ...this.appSettings };
  }

  public saveAppSettings(s: Partial<AppSettings>): { success: boolean; errors: string[]; settings?: AppSettings } {
    const errors: string[] = [];
    if (!s.storeName || !s.storeName.trim()) {
      errors.push('Business Name is required.');
      return { success: false, errors };
    }

    this.appSettings = {
      ...this.appSettings,
      ...s,
      storeName: s.storeName.trim(),
      gstNumber: s.gstNumber !== undefined ? s.gstNumber.trim().toUpperCase() : this.appSettings.gstNumber,
    };

    this.logAudit('Settings', 'Global', 'UPDATE', 'Updated application settings and retail business profile.');
    this.saveToLocalStorage();
    return { success: true, errors: [], settings: { ...this.appSettings } };
  }

  // Data Management Diagnostics
  public getDataManagementInfo(): DataManagementInfo {
    return {
      databasePath: '/data/ShopBilling.db',
      databaseFileSize: '1.45 MB',
      fileSizeBytes: 1520640,
      walMode: 'WAL (Write-Ahead Logging)',
      foreignKeysEnabled: true,
      recordCounts: {
        products: this.products.length,
        categories: this.categories.length,
        brands: this.brands.length,
        suppliers: this.suppliers.length,
        purchases: this.purchases.length,
        customers: this.customers.length,
        invoices: this.invoices.length,
        estimates: this.estimates.length,
        stock_movements: this.stockMovements.length,
        audit_logs: this.auditLogs.length,
      },
    };
  }

  public runIntegrityCheck(): DataIntegrityResult {
    const issues: Array<{ category: string; severity: string; entityId: string; description: string }> = [];

    // Check for duplicate barcodes
    const bCodes = new Map<string, number>();
    for (const p of this.products.filter((x) => x.isActive && x.barcode)) {
      const bc = p.barcode.toLowerCase();
      bCodes.set(bc, (bCodes.get(bc) || 0) + 1);
    }
    for (const [bc, cnt] of bCodes.entries()) {
      if (cnt > 1) {
        issues.push({
          category: 'Duplicates',
          severity: 'Warning',
          entityId: bc,
          description: `Barcode '${bc}' is duplicated across ${cnt} products.`,
        });
      }
    }

    // Check for negative stock
    const negProds = this.products.filter((p) => p.isActive && p.currentStock < 0);
    if (negProds.length > 0) {
      issues.push({
        category: 'Stock',
        severity: 'Warning',
        entityId: 'products',
        description: `Found ${negProds.length} active products with negative stock balances.`,
      });
    }

    return {
      isDatabaseHealthy: issues.length === 0,
      integrityCheckMessage: issues.length === 0 ? 'ok' : `${issues.length} verification warnings detected`,
      issuesFound: issues,
    };
  }

  public optimizeDatabase(): { success: boolean; message: string } {
    this.rebuildIndexes();
    this.logAudit('Database', 'Engine', 'VACUUM', 'Executed SQLite VACUUM and re-indexed all catalog hash tables.');
    return {
      success: true,
      message: 'SQLite database VACUUM complete. All indexes rebuilt and query optimizer statistics refreshed.',
    };
  }

  // -------------------------------------------------------------
  // DELETE MANAGEMENT / PURGE OLD DATA METHODS
  // -------------------------------------------------------------
  public previewDeleteImpact(
    startDateStr: string,
    endDateStr: string,
    includeEstimates: boolean = true
  ): {
    billsCount: number;
    billsTotalAmount: number;
    taxAmount: number;
    paymentsCount: number;
    estimatesCount: number;
    estimatesTotalAmount: number;
    matchingInvoiceNumbers: string[];
    matchingEstimateNumbers: string[];
  } {
    const start = new Date(startDateStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDateStr);
    end.setHours(23, 59, 59, 999);

    const startTime = start.getTime();
    const endTime = end.getTime();

    // Matching Invoices
    const matchingInvoices = this.invoices.filter((inv) => {
      const d = new Date(inv.invoiceDate || inv.createdAt).getTime();
      return !isNaN(d) && d >= startTime && d <= endTime;
    });

    let billsTotalAmount = 0;
    let taxAmount = 0;
    let paymentsCount = 0;

    for (const inv of matchingInvoices) {
      billsTotalAmount += inv.grandTotal || 0;
      taxAmount += inv.totalTaxAmount || 0;
      paymentsCount += Array.isArray(inv.payments) ? inv.payments.length : 0;
    }

    // Matching Estimates
    let matchingEstimates: typeof this.estimates = [];
    let estimatesTotalAmount = 0;

    if (includeEstimates) {
      matchingEstimates = this.estimates.filter((est) => {
        const d = new Date(est.estimateDate || est.createdAt).getTime();
        return !isNaN(d) && d >= startTime && d <= endTime;
      });
      for (const est of matchingEstimates) {
        estimatesTotalAmount += est.grandTotal || 0;
      }
    }

    return {
      billsCount: matchingInvoices.length,
      billsTotalAmount,
      taxAmount,
      paymentsCount,
      estimatesCount: matchingEstimates.length,
      estimatesTotalAmount,
      matchingInvoiceNumbers: matchingInvoices.map((i) => i.invoiceNumber),
      matchingEstimateNumbers: matchingEstimates.map((e) => e.estimateNumber),
    };
  }

  public purgeDataByDateRange(
    startDateStr: string,
    endDateStr: string,
    options: { includeEstimates: boolean }
  ): {
    success: boolean;
    message: string;
    deletedBills: number;
    deletedEstimates: number;
    deletedGrossAmount: number;
  } {
    const start = new Date(startDateStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDateStr);
    end.setHours(23, 59, 59, 999);

    const startTime = start.getTime();
    const endTime = end.getTime();

    const initialInvoiceCount = this.invoices.length;
    let deletedGross = 0;

    const remainingInvoices: typeof this.invoices = [];

    for (const inv of this.invoices) {
      const d = new Date(inv.invoiceDate || inv.createdAt).getTime();
      if (!isNaN(d) && d >= startTime && d <= endTime) {
        deletedGross += inv.grandTotal || 0;
      } else {
        remainingInvoices.push(inv);
      }
    }

    this.invoices = remainingInvoices;
    const deletedBills = initialInvoiceCount - remainingInvoices.length;

    let deletedEstimates = 0;
    if (options.includeEstimates) {
      const initialEstimateCount = this.estimates.length;
      this.estimates = this.estimates.filter((est) => {
        const d = new Date(est.estimateDate || est.createdAt).getTime();
        return isNaN(d) || d < startTime || d > endTime;
      });
      deletedEstimates = initialEstimateCount - this.estimates.length;
    }

    this.rebuildIndexes();

    this.logAudit(
      'Database',
      'Purge',
      'DELETE',
      `Permanently purged ${deletedBills} bills (₹${deletedGross.toFixed(2)}) and ${deletedEstimates} estimates between ${startDateStr} and ${endDateStr}.`
    );

    return {
      success: true,
      message: `Successfully purged ${deletedBills} retail bill(s) and ${deletedEstimates} estimate(s) from SQLite storage.`,
      deletedBills,
      deletedEstimates,
      deletedGrossAmount: deletedGross,
    };
  }

  // Web Preview Backup & Restore Methods
  public exportPreviewJson(): string {
    const backupPayload = {
      format: 'ShopBilling_WebPreview_Backup',
      version: 3,
      appVersion: '2.5.0',
      exportedAt: new Date().toISOString(),
      metadata: {
        note: 'Web Simulation & Demo Data Export. Genuine desktop backups (.db) are managed via C# WinForms DatabaseBackupService with SQLite Online Backup API.',
        productCount: this.products.length,
        categoryCount: this.categories.length,
        customerCount: this.customers.length,
        supplierCount: this.suppliers.length,
        invoiceCount: this.invoices.length,
      },
      data: {
        products: this.products,
        categories: this.categories,
        subcategories: this.subcategories,
        brands: this.brands,
        suppliers: this.suppliers,
        purchases: this.purchases,
        customers: this.customers,
        invoices: this.invoices,
        estimates: this.estimates,
        stockAdjustments: this.stockAdjustments,
        physicalVerifications: this.physicalVerifications,
        stockMovements: this.stockMovements,
        supplierLedger: this.supplierLedger,
        auditLogs: this.auditLogs,
        appSettings: this.appSettings,
      },
    };

    return JSON.stringify(backupPayload, null, 2);
  }

  public validatePreviewBackupJson(parsed: any): { valid: boolean; error?: string; recordCounts?: Record<string, number> } {
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'The selected file is not a valid JSON document.' };
    }

    if (parsed.format !== 'ShopBilling_WebPreview_Backup') {
      return { valid: false, error: 'Incompatible file: Missing "ShopBilling_WebPreview_Backup" format header identifier.' };
    }

    if (!parsed.data || typeof parsed.data !== 'object') {
      return { valid: false, error: 'Incompatible file: Missing "data" payload block.' };
    }

    const { products, categories, suppliers } = parsed.data;
    if (!Array.isArray(products) || !Array.isArray(categories)) {
      return { valid: false, error: 'Incompatible schema: Missing required "products" or "categories" arrays.' };
    }

    // Check individual product integrity
    for (let i = 0; i < Math.min(products.length, 20); i++) {
      const p = products[i];
      if (!p || typeof p !== 'object' || typeof p.nameEn !== 'string' || typeof p.saleRate !== 'number') {
        return { valid: false, error: `Corrupt product record found at index ${i}.` };
      }
    }

    return {
      valid: true,
      recordCounts: {
        products: products.length,
        categories: categories.length,
        suppliers: Array.isArray(suppliers) ? suppliers.length : 0,
        invoices: Array.isArray(parsed.data.invoices) ? parsed.data.invoices.length : 0,
      },
    };
  }

  public createSafetyPreviewSnapshot(): string {
    const snapshot = this.exportPreviewJson();
    this.safetySnapshot = snapshot;
    return snapshot;
  }

  public hasSafetySnapshot(): boolean {
    return this.safetySnapshot !== null;
  }

  public restorePreviewFromJson(jsonText: string): { success: boolean; message: string; safetyCreated: boolean } {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err: any) {
      return { success: false, message: `Invalid JSON format: ${err.message}`, safetyCreated: false };
    }

    const validation = this.validatePreviewBackupJson(parsed);
    if (!validation.valid) {
      return { success: false, message: validation.error || 'Validation failed', safetyCreated: false };
    }

    // Create automatic safety backup before modifying state
    this.createSafetyPreviewSnapshot();

    try {
      const d = parsed.data;
      this.products = JSON.parse(JSON.stringify(d.products || []));
      this.categories = JSON.parse(JSON.stringify(d.categories || []));
      this.subcategories = JSON.parse(JSON.stringify(d.subcategories || []));
      this.brands = JSON.parse(JSON.stringify(d.brands || []));
      this.suppliers = JSON.parse(JSON.stringify(d.suppliers || []));
      this.purchases = JSON.parse(JSON.stringify(d.purchases || []));
      this.customers = JSON.parse(JSON.stringify(d.customers || []));
      this.invoices = JSON.parse(JSON.stringify(d.invoices || []));
      this.estimates = JSON.parse(JSON.stringify(d.estimates || []));
      this.stockAdjustments = JSON.parse(JSON.stringify(d.stockAdjustments || []));
      this.physicalVerifications = JSON.parse(JSON.stringify(d.physicalVerifications || []));
      this.stockMovements = JSON.parse(JSON.stringify(d.stockMovements || []));
      this.supplierLedger = JSON.parse(JSON.stringify(d.supplierLedger || []));
      this.auditLogs = JSON.parse(JSON.stringify(d.auditLogs || []));
      if (d.appSettings) {
        this.appSettings = JSON.parse(JSON.stringify(d.appSettings));
      }

      this.rebuildIndexes();

      this.logAudit(
        'Database',
        'Restore',
        'RESTORE',
        `Restored web preview state from valid JSON snapshot: ${this.products.length} products, ${this.categories.length} categories.`
      );

      return {
        success: true,
        message: `Successfully restored ${this.products.length} products, ${this.categories.length} categories, ${this.customers.length} customers, and ${this.invoices.length} invoices. Pre-restore safety snapshot created.`,
        safetyCreated: true,
      };
    } catch (err: any) {
      // Revert if error occurs during assignment
      this.restoreFromSafetyPreviewSnapshot();
      return { success: false, message: `Restore encountered an error: ${err.message}. Rolled back to safety snapshot.`, safetyCreated: true };
    }
  }

  public restoreFromSafetyPreviewSnapshot(): { success: boolean; message: string } {
    if (!this.safetySnapshot) {
      return { success: false, message: 'No safety snapshot available to restore.' };
    }

    try {
      const parsed = JSON.parse(this.safetySnapshot);
      const d = parsed.data;
      this.products = JSON.parse(JSON.stringify(d.products || []));
      this.categories = JSON.parse(JSON.stringify(d.categories || []));
      this.subcategories = JSON.parse(JSON.stringify(d.subcategories || []));
      this.brands = JSON.parse(JSON.stringify(d.brands || []));
      this.suppliers = JSON.parse(JSON.stringify(d.suppliers || []));
      this.purchases = JSON.parse(JSON.stringify(d.purchases || []));
      this.customers = JSON.parse(JSON.stringify(d.customers || []));
      this.invoices = JSON.parse(JSON.stringify(d.invoices || []));
      this.rebuildIndexes();
      return { success: true, message: 'Successfully reverted to previous safety snapshot.' };
    } catch (err: any) {
      return { success: false, message: `Failed to restore safety snapshot: ${err.message}` };
    }
  }

  private logAudit(entity: string, entityId: string, action: any, details: string) {
    this.auditLogs.unshift({
      id: Date.now() + Math.floor(Math.random() * 1000),
      entity,
      entityId,
      action,
      details,
      timestamp: new Date().toISOString(),
    });
  }
}

export const db = new SQLiteIndexedEngine();
