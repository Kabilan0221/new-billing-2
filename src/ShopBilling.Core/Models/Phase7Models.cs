using System;
using System.Collections.Generic;

namespace ShopBilling.Core.Models
{
    public class DashboardMetrics
    {
        public decimal TodaySales { get; set; }
        public int TodayBillsCount { get; set; }
        public decimal TodayPurchaseTotal { get; set; }
        public int TotalProducts { get; set; }
        public int LowStockProductCount { get; set; }
        public int OutOfStockProductCount { get; set; }
        public int TotalCustomerCount { get; set; }
        public decimal OutstandingCustomerBalance { get; set; }
        public decimal PaymentsReceivedToday { get; set; }

        public List<DailySalesTrendItem> Last7DaysSales { get; set; } = new List<DailySalesTrendItem>();
        public List<DailySalesTrendItem> Last30DaysSales { get; set; } = new List<DailySalesTrendItem>();
    }

    public class DailySalesTrendItem
    {
        public string DateString { get; set; }
        public DateTime Date { get; set; }
        public decimal SalesAmount { get; set; }
        public int BillCount { get; set; }
        public decimal TaxCollected { get; set; }
    }

    public class ReportFilter
    {
        public string ReportType { get; set; } = "DailySales"; // DailySales, DateRangeSales, MonthlySales, BillWise, ProductWise, Purchases, Stock, Customers, Payments
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public string SearchTerm { get; set; }
        public long? CustomerId { get; set; }
        public long? SupplierId { get; set; }
        public long? CategoryId { get; set; }
        public string PaymentMethod { get; set; } = "All";
        public string Status { get; set; } = "All"; // Confirmed, Cancelled, All
    }

    public class SalesReportRow
    {
        public string DocumentNumber { get; set; }
        public DateTime DocumentDate { get; set; }
        public string CustomerName { get; set; }
        public string PaymentMethod { get; set; }
        public string Status { get; set; }
        public int TotalItems { get; set; }
        public decimal TotalQuantity { get; set; }
        public decimal GrossAmount { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal TaxableAmount { get; set; }
        public decimal CgstAmount { get; set; }
        public decimal SgstAmount { get; set; }
        public decimal IgstAmount { get; set; }
        public decimal TotalTax { get; set; }
        public decimal GrandTotal { get; set; }
    }

    public class ProductWiseSalesReportRow
    {
        public long ProductId { get; set; }
        public string ProductCode { get; set; }
        public string Barcode { get; set; }
        public string ProductName { get; set; }
        public string Unit { get; set; }
        public decimal QuantitySold { get; set; }
        public decimal TotalRevenue { get; set; }
        public decimal TotalDiscount { get; set; }
        public decimal TotalTax { get; set; }
        public int BillCount { get; set; }
    }

    public class PurchaseReportRow
    {
        public string PurchaseNumber { get; set; }
        public DateTime PurchaseDate { get; set; }
        public string SupplierName { get; set; }
        public string SupplierInvoiceNumber { get; set; }
        public string PaymentType { get; set; }
        public string Status { get; set; }
        public decimal TotalQuantity { get; set; }
        public decimal TaxableAmount { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal GrandTotal { get; set; }
        public decimal AmountPaid { get; set; }
        public decimal BalanceDue { get; set; }
    }

    public class StockReportRow
    {
        public long ProductId { get; set; }
        public string ProductCode { get; set; }
        public string Barcode { get; set; }
        public string ProductName { get; set; }
        public string CategoryName { get; set; }
        public string Unit { get; set; }
        public decimal CurrentStock { get; set; }
        public decimal ReorderLevel { get; set; }
        public decimal PurchaseRate { get; set; }
        public decimal SaleRate { get; set; }
        public decimal StockValueAtCost { get; set; }
        public decimal StockValueAtSale { get; set; }
        public string StockStatus { get; set; } // Normal, Low Stock, Out of Stock, Overstock
    }

    public class CustomerReportRow
    {
        public long CustomerId { get; set; }
        public string CustomerCode { get; set; }
        public string CustomerName { get; set; }
        public string Mobile { get; set; }
        public string Gstin { get; set; }
        public int InvoicesCount { get; set; }
        public decimal TotalBilledAmount { get; set; }
        public decimal TotalPaidAmount { get; set; }
        public decimal OutstandingBalance { get; set; }
        public DateTime? LastPurchaseDate { get; set; }
    }

    public class PaymentCollectionReportRow
    {
        public long PaymentId { get; set; }
        public DateTime PaymentDate { get; set; }
        public string InvoiceNumber { get; set; }
        public string CustomerName { get; set; }
        public string PaymentMode { get; set; }
        public decimal Amount { get; set; }
        public string ReferenceNumber { get; set; }
        public string Notes { get; set; }
    }

    public class ReportSummary
    {
        public int TotalRecords { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal TotalTax { get; set; }
        public decimal TotalDiscount { get; set; }
        public decimal TotalQuantity { get; set; }
        public decimal TotalPaid { get; set; }
        public decimal TotalOutstanding { get; set; }
    }

    public class AppSettings
    {
        public string StoreName { get; set; } = "Sri Murugan Super Market";
        public string StoreAddress { get; set; } = "124 Bazaar Road, T. Nagar, Chennai - 600017";
        public string StorePhone { get; set; } = "044-24345678";
        public string StoreEmail { get; set; } = "contact@murugansupermarket.com";
        public string GstNumber { get; set; } = "33AAAAA0000A1Z5";
        public string CurrencySymbol { get; set; } = "₹";
        public string ReceiptPaperSize { get; set; } = "80mm Thermal"; // 80mm Thermal or A4 Full Page
        public decimal DefaultTaxRate { get; set; } = 5m;
        public string BarcodeFormat { get; set; } = "Code128"; // Code128 or EAN13
        public decimal DefaultLowStockThreshold { get; set; } = 5m;
        public string DefaultReportDateRange { get; set; } = "Last 7 Days"; // Today, Last 7 Days, This Month, Last 30 Days
        public decimal DefaultDiscountPercent { get; set; } = 0m;
        public string TaxDisplayPreference { get; set; } = "Itemized"; // Itemized or SlabSummary
        public bool EnableConfirmDialogs { get; set; } = true;
        public string StartupScreen { get; set; } = "Dashboard"; // Dashboard, POS, Products
    }

    public class DataManagementInfo
    {
        public string DatabasePath { get; set; }
        public string DatabaseFileSize { get; set; }
        public long FileSizeBytes { get; set; }
        public string WalMode { get; set; } = "WAL";
        public bool ForeignKeysEnabled { get; set; } = true;
        public Dictionary<string, int> RecordCounts { get; set; } = new Dictionary<string, int>();
    }

    public class DataIntegrityResult
    {
        public bool IsDatabaseHealthy { get; set; }
        public string IntegrityCheckMessage { get; set; }
        public List<IntegrityIssue> IssuesFound { get; set; } = new List<IntegrityIssue>();
        public DateTime CheckTime { get; set; } = DateTime.Now;
    }

    public class IntegrityIssue
    {
        public string Category { get; set; } // Duplicates, Orphans, Stock, Balance
        public string Severity { get; set; } // Warning, Error
        public string Description { get; set; }
        public string EntityId { get; set; }
    }
}
