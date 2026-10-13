using System;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using ShopBilling.Core.Models;
using ShopBilling.Core.Services;
using ShopBilling.Data.Database;
using ShopBilling.Data.Repositories;

namespace ShopBilling.Tests
{
    [TestFixture]
    public class Phase6BarcodeAndEstimateTests
    {
        private ProductRepository _productRepo;
        private CustomerRepository _customerRepo;
        private InvoiceRepository _invoiceRepo;
        private EstimateRepository _estimateRepo;
        private AuditLogRepository _auditRepo;

        private ProductService _productService;
        private BarcodeService _barcodeService;
        private EstimateService _estimateService;
        private InvoiceService _invoiceService;

        [SetUp]
        public void Setup()
        {
            DatabaseMigrator.RunMigrations();

            _productRepo = new ProductRepository();
            _customerRepo = new CustomerRepository();
            _invoiceRepo = new InvoiceRepository();
            _estimateRepo = new EstimateRepository();
            _auditRepo = new AuditLogRepository();

            _productService = new ProductService(_productRepo, _auditRepo);
            _barcodeService = new BarcodeService(_productRepo, _auditRepo);
            _estimateService = new EstimateService(_estimateRepo, _productRepo, _customerRepo, _auditRepo);
            _invoiceService = new InvoiceService(_invoiceRepo, _productRepo, _customerRepo, _auditRepo);
        }

        [Test]
        public void Test01_BarcodeValidationAndUniqueness()
        {
            // Code 128
            var validCode128 = _barcodeService.ValidateBarcode("PROD-TEST-1234", "Code128");
            Assert.IsTrue(validCode128.IsValid, "Valid Code 128 should pass validation.");

            var invalidCode128 = _barcodeService.ValidateBarcode("", "Code128");
            Assert.IsFalse(invalidCode128.IsValid, "Empty barcode should be invalid.");

            // EAN-13 Checksum
            int checkDigit = BarcodeService.CalculateEan13CheckDigit("890123456789");
            Assert.AreEqual(7, checkDigit, "EAN-13 check digit for '890123456789' should be 7.");

            var validEan = _barcodeService.ValidateBarcode("8901234567897", "EAN13");
            Assert.IsTrue(validEan.IsValid, "Valid EAN-13 with matching check digit should pass.");

            var badEan = _barcodeService.ValidateBarcode("8901234567899", "EAN13");
            Assert.IsFalse(badEan.IsValid, "EAN-13 with mismatched check digit must fail.");
        }

        [Test]
        public void Test02_BarcodePersistenceAgainstCorrectProductWithoutAlteringPriceOrStock()
        {
            string code = $"PTEST_{Guid.NewGuid():N}".Substring(0, 10);
            var prod = new Product
            {
                ProductCode = code,
                Barcode = $"BC_{Guid.NewGuid():N}".Substring(0, 12),
                NameEn = "Barcode Update Test Product",
                Unit = "PCS",
                PurchaseRate = 100m,
                SaleRate = 150m,
                Mrp = 160m,
                CurrentStock = 75m,
                TaxRate = 18m,
                IsActive = true
            };
            long id = _productRepo.Insert(prod);
            Assert.Greater(id, 0);

            string newBarcode = $"NEWBC_{Guid.NewGuid():N}".Substring(0, 12);
            bool updated = _barcodeService.AssignBarcodeToProduct(id, newBarcode, true, out string err);
            Assert.IsTrue(updated, $"Barcode assignment should succeed: {err}");

            var fetched = _productRepo.GetById(id);
            Assert.AreEqual(newBarcode, fetched.Barcode);
            Assert.AreEqual(150m, fetched.SaleRate, "SaleRate must not be altered.");
            Assert.AreEqual(75m, fetched.CurrentStock, "CurrentStock must remain exactly unchanged.");
        }

