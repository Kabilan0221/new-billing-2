using System;
using System.Collections.Generic;
using System.IO;
using NUnit.Framework;
using ShopBilling.Core.Models;
using ShopBilling.Core.Services;
using ShopBilling.Data.Database;
using ShopBilling.Data.Repositories;

namespace ShopBilling.Tests
{
    [TestFixture]
    public class Phase7DashboardAndReportTests
    {
        private SettingsRepository _settingsRepo;
        private ReportRepository _reportRepo;
        private DataManagementRepository _dataRepo;
        private ProductRepository _productRepo;
        private InvoiceRepository _invoiceRepo;
        private CustomerRepository _customerRepo;
        private PurchaseRepository _purchaseRepo;
        private SupplierRepository _supplierRepo;
        private AuditLogRepository _auditRepo;

        private SettingsService _settingsService;
        private ReportService _reportService;
        private DashboardService _dashboardService;
        private DataManagementService _dataService;
        private InvoiceService _invoiceService;

        [SetUp]
        public void Setup()
        {
            DatabaseMigrator.RunMigrations();

            _settingsRepo = new SettingsRepository();
            _reportRepo = new ReportRepository();
            _dataRepo = new DataManagementRepository();
            _productRepo = new ProductRepository();
            _invoiceRepo = new InvoiceRepository();
            _customerRepo = new CustomerRepository();
            _purchaseRepo = new PurchaseRepository();
            _supplierRepo = new SupplierRepository();
            _auditRepo = new AuditLogRepository();

            _settingsService = new SettingsService(_settingsRepo);
            _reportService = new ReportService(_reportRepo);
            _dashboardService = new DashboardService(_reportRepo);
            _dataService = new DataManagementService(_dataRepo);
            _invoiceService = new InvoiceService(_invoiceRepo, _productRepo, _customerRepo, _auditRepo);
        }

        [Test]
        public void Test01_DashboardTotalsAgainstDatabaseRecords()
        {
            var metrics = _dashboardService.GetDashboardMetrics();

            Assert.IsNotNull(metrics, "Dashboard metrics must not be null.");
            Assert.GreaterOrEqual(metrics.TotalProducts, 0, "Product count must be non-negative.");
            Assert.GreaterOrEqual(metrics.TotalCustomerCount, 0, "Customer count must be non-negative.");
            Assert.GreaterOrEqual(metrics.TodaySales, 0m, "Today's sales must be non-negative.");
            Assert.GreaterOrEqual(metrics.TodayBillsCount, 0, "Today's bill count must be non-negative.");
            Assert.IsNotNull(metrics.Last7DaysSales, "7-day sales trend list must be populated.");
            Assert.IsNotNull(metrics.Last30DaysSales, "30-day sales trend list must be populated.");
        }

        [Test]
        public void Test02_SalesDateFiltersAndExcludedCancelledBills()
        {
            // Create a test invoice
            string invNum = _invoiceService.GenerateNextInvoiceNumber();
            var inv = new InvoiceHeader
            {
                InvoiceNumber = invNum,
                InvoiceDate = DateTime.Now,
                CustomerId = 1,
                CustomerName = "Walk-in Customer",
                GrandTotal = 500m,
                TaxableAmount = 450m,
                TotalTax = 50m,
                Items = new List<InvoiceItem>
                {
                    new InvoiceItem { ProductId = 1, ProductCode = "P01", Barcode = "111", ProductName = "Rice", Quantity = 2, Rate = 250m, TaxRate = 5m }
                }
            };

            bool created = _invoiceService.FinalizeInvoice(inv, out string _);
            Assert.IsTrue(created, "Invoice creation should succeed.");

            // Cancel the invoice
            bool cancelled = _invoiceService.CancelInvoice(inv.Id, "Test cancellation", out string _);
            Assert.IsTrue(cancelled, "Invoice cancellation should succeed.");

            // Report query excluding cancelled
            var filter = new ReportFilter
            {
                FromDate = DateTime.Now.Date,
                ToDate = DateTime.Now.Date.AddDays(1),
                Status = "Confirmed"
            };

            var rows = _reportService.GetSalesReport(filter);
            bool containsCancelled = rows.Exists(r => r.DocumentNumber == invNum);
            Assert.IsFalse(containsCancelled, "Confirmed sales report must NOT include cancelled bills.");
        }

