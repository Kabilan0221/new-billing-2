using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using ShopBilling.Core.Models;
using ShopBilling.Core.Services;
using ShopBilling.Data.Database;
using ShopBilling.Data.Repositories;

namespace ShopBilling.Tests
{
    [TestClass]
    public class Phase4PosBillingTests
    {
        private string testDbPath;
        private ProductRepository productRepo;
        private CategoryRepository categoryRepo;
        private BrandRepository brandRepo;
        private AuditLogRepository auditRepo;
        private SupplierRepository supplierRepo;
        private PurchaseRepository purchaseRepo;
        private StockMovementRepository stockMoveRepo;
        private StockRepository stockRepo;
        private CustomerRepository customerRepo;
        private InvoiceRepository invoiceRepo;

        private ProductService productService;
        private InvoiceService invoiceService;
        private StockService stockService;

        [TestInitialize]
        public void Setup()
        {
            testDbPath = Path.Combine(Path.GetTempPath(), $"ShopBilling_Phase4_{Guid.NewGuid():N}.db");
            DatabaseConnection.Initialize(testDbPath);
            DatabaseMigrator.RunMigrations();

            productRepo = new ProductRepository();
            categoryRepo = new CategoryRepository();
            brandRepo = new BrandRepository();
            auditRepo = new AuditLogRepository();
            supplierRepo = new SupplierRepository();
            purchaseRepo = new PurchaseRepository();
            stockMoveRepo = new StockMovementRepository();
            stockRepo = new StockRepository();
            customerRepo = new CustomerRepository();
            invoiceRepo = new InvoiceRepository();

            productService = new ProductService(productRepo, auditRepo);
            invoiceService = new InvoiceService(invoiceRepo, productRepo, customerRepo, auditRepo);
            stockService = new StockService(stockRepo, productRepo, auditRepo);
        }

        [TestCleanup]
        public void Teardown()
        {
            try
            {
                if (File.Exists(testDbPath)) File.Delete(testDbPath);
            }
            catch { }
        }

        // Test 1: Product search by barcode, SKU, and name
        [TestMethod]
        public void Test01_ProductSearch_Barcode_SKU_Name()
        {
            var p = new Product
            {
                ProductCode = "PRD-POS-01",
                Barcode = "890100000001",
                NameEn = "Tata Tea Gold 250g",
                PurchaseRate = 110m,
                SaleRate = 140m,
                TaxRate = 5m,
                OpeningStock = 50m
            };
            productService.SaveProduct(p);

            var byBar = productService.GetProductByBarcode("890100000001");
            Assert.IsNotNull(byBar);
            Assert.AreEqual("Tata Tea Gold 250g", byBar.NameEn);

            var byCode = productService.GetProductByCode("PRD-POS-01");
            Assert.IsNotNull(byCode);

            var byName = productService.SearchProducts(new ProductFilter { SearchTerm = "Tata Tea" });
            Assert.IsTrue(byName.Items.Any(x => x.Id == p.Id));
        }

        // Test 2 & 3: Adding items, quantity changes, and line totals
        [TestMethod]
        public void Test02_03_LineTotals_And_ItemDiscount()
        {
            var inv = new InvoiceHeader
            {
                InvoiceNumber = "INV-2026-TEST01",
                Items = new List<InvoiceItem>
                {
                    new InvoiceItem
                    {
                        ProductId = 1,
                        ProductName = "Rice 5kg",
                        Quantity = 2m,
                        Rate = 300m,
                        DiscountPercent = 10m, // 10% of 600 = 60
                        TaxRate = 5m
                    }
                }
            };

            InvoiceService.CalculateInvoice(inv);

            var item = inv.Items[0];
            Assert.AreEqual(60m, item.DiscountAmount, "10% of 600 is 60");
            Assert.AreEqual(540m, item.TaxableAmount, "600 - 60 = 540");
            Assert.AreEqual(27m, item.TaxAmount, "5% of 540 is 27");
            Assert.AreEqual(567m, item.LineTotal, "540 + 27 = 567");
            Assert.AreEqual(567m, inv.GrandTotal);
        }