        [Test]
        public void Test03_LabelQuantityAndLayoutCalculations()
        {
            var items = new List<BarcodeStudioItem>
            {
                new BarcodeStudioItem { ProductId = 1, NameEn = "Item A", LabelCount = 10, IsSelected = true },
                new BarcodeStudioItem { ProductId = 2, NameEn = "Item B", LabelCount = 14, IsSelected = true },
                new BarcodeStudioItem { ProductId = 3, NameEn = "Item C", LabelCount = 5, IsSelected = false }
            };

            var config = new BarcodePrintConfig
            {
                LabelsPerRow = 3,
                LabelHeightMm = 25f,
                VerticalGapMm = 3f,
                PageMarginTopMm = 10f
            };

            var (totalLabels, totalSheets) = _barcodeService.CalculateLayoutMetrics(items, config);
            Assert.AreEqual(24, totalLabels, "Only selected items should be counted (10 + 14 = 24).");
            Assert.GreaterOrEqual(totalSheets, 1, "Should require at least 1 sheet.");
        }

        [Test]
        public void Test04_EstimateCreationEditingAndCancellation()
        {
            var est = new EstimateHeader
            {
                CustomerId = 1,
                CustomerName = "Walk-in Customer",
                EstimateDate = DateTime.Now,
                ValidUntil = DateTime.Now.AddDays(15),
                Items = new List<EstimateItem>
                {
                    new EstimateItem
                    {
                        ProductId = 1,
                        ProductCode = "PRD001",
                        Barcode = "8901030000001",
                        ProductName = "Aashirvaad Atta 5kg",
                        Quantity = 3,
                        Rate = 250m,
                        TaxRate = 5m
                    }
                }
            };

            var saveRes = _estimateService.SaveDraft(est);
            Assert.IsTrue(saveRes.IsValid, "Estimate draft should save successfully.");
            Assert.Greater(est.Id, 0);
            Assert.IsTrue(est.EstimateNumber.StartsWith("EST-"), "Estimate number should start with EST-");

            // Update item quantity
            est.Items[0].Quantity = 5;
            var updateRes = _estimateService.SaveDraft(est);
            Assert.IsTrue(updateRes.IsValid);

            var loaded = _estimateService.GetById(est.Id);
            Assert.AreEqual(5, loaded.Items[0].Quantity);
            Assert.AreEqual("Draft", loaded.Status);

            // Confirm
            bool confirmed = _estimateService.ConfirmEstimate(est.Id, out string confErr);
            Assert.IsTrue(confirmed, $"Confirming estimate should succeed: {confErr}");
            Assert.AreEqual("Confirmed", _estimateService.GetById(est.Id).Status);

            // Cancel
            bool cancelled = _estimateService.CancelEstimate(est.Id, "Customer requested cancellation", out string cancelErr);
            Assert.IsTrue(cancelled, $"Cancelling estimate should succeed: {cancelErr}");
            Assert.AreEqual("Cancelled", _estimateService.GetById(est.Id).Status);
        }

        [Test]
        public void Test05_GstDiscountAndTotalCalculations()
        {
            var est = new EstimateHeader
            {
                CustomerId = 1,
                IsInterstate = false, // Intra-state: CGST + SGST
                BillDiscount = 50m,
                Items = new List<EstimateItem>
                {
                    new EstimateItem
                    {
                        ProductId = 1,
                        ProductName = "Item 1",
                        Quantity = 10,
                        Rate = 100m, // Gross: 1000
                        DiscountPercent = 10m, // Line Disc: 100 => Taxable: 900
                        TaxRate = 18m // CGST: 9%, SGST: 9%
                    }
                }
            };

            EstimateService.CalculateEstimate(est);

            Assert.AreEqual(1000m, est.GrossAmount);
            Assert.AreEqual(100m, est.ItemDiscount);
            Assert.AreEqual(50m, est.BillDiscount);
            Assert.AreEqual(850m, est.TaxableAmount, "Taxable should be 900 - 50 = 850");

            // 18% of 850 = 153 => CGST: 76.50, SGST: 76.50
            Assert.AreEqual(76.50m, est.CgstAmount);
            Assert.AreEqual(76.50m, est.SgstAmount);
            Assert.AreEqual(153m, est.TotalTaxAmount);
            Assert.AreEqual(1003m, est.GrandTotal, "Grand Total: 850 + 153 = 1003");
        }