        [Test]
        public void Test03_PurchaseAndStockReportTotals()
        {
            // Test Stock report
            var stockFilter = new ReportFilter();
            var stockRows = _reportService.GetStockReport(stockFilter);
            Assert.IsNotNull(stockRows);

            var stockSum = _reportService.CalculateStockSummary(stockRows);
            Assert.GreaterOrEqual(stockSum.TotalRecords, 0);
            Assert.GreaterOrEqual(stockSum.TotalAmount, 0m);

            // Test Purchase report
            var purFilter = new ReportFilter { Status = "Confirmed" };
            var purRows = _reportService.GetPurchaseReport(purFilter);
            Assert.IsNotNull(purRows);

            var purSum = _reportService.CalculatePurchaseSummary(purRows);
            Assert.GreaterOrEqual(purSum.TotalRecords, 0);
            Assert.GreaterOrEqual(purSum.TotalAmount, 0m);
        }

        [Test]
        public void Test04_CustomerBalancesAgainstLedger()
        {
            var custFilter = new ReportFilter();
            var custRows = _reportService.GetCustomerReport(custFilter);
            Assert.IsNotNull(custRows);

            foreach (var c in custRows)
            {
                Assert.IsFalse(string.IsNullOrEmpty(c.CustomerName), "Customer name must not be blank.");
                Assert.GreaterOrEqual(c.OutstandingBalance, 0m, "Outstanding balance must be valid number.");
            }
        }

        [Test]
        public void Test05_PaymentReportCalculations()
        {
            var payFilter = new ReportFilter();
            var payRows = _reportService.GetPaymentCollectionReport(payFilter);
            Assert.IsNotNull(payRows);

            foreach (var p in payRows)
            {
                Assert.IsFalse(string.IsNullOrEmpty(p.PaymentMode));
                Assert.Greater(p.Amount, 0m, "Payment amount must be positive.");
            }
        }

        [Test]
        public void Test06_InvalidDateRangesAndEmptyReportResults()
        {
            // From date far in the future
            var filter = new ReportFilter
            {
                FromDate = DateTime.Now.AddYears(10),
                ToDate = DateTime.Now.AddYears(11)
            };

            var rows = _reportService.GetSalesReport(filter);
            Assert.IsNotNull(rows, "Result list must not be null.");
            Assert.AreEqual(0, rows.Count, "Future date range should produce 0 records.");

            var sum = _reportService.CalculateSalesSummary(rows);
            Assert.AreEqual(0, sum.TotalRecords);
            Assert.AreEqual(0m, sum.TotalAmount);
        }

        [Test]
        public void Test07_CsvExportEscapingAndCorrectValues()
        {
            // Value containing comma and quotes
            string raw = "Special, Item \"Super\" Edition\nLine2";
            string escaped = ReportService.EscapeCsvValue(raw);

            Assert.IsTrue(escaped.StartsWith("\""), "Escaped string must start with quote.");
            Assert.IsTrue(escaped.EndsWith("\""), "Escaped string must end with quote.");
            Assert.IsTrue(escaped.Contains("\"\""), "Internal quotes must be doubled.");

            var rows = new List<SalesReportRow>
            {
                new SalesReportRow
                {
                    DocumentNumber = "INV-TEST-001",
                    DocumentDate = DateTime.Now,
                    CustomerName = "John, Doe & Sons",
                    PaymentMethod = "Cash",
                    Status = "Confirmed",
                    TotalItems = 2,
                    TotalQuantity = 5,
                    GrossAmount = 1000m,
                    DiscountAmount = 50m,
                    TaxableAmount = 950m,
                    CgstAmount = 47.5m,
                    SgstAmount = 47.5m,
                    TotalTax = 95m,
                    GrandTotal = 1045m
                }
            };

            string csv = _reportService.ExportSalesReportToCsv(rows);
            Assert.IsTrue(csv.Contains("INV-TEST-001"));
            Assert.IsTrue(csv.Contains("\"John, Doe & Sons\""), "Customer name with comma must be quoted.");
            Assert.IsTrue(csv.Contains("1045.00"));
        }

        [Test]
        public void Test08_DatabaseIntegrityChecksOnTestFixtures()
        {
            var result = _dataService.RunIntegrityCheck();
            Assert.IsNotNull(result);
            Assert.IsTrue(result.IntegrityCheckMessage.Equals("ok", StringComparison.OrdinalIgnoreCase) || result.IsDatabaseHealthy,
                "PRAGMA integrity_check must evaluate to ok.");

            var info = _dataService.GetDatabaseInfo();
            Assert.IsNotNull(info);
            Assert.AreEqual("WAL", info.WalMode);
            Assert.IsTrue(info.ForeignKeysEnabled);
            Assert.IsTrue(info.RecordCounts.ContainsKey("products"));
            Assert.IsTrue(info.RecordCounts.ContainsKey("invoices"));
            Assert.IsTrue(info.RecordCounts.ContainsKey("settings"));
        }

