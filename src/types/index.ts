export interface Product {
  id: number;
  productCode: string;
  barcode: string;
  nameEn: string;
  nameTa: string;
  categoryId: number | null;
  categoryName?: string;
  subcategoryId: number | null;
  subcategoryName?: string;
  brandId: number | null;
  brandName?: string;
  unit: string;
  hsnCode?: string;
  purchaseRate: number;
  saleRate: number;
  wholesaleRate: number;
  mrp: number;
  taxRate: number;
  sgstRate?: number;
  cgstRate?: number;
  igstRate?: number;
  openingStock: number;
  currentStock: number;
  reorderLevel: number;
  maxStockLevel: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  productCount?: number;
}

export interface Subcategory {
  id: number;
  categoryId: number;
  code: string;
  name: string;
  isActive: boolean;
  productCount?: number;
}

export interface Brand {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  productCount?: number;
}

export interface AuditLog {
  id: number;
  entity: string;
  entityId: string;
  action: 'INSERT' | 'UPDATE' | 'DEACTIVATE' | 'ACTIVATE' | 'IMPORT' | 'RESTORE';
  details: string;
  timestamp: string;
}

export interface ProductFilter {
  searchTerm?: string;
  categoryId?: number;
  subcategoryId?: number;
  brandId?: number;
  isActive?: boolean;
  isLowStockOnly?: boolean;
  sortBy?: 'nameEn' | 'barcode' | 'productCode' | 'saleRate' | 'currentStock';
  sortDescending?: boolean;
  pageNumber?: number;
  pageSize?: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  executionTimeMs: number;
}