        [Test]
        public void Test06_UniqueInvoiceNumbering()
        {
            string num1 = _invoiceService.GenerateNextInvoiceNumber();
            string num2 = _invoiceService.GenerateNextInvoiceNumber();
            Assert.IsNotNull(num1);
            Assert.IsNotNull(num2);
            Assert.IsTrue(num1.StartsWith("INV-"));
        }

        [Test]
        public void Test07_SuccessfulEstimateToInvoiceConversion()
        {
            // Create a test product with ample stock
            string pCode = $"EST_CONV_{Guid.NewGuid():N}".Substring(0, 10);
            long pId = _productRepo.Insert(new Product
            {
                ProductCode = pCode,
                Barcode = $"BC_{Guid.NewGuid():N}".Substring(0, 12),
                NameEn = "Conversion Test Product",
                Unit = "PCS",
                PurchaseRate = 80m,
                SaleRate = 120m,
                CurrentStock = 50m,
                TaxRate = 12m,
                IsActive = true
            });

            var est = new EstimateHeader
            {
                CustomerId = 1,
                CustomerName = "Walk-in Customer",
                Items = new List<EstimateItem>
                {
                    new EstimateItem
                    {
                        ProductId = pId,
                        ProductCode = pCode,
                        Barcode = "123456",
                        ProductName = "Conversion Test Product",
                        Quantity = 10,
                        Rate = 120m,
                        TaxRate = 12m
                    }
                }
            };

            _estimateService.SaveDraft(est);

            // Convert to Invoice
            bool success = _estimateService.ConvertToInvoice(est.Id, null, out InvoiceHeader invoice, out string err);
            Assert.IsTrue(success, $"Conversion should succeed: {err}");
            Assert.IsNotNull(invoice);
            Assert.IsTrue(invoice.InvoiceNumber.StartsWith("INV-"));
            Assert.AreEqual("Confirmed", invoice.Status);

            // Estimate status should be Converted
            var updatedEst = _estimateService.GetById(est.Id);
            Assert.AreEqual("Converted", updatedEst.Status);
            Assert.AreEqual(invoice.Id, updatedEst.ConvertedInvoiceId);
            Assert.AreEqual(invoice.InvoiceNumber, updatedEst.ConvertedInvoiceNumber);

            // Product stock should have decremented from 50 to 40
            var pUpdated = _productRepo.GetById(pId);
            Assert.AreEqual(40m, pUpdated.CurrentStock, "Stock should be decremented only upon invoice conversion.");
        }

        [Test]
        public void Test08_DuplicateConversionPrevention()
        {
            string pCode = $"EST_DUP_{Guid.NewGuid():N}".Substring(0, 10);
            long pId = _productRepo.Insert(new Product
            {
                ProductCode = pCode,
                Barcode = $"BC_{Guid.NewGuid():N}".Substring(0, 12),
                NameEn = "Duplicate Prevention Product",
                Unit = "PCS",
                PurchaseRate = 50m,
                SaleRate = 100m,
                CurrentStock = 100m,
                TaxRate = 5m,
                IsActive = true
            });

            var est = new EstimateHeader
            {
                CustomerId = 1,
                Items = new List<EstimateItem>
                {
                    new EstimateItem { ProductId = pId, ProductCode = pCode, Barcode = "111", ProductName = "Prod", Quantity = 5, Rate = 100m, TaxRate = 5m }
                }
            };
            _estimateService.SaveDraft(est);

            // First conversion succeeds
            bool first = _estimateService.ConvertToInvoice(est.Id, null, out InvoiceHeader inv1, out string err1);
            Assert.IsTrue(first, "First conversion must succeed.");

            // Second conversion must be rejected
            bool second = _estimateService.ConvertToInvoice(est.Id, null, out InvoiceHeader inv2, out string err2);
            Assert.IsFalse(second, "Second conversion attempt on already converted estimate must be rejected.");
            Assert.IsTrue(err2.Contains("already been converted"), $"Error message should state already converted: {err2}");
        }