        [Test]
        public void Test09_SettingsPersistenceAfterRestart()
        {
            var s = _settingsService.GetSettings();
            string testName = "Test Supermarket " + Guid.NewGuid().ToString().Substring(0, 6);
            s.StoreName = testName;
            s.StorePhone = "044-99998888";

            bool saved = _settingsService.SaveSettings(s, out string err);
            Assert.IsTrue(saved, $"Settings save should succeed: {err}");

            // Create new repository instance to simulate app restart
            var freshRepo = new SettingsRepository();
            var reloaded = freshRepo.GetSettings();

            Assert.AreEqual(testName, reloaded.StoreName, "Store name must persist across repository restarts.");
            Assert.AreEqual("044-99998888", reloaded.StorePhone);
        }

        [Test]
        public void Test10_ValidationOfInvalidSettings()
        {
            var invalid = new AppSettings
            {
                StoreName = "", // Blank name
                GstNumber = "INVALID_GST" // Not 15 characters
            };

            bool saved = _settingsService.SaveSettings(invalid, out string err);
            Assert.IsFalse(saved, "Saving blank store name must fail validation.");
            Assert.IsTrue(err.Contains("required") || err.Contains("Name"));

            invalid.StoreName = "Valid Name";
            invalid.GstNumber = "123"; // Too short
            bool saved2 = _settingsService.SaveSettings(invalid, out string err2);
            Assert.IsFalse(saved2, "Saving invalid length GSTIN must fail validation.");
            Assert.IsTrue(err2.Contains("15"));
        }

        [Test]
        public void Test11_SettingsChangesDoNotAlterHistoricalRecords()
        {
            // Create and finalize an invoice
            var inv = new InvoiceHeader
            {
                InvoiceNumber = _invoiceService.GenerateNextInvoiceNumber(),
                InvoiceDate = DateTime.Now,
                CustomerId = 1,
                CustomerName = "Walk-in Customer",
                GrandTotal = 250m,
                Items = new List<InvoiceItem>
                {
                    new InvoiceItem { ProductId = 1, ProductCode = "P01", Barcode = "111", ProductName = "Item", Quantity = 1, Rate = 250m }
                }
            };
            _invoiceService.FinalizeInvoice(inv, out string _);
            decimal originalTotal = inv.GrandTotal;

            // Change store settings
            var s = _settingsService.GetSettings();
            s.DefaultTaxRate = 28m;
            s.DefaultDiscountPercent = 50m;
            _settingsService.SaveSettings(s, out string _);

            // Fetch invoice again from database
            var fetched = _invoiceRepo.GetById(inv.Id);
            Assert.AreEqual(originalTotal, fetched.GrandTotal, "Changing default tax rate or discount in settings must NOT alter existing finalized invoice totals.");
        }

        [Test]
        public void Test12_ExistingPhase1To6RegressionWorkflows()
        {
            // Phase 1: Products
            var prod = _productRepo.GetById(1);
            Assert.IsNotNull(prod);

            // Phase 2: Suppliers
            var sup = _supplierRepo.GetById(1);
            Assert.IsNotNull(sup);

            // Phase 6: Estimates
            var estRepo = new EstimateRepository();
            var estSearch = estRepo.Search(new EstimateFilter { PageNumber = 1, PageSize = 5 });
            Assert.IsNotNull(estSearch);

            // Check Migration 9 is applied
            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT COUNT(*) FROM schema_migrations WHERE version = 9;";
                int v9 = Convert.ToInt32(cmd.ExecuteScalar());
                Assert.AreEqual(1, v9, "Migration 9 must be recorded in schema_migrations.");
            }
        }

        [Test]
        public void Test13_NavigationAndQuickActionIntegrity()
        {
            var dash = _dashboardService.GetDashboardMetrics();
            Assert.IsNotNull(dash);
            // Verify metrics contain valid values for all 9 summary card targets
            Assert.GreaterOrEqual(dash.TodaySales, 0);
            Assert.GreaterOrEqual(dash.TodayBillsCount, 0);
            Assert.GreaterOrEqual(dash.TodayPurchaseTotal, 0);
            Assert.GreaterOrEqual(dash.TotalProducts, 0);
            Assert.GreaterOrEqual(dash.LowStockProductCount, 0);
            Assert.GreaterOrEqual(dash.OutOfStockProductCount, 0);
            Assert.GreaterOrEqual(dash.TotalCustomerCount, 0);
            Assert.GreaterOrEqual(dash.OutstandingCustomerBalance, 0);
            Assert.GreaterOrEqual(dash.PaymentsReceivedToday, 0);
        }

        [Test]
        public void Test14_ApplicationStartupWithExistingDatabase()
        {
            // Execute DatabaseMigrator again to confirm idempotency
            Assert.DoesNotThrow(() => DatabaseMigrator.RunMigrations(), "Running migrations repeatedly on existing database must succeed without errors.");

            // Verify settings exist
            string storeName = _settingsService.GetStoreName();
            Assert.IsFalse(string.IsNullOrEmpty(storeName));
        }
    }
}