        // Test 4 & 5: Intra-state (CGST + SGST) vs Inter-state (IGST) calculations
        [TestMethod]
        public void Test04_05_GstCalculations_Intrastate_And_Interstate()
        {
            // Intra-state (Tamil Nadu)
            var invIntra = new InvoiceHeader
            {
                IsInterstate = false,
                Items = new List<InvoiceItem>
                {
                    new InvoiceItem { ProductId = 1, Quantity = 1m, Rate = 1000m, TaxRate = 18m }
                }
            };
            InvoiceService.CalculateInvoice(invIntra);

            Assert.AreEqual(90m, invIntra.CgstAmount, "CGST should be 9% = 90");
            Assert.AreEqual(90m, invIntra.SgstAmount, "SGST should be 9% = 90");
            Assert.AreEqual(0m, invIntra.IgstAmount, "IGST should be 0");
            Assert.AreEqual(180m, invIntra.TotalTaxAmount);
            Assert.AreEqual(1180m, invIntra.GrandTotal);

            // Inter-state (e.g. Karnataka / Kerala)
            var invInter = new InvoiceHeader
            {
                IsInterstate = true,
                Items = new List<InvoiceItem>
                {
                    new InvoiceItem { ProductId = 1, Quantity = 1m, Rate = 1000m, TaxRate = 18m }
                }
            };
            InvoiceService.CalculateInvoice(invInter);

            Assert.AreEqual(0m, invInter.CgstAmount, "CGST should be 0");
            Assert.AreEqual(0m, invInter.SgstAmount, "SGST should be 0");
            Assert.AreEqual(180m, invInter.IgstAmount, "IGST should be 18% = 180");
            Assert.AreEqual(180m, invInter.TotalTaxAmount);
            Assert.AreEqual(1180m, invInter.GrandTotal);
        }

        // Test 6: Bill-level discount calculation
        [TestMethod]
        public void Test06_BillLevelDiscount_Calculation()
        {
            var inv = new InvoiceHeader
            {
                BillDiscount = 50m,
                Items = new List<InvoiceItem>
                {
                    new InvoiceItem { ProductId = 1, Quantity = 1m, Rate = 500m, TaxRate = 0m }
                }
            };
            InvoiceService.CalculateInvoice(inv);

            Assert.AreEqual(450m, inv.TaxableAmount, "500 - 50 discount = 450");
            Assert.AreEqual(450m, inv.GrandTotal);
        }

        // Test 7: Split payments (Cash + UPI) and Cash change
        [TestMethod]
        public void Test07_SplitPayments_And_ChangeCalculation()
        {
            var inv = new InvoiceHeader
            {
                Items = new List<InvoiceItem>
                {
                    new InvoiceItem { ProductId = 1, Quantity = 1m, Rate = 1000m, TaxRate = 0m }
                },
                Payments = new List<InvoicePayment>
                {
                    new InvoicePayment { PaymentMethod = "UPI", Amount = 400m },
                    new InvoicePayment { PaymentMethod = "Cash", Amount = 700m } // Total paid = 1100
                }
            };
            InvoiceService.CalculateInvoice(inv);

            Assert.AreEqual(1000m, inv.GrandTotal);
            Assert.AreEqual(1100m, inv.AmountPaid);
            Assert.AreEqual(100m, inv.CashChange, "Change to return is 1100 - 1000 = 100");
            Assert.AreEqual(0m, inv.BalanceDue);
            Assert.AreEqual("Paid", inv.PaymentStatus);
        }

        // Test 8: Partial payment and Credit sale (outstanding balance)
        [TestMethod]
        public void Test08_PartialPayment_CreditSale()
        {
            var inv = new InvoiceHeader
            {
                Items = new List<InvoiceItem>
                {
                    new InvoiceItem { ProductId = 1, Quantity = 1m, Rate = 1000m, TaxRate = 0m }
                },
                Payments = new List<InvoicePayment>
                {
                    new InvoicePayment { PaymentMethod = "Cash", Amount = 300m }
                }
            };
            InvoiceService.CalculateInvoice(inv);

            Assert.AreEqual(700m, inv.BalanceDue, "Balance due is 1000 - 300 = 700");
            Assert.AreEqual("Partial", inv.PaymentStatus);
        }