        [Test]
        public void Test09_NoStockDeductionForEstimates()
        {
            string pCode = $"EST_NOSTK_{Guid.NewGuid():N}".Substring(0, 10);
            long pId = _productRepo.Insert(new Product
            {
                ProductCode = pCode,
                Barcode = $"BC_{Guid.NewGuid():N}".Substring(0, 12),
                NameEn = "No Stock Deduction Test",
                Unit = "PCS",
                CurrentStock = 35m,
                SaleRate = 200m,
                TaxRate = 18m,
                IsActive = true
            });

            var est = new EstimateHeader
            {
                CustomerId = 1,
                Items = new List<EstimateItem>
                {
                    new EstimateItem { ProductId = pId, ProductCode = pCode, Barcode = "999", ProductName = "Item", Quantity = 15, Rate = 200m, TaxRate = 18m }
                }
            };

            // Save draft
            _estimateService.SaveDraft(est);
            Assert.AreEqual(35m, _productRepo.GetById(pId).CurrentStock, "Stock must NOT change on estimate draft save.");

            // Confirm estimate
            _estimateService.ConfirmEstimate(est.Id, out string _);
            Assert.AreEqual(35m, _productRepo.GetById(pId).CurrentStock, "Stock must NOT change on estimate confirmation.");

            // Cancel estimate
            _estimateService.CancelEstimate(est.Id, "Cancelled test", out string _);
            Assert.AreEqual(35m, _productRepo.GetById(pId).CurrentStock, "Stock must NOT change on estimate cancellation.");
        }

        [Test]
        public void Test10_CorrectStockChangesAtInvoiceFinalization()
        {
            string pCode = $"STK_FIN_{Guid.NewGuid():N}".Substring(0, 10);
            long pId = _productRepo.Insert(new Product
            {
                ProductCode = pCode,
                Barcode = $"BC_{Guid.NewGuid():N}".Substring(0, 12),
                NameEn = "Finalize Stock Product",
                Unit = "PCS",
                CurrentStock = 20m,
                SaleRate = 50m,
                TaxRate = 0m,
                IsActive = true
            });

            var inv = new InvoiceHeader
            {
                CustomerId = 1,
                CustomerName = "Walk-in Customer",
                Items = new List<InvoiceItem>
                {
                    new InvoiceItem { ProductId = pId, ProductCode = pCode, Barcode = "000", ProductName = "Finalize Prod", Quantity = 7, Rate = 50m, TaxRate = 0m }
                }
            };

            bool success = _invoiceService.FinalizeInvoice(inv, out string err);
            Assert.IsTrue(success, $"Finalizing invoice should succeed: {err}");

            var pAfter = _productRepo.GetById(pId);
            Assert.AreEqual(13m, pAfter.CurrentStock, "Stock should be decremented from 20 to 13 (20 - 7).");
        }

        [Test]
        public void Test11_TransactionRollbackAfterSimulatedFailures()
        {
            string pCode = $"ROLLBACK_{Guid.NewGuid():N}".Substring(0, 10);
            long pId = _productRepo.Insert(new Product
            {
                ProductCode = pCode,
                Barcode = $"BC_{Guid.NewGuid():N}".Substring(0, 12),
                NameEn = "Rollback Test Product",
                Unit = "PCS",
                CurrentStock = 5m, // Only 5 available
                SaleRate = 100m,
                TaxRate = 5m,
                IsActive = true
            });

            var est = new EstimateHeader
            {
                CustomerId = 1,
                Items = new List<EstimateItem>
                {
                    new EstimateItem { ProductId = pId, ProductCode = pCode, Barcode = "333", ProductName = "Item", Quantity = 20, Rate = 100m, TaxRate = 5m } // Requesting 20
                }
            };
            _estimateService.SaveDraft(est);

            // Conversion must fail due to insufficient stock
            bool success = _estimateService.ConvertToInvoice(est.Id, null, out InvoiceHeader inv, out string err);
            Assert.IsFalse(success, "Conversion must fail when requested qty exceeds current stock.");
            Assert.IsTrue(err.Contains("Insufficient stock"), $"Error message should mention insufficient stock: {err}");

            // Verify status remained Draft and stock remained 5
            Assert.AreEqual("Draft", _estimateService.GetById(est.Id).Status);
            Assert.AreEqual(5m, _productRepo.GetById(pId).CurrentStock, "Stock must remain rolled back and intact.");
        }

