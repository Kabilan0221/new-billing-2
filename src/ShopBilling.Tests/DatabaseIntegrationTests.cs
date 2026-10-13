using System;
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
    public class DatabaseIntegrationTests
    {
        private string testDbPath;
        private ProductRepository productRepo;
        private CategoryRepository categoryRepo;
        private BrandRepository brandRepo;
        private AuditLogRepository auditRepo;
        private ProductService productService;

        [TestInitialize]
        public void Setup()
        {
            testDbPath = Path.Combine(Path.GetTempPath(), $"ShopBilling_Test_{Guid.NewGuid():N}.db");
            DatabaseConnection.Initialize(testDbPath);
            DatabaseMigrator.RunMigrations();

            productRepo = new ProductRepository();
            categoryRepo = new CategoryRepository();
            brandRepo = new BrandRepository();
            auditRepo = new AuditLogRepository();
            productService = new ProductService(productRepo, auditRepo);
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

        [TestMethod]
        public void Migrations_CreatesDefaultSeedCategoriesAndBrands()
        {
            var categories = categoryRepo.GetAll().ToList();
            Assert.IsTrue(categories.Count >= 6, "Expected at least 6 default categories seeded by migration v3");

            var brands = brandRepo.GetAll().ToList();
            Assert.IsTrue(brands.Count >= 8, "Expected at least 8 default brands seeded by migration v3");
        }

        [TestMethod]
        public void ProductCRUD_WithTamilUnicode_PreservesTamilCharacters()
        {
            var p = new Product
            {
                ProductCode = "PRD-TEST-01",
                Barcode = "890999900001",
                NameEn = "Heritage Cow Milk 500ml",
                NameTa = "ஹெரிடேஜ் பசும்பால் 500மி.லி",
                CategoryId = 2,
                Unit = "PACK",
                PurchaseRate = 22m,
                SaleRate = 26m,
                Mrp = 26m,
                TaxRate = 0m,
                OpeningStock = 50m,
                ReorderLevel = 10m
            };

            var saveResult = productService.SaveProduct(p);
            Assert.IsTrue(saveResult.IsValid, "Product save should succeed");
            Assert.IsTrue(p.Id > 0, "Product ID should be generated");

            var fetched = productService.GetProductById(p.Id);
            Assert.IsNotNull(fetched);
            Assert.AreEqual("ஹெரிடேஜ் பசும்பால் 500மி.லி", fetched.NameTa, "Tamil Unicode characters must match exactly");
            Assert.AreEqual("Heritage Cow Milk 500ml", fetched.NameEn);

            // Update
            fetched.SaleRate = 27m;
            fetched.Mrp = 27m;
            var updateResult = productService.SaveProduct(fetched);
            Assert.IsTrue(updateResult.IsValid);

            var updated = productService.GetProductById(p.Id);
            Assert.AreEqual(27m, updated.SaleRate);

            // Deactivate
            bool deact = productService.DeactivateProduct(p.Id);
            Assert.IsTrue(deact);
            var deactivated = productService.GetProductById(p.Id);
            Assert.IsFalse(deactivated.IsActive);
        }

        [TestMethod]
        public void DuplicateValidation_RejectsExistingBarcodeAndCode()
        {
            var p1 = new Product
            {
                ProductCode = "DUP01",
                Barcode = "890111111111",
                NameEn = "Item 1",
                SaleRate = 10m,
                Mrp = 10m
            };
            productService.SaveProduct(p1);

            var p2 = new Product
            {
                ProductCode = "DUP02",
                Barcode = "890111111111", // Duplicate barcode
                NameEn = "Item 2",
                SaleRate = 15m,
                Mrp = 15m
            };
            var res2 = productService.SaveProduct(p2);
            Assert.IsFalse(res2.IsValid);
            Assert.IsTrue(res2.Errors.Any(e => e.Contains("Barcode") && e.Contains("already assigned")));
        }

        [TestMethod]
        public void Backup_CreateAndValidate_Succeeds()
        {
            var tempFolder = Path.Combine(Path.GetTempPath(), $"ShopBilling_BkpTest_{Guid.NewGuid():N}");
            try
            {
                string backupPath = DatabaseBackupService.CreateBackup(tempFolder);
                Assert.IsTrue(File.Exists(backupPath), "Backup file should exist");

                bool isValid = DatabaseBackupService.ValidateBackupFile(backupPath, out string error);
                Assert.IsTrue(isValid, $"Backup file should be valid, but got: {error}");
                Assert.IsNull(error);
            }
            finally
            {
                try { if (Directory.Exists(tempFolder)) Directory.Delete(tempFolder, true); } catch { }
            }
        }

        [TestMethod]
        public void Backup_Validate_RejectsNonExistentAndCorruptFiles()
        {
            // 1. Non-existent file
            bool res1 = DatabaseBackupService.ValidateBackupFile(@"C:\NonExistent_FakePath_12345.db", out string err1);
            Assert.IsFalse(res1);
            Assert.IsTrue(err1.Contains("does not exist"));

            // 2. Too small file (<512 bytes)
            string smallFile = Path.Combine(Path.GetTempPath(), $"small_{Guid.NewGuid():N}.db");
            try
            {
                File.WriteAllBytes(smallFile, new byte[100]);
                bool res2 = DatabaseBackupService.ValidateBackupFile(smallFile, out string err2);
                Assert.IsFalse(res2);
                Assert.IsTrue(err2.Contains("too small"));
            }
            finally
            {
                try { if (File.Exists(smallFile)) File.Delete(smallFile); } catch { }
            }

            // 3. Corrupt header (>= 512 bytes but not SQLite 3 signature)
            string corruptFile = Path.Combine(Path.GetTempPath(), $"corrupt_{Guid.NewGuid():N}.db");
            try
            {
                byte[] junk = new byte[1024];
                new Random().NextBytes(junk);
                File.WriteAllBytes(corruptFile, junk);
                bool res3 = DatabaseBackupService.ValidateBackupFile(corruptFile, out string err3);
                Assert.IsFalse(res3);
                Assert.IsTrue(err3.Contains("header signature mismatch"));
            }
            finally
            {
                try { if (File.Exists(corruptFile)) File.Delete(corruptFile); } catch { }
            }
        }

        [TestMethod]
        public void Backup_Validate_RejectsIncompatibleSchema()
        {
            string emptyDbFile = Path.Combine(Path.GetTempPath(), $"emptyDb_{Guid.NewGuid():N}.db");
            try
            {
                // Create a real SQLite database that has no ShopBilling tables
                using (var conn = new System.Data.SQLite.SQLiteConnection($"Data Source={emptyDbFile};Version=3;"))
                {
                    conn.Open();
                    using (var cmd = conn.CreateCommand())
                    {
                        cmd.CommandText = "CREATE TABLE some_random_table (id INTEGER PRIMARY KEY, note TEXT);";
                        cmd.ExecuteNonQuery();
                    }
                }

                bool isValid = DatabaseBackupService.ValidateBackupFile(emptyDbFile, out string error);
                Assert.IsFalse(isValid, "Database without ShopBilling schema should be rejected");
                Assert.IsTrue(error.Contains("missing essential business table"), $"Error should indicate missing tables, got: {error}");
            }
            finally
            {
                try { if (File.Exists(emptyDbFile)) File.Delete(emptyDbFile); } catch { }
            }
        }

        [TestMethod]
        public void Backup_Restore_CreatesSafetyBackupAndRestores()
        {
            var tempFolder = Path.Combine(Path.GetTempPath(), $"ShopBilling_RestoreTest_{Guid.NewGuid():N}");
            try
            {
                // Create snapshot of current state
                string backupPath = DatabaseBackupService.CreateBackup(tempFolder, "BaselineBackup");
                Assert.IsTrue(File.Exists(backupPath));

                // Add a new product to active DB
                var p = new Product
                {
                    ProductCode = "PRD-RESTORE-1",
                    Barcode = "890888877771",
                    NameEn = "Pre-Restore Added Product",
                    SaleRate = 50m,
                    Mrp = 50m
                };
                var saveRes = productService.SaveProduct(p);
                Assert.IsTrue(saveRes.IsValid);

                // Restore previous baseline snapshot
                bool restored = DatabaseBackupService.RestoreBackup(backupPath, out string safetyBackupPath, out string errorMsg);
                Assert.IsTrue(restored, $"Restore should succeed, error: {errorMsg}");
                Assert.IsTrue(File.Exists(safetyBackupPath), "Pre-restore safety backup must be created");

                // Check that product added after baseline snapshot is now gone
                var fetched = productService.GetProductById(p.Id);
                Assert.IsNull(fetched, "Restored state should not contain the product added after baseline snapshot");
            }
            finally
            {
                try { if (Directory.Exists(tempFolder)) Directory.Delete(tempFolder, true); } catch { }
            }
        }
    }
}