export interface Supplier {
  id: number;
  code: string;
  name: string;
  contactPerson?: string;
  mobile?: string;
  altMobile?: string;
  whatsapp?: string;
  email?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  pinCode?: string;
  openingBalance: number;
  currentBalance: number;
  paymentTerms?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseItem {
  id: number;
  purchaseId: number;
  productId: number;
  productCode: string;
  barcode: string;
  productName: string;
  categoryName?: string;
  quantity: number;
  freeQuantity: number;
  purchaseRate: number;
  discountPercent: number;
  discountAmount: number;
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
  lineTotal: number;
  batchNumber?: string;
  expiryDate?: string;
}

export interface PurchaseHeader {
  id: number;
  purchaseNumber: string;
  purchaseDate?: string;
  supplierId: number;
  supplierName: string;
  supplierInvoiceNumber?: string;
  supplierInvoiceDate?: string;
  goodsReceivedDate: string;
  purchaseType: 'Cash' | 'Credit';
  paymentDueDate?: string;
  referenceNumber?: string;
  notes?: string;
  status: 'Draft' | 'Confirmed' | 'Cancelled';
  totalQty: number;
  totalFreeQty: number;
  grossAmount: number;
  itemDiscount: number;
  additionalDiscount: number;
  taxableAmount: number;
  taxAmount: number;
  additionalCharges: number;
  roundOff: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  createdBy?: string;
  confirmedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
  items: PurchaseItem[];
}

export interface SupplierPayment {
  id: number;
  paymentNumber: string;
  supplierId: number;
  supplierName: string;
  purchaseId?: number;
  purchaseNumber?: string;
  paymentDate: string;
  paymentMethod: 'Cash' | 'Bank Transfer' | 'UPI' | 'Cheque' | 'Other';
  amount: number;
  referenceNumber?: string;
  notes?: string;
  createdAt: string;
}

export interface StockMovement {
  id: number;
  productId: number;
  productCode: string;
  productName: string;
  referenceType: 'PURCHASE_CONFIRM' | 'PURCHASE_CANCEL' | 'ADJUSTMENT' | 'OPENING_STOCK' | 'SALES_INVOICE' | 'SALES_CANCEL';
  referenceId: string;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  notes?: string;
  createdAt: string;
}

export interface SupplierLedgerEntry {
  id: number;
  supplierId: number;
  transactionType: 'OPENING_BALANCE' | 'PURCHASE' | 'PAYMENT' | 'PURCHASE_CANCEL';
  referenceId: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  notes?: string;
  transactionDate: string;
}

export interface StockAdjustmentItem {
  id: number;
  adjustmentId: number;
  productId: number;
  productCode: string;
  barcode: string;
  productName: string;
  categoryName?: string;
  currentStock: number;
  physicalCount: number;
  differenceQuantity: number;
  adjustmentType: 'Increase Stock' | 'Decrease Stock' | 'Damaged Goods' | 'Expired Goods' | 'Physical Count Correction' | 'Other';
  unitCost: number;
  reason?: string;
  notes?: string;
}

export interface StockAdjustment {
  id: number;
  adjustmentNumber: string;
  adjustmentDate: string;
  reason: string;
  notes?: string;
  status: 'Draft' | 'Confirmed' | 'Cancelled';
  totalItems: number;
  totalDifferenceQuantity: number;
  totalCostImpact: number;
  createdBy?: string;
  confirmedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
  items: StockAdjustmentItem[];
}

export interface PhysicalStockVerificationItem {
  id: number;
  verificationId: number;
  productId: number;
  productCode: string;
  barcode: string;
  productName: string;
  categoryName?: string;
  systemStockAtStart: number;
  systemStockAtConfirm: number;
  physicalCount: number;
  differenceQuantity: number;
  discrepancyResolved: boolean;
  notes?: string;
}

export interface PhysicalStockVerification {
  id: number;
  verificationNumber: string;
  verificationDate: string;
  categoryId?: number;
  categoryName?: string;
  status: 'Draft' | 'Confirmed' | 'Cancelled';
  totalCountedProducts: number;
  totalDiscrepancies: number;
  netDifferenceQuantity: number;
  notes?: string;
  createdBy?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
  items: PhysicalStockVerificationItem[];
}

export interface CurrentStockSummary {
  productId: number;
  productCode: string;
  barcode: string;
  productName: string;
  categoryName: string;
  brandName: string;
  unit: string;
  openingStock: number;
  purchasedQuantity: number;
  freeQuantityReceived: number;
  soldQuantity: number;
  returnedQuantity: number;
  adjustmentQuantity: number;
  currentStock: number;
  reorderLevel: number;
  maxStockLevel: number;
  purchaseRate: number;
  saleRate: number;
  stockValuePurchase: number;
  stockValueSale: number;
  stockStatus: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Excess Stock';
}

export interface StockDashboardMetrics {
  totalActiveProducts: number;
  totalStockQuantity: number;
  outOfStockCount: number;
  lowStockCount: number;
  excessStockCount: number;
  adjustedProductsCount: number;
  stockValueAtCost: number;
  stockValueAtSale: number;
  potentialGrossMargin: number;
  recentMovements: StockMovement[];
}

export interface Customer {
  id: number;
  code: string;
  name: string;
  mobile?: string;
  email?: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  currentBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerLedgerEntry {
  id: number;
  customerId: number;
  transactionType: string;
  referenceNumber: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  runningBalance: number;
  transactionDate: string;
}

export interface InvoiceItem {
  id?: number;
  invoiceId?: number;
  productId: number;
  productCode: string;
  barcode: string;
  productName: string;
  unit: string;
  mrp?: number;
  quantity: number;
  rate: number;
  discountPercent: number;
  discountAmount: number;
  taxRate: number;
  taxableAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  taxAmount: number;
  lineTotal: number;
}

export interface InvoicePayment {
  id?: number;
  invoiceId?: number;
  invoiceNumber?: string;
  customerId?: number;
  customerName?: string;
  paymentNumber?: string;
  paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Credit';
  paymentMode?: string;
  amount: number;
  referenceNumber?: string;
  notes?: string;
  paymentDate?: string;
  createdAt?: string;
}

export interface InvoiceHeader {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  customerId: number;
  customerName: string;
  customerMobile?: string;
  customerAddress?: string;
  customerGstin?: string;
  salesperson: string;
  paymentMode?: string;
  status: 'Draft' | 'Confirmed' | 'Cancelled';
  paymentStatus: 'Paid' | 'Partial' | 'Unpaid';
  isInterstate: boolean;
  totalItems: number;
  totalQty: number;
  grossAmount: number;
  itemDiscount: number;
  billDiscount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTaxAmount: number;
  otherCharges: number;
  roundOff: number;
  grandTotal: number;
  amountPaid: number;
  paidAmount?: number;
  balanceDue: number;
  cashChange?: number;
  estimateId?: number;
  estimateNumber?: string;
  notes?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  items: InvoiceItem[];
  payments: InvoicePayment[];
}

export interface InvoiceFilter {
  searchTerm?: string;
  customerId?: number;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  fromDate?: string;
  toDate?: string;
  pageNumber?: number;
  pageSize?: number;
}

export interface GstSlabSummary {
  taxRate: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
}

export interface EstimateItem {
  id?: number;
  estimateId?: number;
  productId: number;
  productCode: string;
  barcode: string;
  productName: string;
  unit: string;
  hsnCode?: string;
  quantity: number;
  rate: number;
  discountPercent: number;
  discountAmount: number;
  taxRate: number;
  taxableAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  taxAmount: number;
  lineTotal: number;
}

export interface EstimateHeader {
  id: number;
  estimateNumber: string;
  estimateDate: string;
  validUntil?: string;
  customerId: number;
  customerCode?: string;
  customerName: string;
  customerMobile?: string;
  customerGstin?: string;
  stateCode?: string;
  stateName?: string;
  isInterstate: boolean;
  status: 'Draft' | 'Confirmed' | 'Converted' | 'Cancelled';
  convertedInvoiceId?: number;
  convertedInvoiceNumber?: string;
  convertedAt?: string;
  totalItems: number;
  totalQty: number;
  grossAmount: number;
  itemDiscount: number;
  billDiscount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTaxAmount: number;
  otherCharges: number;
  roundOff: number;
  grandTotal: number;
  notes?: string;
  termsConditions?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  items: EstimateItem[];
}

export interface EstimateFilter {
  searchTerm?: string;
  customerId?: number;
  status?: string; // 'All' | 'Draft' | 'Confirmed' | 'Converted' | 'Cancelled'
  fromDate?: string;
  toDate?: string;
  pageNumber?: number;
  pageSize?: number;
}

export interface BarcodeStudioItem {
  productId: number;
  productCode: string;
  barcode: string;
  nameEn: string;
  nameTa?: string;
  saleRate: number;
  mrp: number;
  currentStock: number;
  labelCount: number;
  isSelected: boolean;
}

export interface BarcodePrintConfig {
  barcodeFormat: 'Code128' | 'EAN13';
  labelWidthMm: number;
  labelHeightMm: number;
  labelsPerRow: number;
  labelsPerColumn: number;
  horizontalGapMm: number;
  verticalGapMm: number;
  pageMarginLeftMm: number;
  pageMarginRightMm: number;
  pageMarginTopMm: number;
  pageMarginBottomMm?: number;
  includeProductName: boolean;
  includePrice: boolean;
  includeBarcodeText: boolean;
  includeStoreName: boolean;
  includeLogo: boolean;
  includeAddress: boolean;
  storeName: string;
  storeSubtitle?: string;
  storeAddress?: string;
  storePhone?: string;
  currencySymbol: string;
  preset?: string;
}

export interface DashboardMetrics {
  todaySales: number;
  todayBillsCount: number;
  todayPurchaseTotal: number;
  totalProducts: number;
  lowStockProductCount: number;
  outOfStockProductCount: number;
  totalCustomerCount: number;
  outstandingCustomerBalance: number;
  paymentsReceivedToday: number;
  last7DaysSales: DailySalesTrendItem[];
  last30DaysSales: DailySalesTrendItem[];
}

export interface DailySalesTrendItem {
  dateString: string;
  salesAmount: number;
  billCount: number;
  taxCollected: number;
}

export interface ReportFilter {
  reportType?: string;
  fromDate?: string;
  toDate?: string;
  searchTerm?: string;
  status?: string;
  paymentMethod?: string;
  customerId?: number;
  supplierId?: number;
  categoryId?: number;
}

export interface SalesReportRow {
  documentNumber: string;
  documentDate: string;
  customerName: string;
  paymentMethod: string;
  status: string;
  totalItems: number;
  totalQuantity: number;
  grossAmount: number;
  discountAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  grandTotal: number;
}

export interface ProductWiseSalesReportRow {
  productId: number;
  productCode: string;
  barcode: string;
  productName: string;
  unit: string;
  quantitySold: number;
  totalRevenue: number;
  totalDiscount: number;
  totalTax: number;
  billCount: number;
}

export interface PurchaseReportRow {
  purchaseNumber: string;
  purchaseDate: string;
  supplierName: string;
  supplierInvoiceNumber: string;
  paymentType: string;
  status: string;
  totalQuantity: number;
  taxableAmount: number;
  taxAmount: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
}

export interface StockReportRow {
  productId: number;
  productCode: string;
  barcode: string;
  productName: string;
  categoryName: string;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  purchaseRate: number;
  saleRate: number;
  stockValueAtCost: number;
  stockValueAtSale: number;
  stockStatus: string;
}

export interface CustomerReportRow {
  customerId: number;
  customerCode: string;
  customerName: string;
  mobile: string;
  gstin: string;
  invoicesCount: number;
  totalBilledAmount: number;
  totalPaidAmount: number;
  outstandingBalance: number;
  lastPurchaseDate?: string;
}

export interface PaymentCollectionReportRow {
  paymentId: number;
  paymentDate: string;
  invoiceNumber: string;
  customerName: string;
  paymentMode: string;
  amount: number;
  referenceNumber: string;
  notes: string;
}

export interface ReportSummary {
  totalRecords: number;
  totalAmount: number;
  totalTax: number;
  totalDiscount: number;
  totalQuantity: number;
  totalPaid: number;
  totalOutstanding: number;
}

export interface AppSettings {
  storeName: string;
  storeTamilName?: string;
  storeSubtitle?: string;
  storeOwner?: string;
  storeBlessing?: string;
  storeAddress: string;
  storePhone: string;
  storeWhatsApp?: string;
  storeLandline?: string;
  storeEmail: string;
  gstNumber: string;
  currencySymbol: string;
  receiptPaperSize: string;
  defaultTaxRate: number;
  barcodeFormat: 'Code128' | 'EAN13';
  defaultLowStockThreshold: number;
  defaultReportDateRange: string;
  defaultDiscountPercent: number;
  taxDisplayPreference: string;
  enableConfirmDialogs: boolean;
  startupScreen: string;
}

export interface DataManagementInfo {
  databasePath: string;
  databaseFileSize: string;
  fileSizeBytes: number;
  walMode: string;
  foreignKeysEnabled: boolean;
  recordCounts: Record<string, number>;
}

export interface DataIntegrityResult {
  isDatabaseHealthy: boolean;
  integrityCheckMessage: string;
  issuesFound: Array<{
    category: string;
    severity: string;
    entityId: string;
    description: string;
  }>;
}