        [Test]
        public void Test12_InvoicePaymentCustomerLedgerAndBillHistoryIntegration()
        {
            var customer = new Customer
            {
                Name = "Phase 6 Integration Customer",
                Mobile = "9840198401",
                StateCode = "33",
                State = "Tamil Nadu"
            };
            long custId = _customerRepo.Insert(customer);

            string pCode = $"INT_{Guid.NewGuid():N}".Substring(0, 10);
            long pId = _productRepo.Insert(new Product
            {
                ProductCode = pCode,
                Barcode = $"BC_{Guid.NewGuid():N}".Substring(0, 12),
                NameEn = "Integration Test Item",
                Unit = "PCS",
                CurrentStock = 50m,
                SaleRate = 500m,
                TaxRate = 18m,
                IsActive = true
            });

            var est = new EstimateHeader
            {
                CustomerId = custId,
                CustomerName = customer.Name,
                Items = new List<EstimateItem>
                {
                    new EstimateItem { ProductId = pId, ProductCode = pCode, Barcode = "444", ProductName = "Item", Quantity = 2, Rate = 500m, TaxRate = 18m }
                }
            };
            _estimateService.SaveDraft(est);

            bool conv = _estimateService.ConvertToInvoice(est.Id, null, out InvoiceHeader inv, out string err);
            Assert.IsTrue(conv, $"Conversion should succeed: {err}");

            // Verify bill history contains converted invoice
            var bill = _invoiceService.GetByNumber(inv.InvoiceNumber);
            Assert.IsNotNull(bill, "Converted invoice must be found in bill history.");
            Assert.AreEqual(est.Id, bill.EstimateId);
            Assert.AreEqual(est.EstimateNumber, bill.EstimateNumber);
        }

        [Test]
        public void Test13_DataPersistenceAfterRestartingApplication()
        {
            var est = new EstimateHeader
            {
                CustomerId = 1,
                CustomerName = "Persistence Customer",
                Notes = "Persistence verification test note",
                Items = new List<EstimateItem>
                {
                    new EstimateItem { ProductId = 1, ProductCode = "P01", Barcode = "111", ProductName = "Atta", Quantity = 1, Rate = 100m, TaxRate = 5m }
                }
            };
            _estimateService.SaveDraft(est);
            long id = est.Id;

            // Re-instantiate repository (simulating app restart)
            var freshRepo = new EstimateRepository();
            var reloaded = freshRepo.GetById(id);

            Assert.IsNotNull(reloaded, "Estimate must persist in SQLite database across repository restarts.");
            Assert.AreEqual("Persistence verification test note", reloaded.Notes);
            Assert.AreEqual(1, reloaded.Items.Count);
        }

        [Test]
        public void Test14_RegressionOfCriticalPhase1To5Workflows()
        {
            // Verify Product Master query
            var prodList = _productRepo.Search("", 1, 10);
            Assert.IsNotNull(prodList);
            Assert.GreaterOrEqual(prodList.TotalCount, 0);

            // Verify Customers query
            var cust = _customerRepo.GetById(1);
            Assert.IsNotNull(cust, "Walk-in customer must exist.");

            // Verify Database Migration Table
            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT COUNT(*) FROM schema_migrations WHERE version = 8";
                int count = Convert.ToInt32(cmd.ExecuteScalar());
                Assert.AreEqual(1, count, "Migration 8 must be successfully recorded.");
            }
        }
    }
}