        // Test 9 & 10: Finalized sale updates stock exactly once and logs stock movement
        [TestMethod]
        public void Test09_10_FinalizedSale_ReducesStock_ExactlyOnce_AndLogsMovement()
        {
            var p = new Product
            {
                ProductCode = "PRD-POS-STK",
                Barcode = "890100000020",
                NameEn = "Cooking Oil 1L",
                PurchaseRate = 80m,
                SaleRate = 100m,
                OpeningStock = 30m
            };
            productService.SaveProduct(p);

            var inv = new InvoiceHeader
            {
                InvoiceNumber = "INV-2026-STK01",
                CustomerId = 1,
                Items = new List<InvoiceItem>
                {
                    new InvoiceItem
                    {
                        ProductId = p.Id,
                        ProductCode = p.ProductCode,
                        Barcode = p.Barcode,
                        ProductName = p.NameEn,
                        Quantity = 5m,
                        Rate = 100m
                    }
                }
            };

            bool ok = invoiceService.FinalizeInvoice(inv, out string error);
            Assert.IsTrue(ok, $"Finalize failed: {error}");

            // Stock should reduce from 30 to 25
            var afterProd = productService.GetProductById(p.Id);
            Assert.AreEqual(25m, afterProd.CurrentStock, "Stock should be 30 - 5 = 25");

            // Movement logged
            var moves = stockMoveRepo.GetByProductId(p.Id).ToList();
            Assert.IsTrue(moves.Any(m => m.ReferenceType == "SALES_INVOICE" && m.ReferenceId == "INV-2026-STK01"));

            // Duplicate finalize rejected
            bool dupOk = invoiceService.FinalizeInvoice(inv, out string dupErr);
            Assert.IsFalse(dupOk, "Duplicate confirmation must be rejected");
            Assert.AreEqual(25m, productService.GetProductById(p.Id).CurrentStock, "Duplicate finalization must NOT reduce stock again");
        }

        // Test 11: Insufficient stock validation prevents sale
        [TestMethod]
        public void Test11_InsufficientStock_PreventsSale()
        {
            var p = new Product
            {
                ProductCode = "PRD-LOW",
                Barcode = "890100000030",
                NameEn = "Limited Item",
                SaleRate = 50m,
                OpeningStock = 3m
            };
            productService.SaveProduct(p);

            var inv = new InvoiceHeader
            {
                InvoiceNumber = "INV-2026-LOW01",
                Items = new List<InvoiceItem>
                {
                    new InvoiceItem
                    {
                        ProductId = p.Id,
                        ProductName = p.NameEn,
                        Quantity = 10m, // Stock is only 3
                        Rate = 50m
                    }
                }
            };

            bool ok = invoiceService.FinalizeInvoice(inv, out string error);
            Assert.IsFalse(ok, "Sale must be rejected when quantity exceeds stock");
            Assert.IsTrue(error.Contains("Insufficient stock"));
            Assert.AreEqual(3m, productService.GetProductById(p.Id).CurrentStock, "Stock must remain unchanged");
        }

        // Test 12: Draft bill does NOT alter stock
        [TestMethod]
        public void Test12_DraftBill_DoesNotAffectStock()
        {
            var p = new Product
            {
                ProductCode = "PRD-DFT",
                Barcode = "890100000040",
                NameEn = "Draft Item",
                SaleRate = 60m,
                OpeningStock = 20m
            };
            productService.SaveProduct(p);

            var inv = new InvoiceHeader
            {
                InvoiceNumber = "INV-2026-DFT01",
                Items = new List<InvoiceItem>
                {
                    new InvoiceItem { ProductId = p.Id, Quantity = 5m, Rate = 60m }
                }
            };

            var res = invoiceService.SaveDraft(inv);
            Assert.IsTrue(res.IsValid);
            Assert.AreEqual(20m, productService.GetProductById(p.Id).CurrentStock, "Draft must not alter stock");
        }

        // Test 13: Cancel/Void invoice restores stock safely
        [TestMethod]
        public void Test13_CancelInvoice_RestoresStockSafely()
        {
            var p = new Product
            {
                ProductCode = "PRD-VOI",
                Barcode = "890100000050",
                NameEn = "Void Item",
                SaleRate = 80m,
                OpeningStock = 40m
            };
            productService.SaveProduct(p);

            var inv = new InvoiceHeader
            {
                InvoiceNumber = "INV-2026-VOI01",
                Items = new List<InvoiceItem>
                {
                    new InvoiceItem { ProductId = p.Id, Quantity = 8m, Rate = 80m }
                }
            };

            invoiceService.FinalizeInvoice(inv, out string err);
            Assert.AreEqual(32m, productService.GetProductById(p.Id).CurrentStock);

            // Cancel
            bool cancelOk = invoiceService.CancelInvoice(inv.Id, "Customer returned immediately before leaving", out string cancelErr);
            Assert.IsTrue(cancelOk, cancelErr);

            // Stock restored to 40
            Assert.AreEqual(40m, productService.GetProductById(p.Id).CurrentStock, "Stock must be restored back to 40");

            // Movement logged
            var moves = stockMoveRepo.GetByProductId(p.Id).ToList();
            Assert.IsTrue(moves.Any(m => m.ReferenceType == "SALES_CANCEL"));

            // Duplicate cancel rejected
            bool dupCancel = invoiceService.CancelInvoice(inv.Id, "Cancel again", out string dupErr);
            Assert.IsFalse(dupCancel, "Duplicate cancel must be rejected");
        }

        // Test 14: Sequential unique invoice number generation
        [TestMethod]
        public void Test14_UniqueInvoiceNumbering()
        {
            string num1 = invoiceService.GenerateNextInvoiceNumber();
            Assert.IsTrue(num1.StartsWith($"INV-{DateTime.UtcNow.Year}-"));

            var inv = new InvoiceHeader
            {
                InvoiceNumber = num1,
                Items = new List<InvoiceItem> { new InvoiceItem { ProductId = 1, Quantity = 1m, Rate = 10m } }
            };
            invoiceService.SaveDraft(inv);

            string num2 = invoiceService.GenerateNextInvoiceNumber();
            Assert.AreNotEqual(num1, num2);
        }

        // Test 15: Bill history search and filtering
        [TestMethod]
        public void Test15_BillHistory_SearchAndFilters()
        {
            var inv1 = new InvoiceHeader
            {
                InvoiceNumber = "INV-2026-HIST1",
                CustomerName = "Ramesh Kumar",
                PaymentStatus = "Paid",
                Items = new List<InvoiceItem> { new InvoiceItem { ProductId = 1, Quantity = 1m, Rate = 100m } }
            };
            invoiceService.SaveDraft(inv1);

            var inv2 = new InvoiceHeader
            {
                InvoiceNumber = "INV-2026-HIST2",
                CustomerName = "Suresh Pillai",
                PaymentStatus = "Unpaid",
                Items = new List<InvoiceItem> { new InvoiceItem { ProductId = 1, Quantity = 1m, Rate = 200m } }
            };
            invoiceService.SaveDraft(inv2);

            var searchRes = invoiceService.SearchInvoices(new InvoiceFilter { SearchTerm = "Ramesh" });
            Assert.AreEqual(1, searchRes.TotalCount);
            Assert.AreEqual("Ramesh Kumar", searchRes.Items[0].CustomerName);

            var payRes = invoiceService.SearchInvoices(new InvoiceFilter { PaymentStatus = "Unpaid" });
            Assert.IsTrue(payRes.Items.Any(i => i.InvoiceNumber == "INV-2026-HIST2"));
        }
    }
}
