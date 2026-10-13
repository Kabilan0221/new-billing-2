using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using ShopBilling.Core.Interfaces;
using ShopBilling.Core.Models;

namespace ShopBilling.Core.Services
{
    public class BarcodeService
    {
        private readonly IProductRepository _productRepo;
        private readonly IAuditLogRepository _auditRepo;

        public BarcodeService(IProductRepository productRepo, IAuditLogRepository auditRepo)
        {
            _productRepo = productRepo ?? throw new ArgumentNullException(nameof(productRepo));
            _auditRepo = auditRepo;
        }

        public BarcodeValidationResult ValidateBarcode(string barcode, string format = "Code128")
        {
            var result = new BarcodeValidationResult { Barcode = barcode?.Trim(), Format = format };

            if (string.IsNullOrWhiteSpace(barcode))
            {
                result.IsValid = false;
                result.ErrorMessage = "Barcode cannot be empty.";
                return result;
            }

            string clean = barcode.Trim();

            if (format.Equals("EAN13", StringComparison.OrdinalIgnoreCase))
            {
                if (!Regex.IsMatch(clean, @"^\d{12,13}$"))
                {
                    result.IsValid = false;
                    result.ErrorMessage = "EAN-13 barcode must consist of exactly 12 or 13 digits.";
                    return result;
                }

                if (clean.Length == 12)
                {
                    // Compute check digit
                    int checkDigit = CalculateEan13CheckDigit(clean);
                    clean = clean + checkDigit;
                    result.Barcode = clean;
                }
                else
                {
                    // Verify 13th check digit
                    int expectedCheck = CalculateEan13CheckDigit(clean.Substring(0, 12));
                    int actualCheck = clean[12] - '0';
                    if (actualCheck != expectedCheck)
                    {
                        result.IsValid = false;
                        result.ErrorMessage = $"Invalid EAN-13 check digit. Expected {expectedCheck}, got {actualCheck}.";
                        return result;
                    }
                }

                result.IsValid = true;
                return result;
            }
            else
            {
                // Code 128 (Subset B): standard printable ASCII chars (32 to 126)
                if (clean.Length < 1 || clean.Length > 80)
                {
                    result.IsValid = false;
                    result.ErrorMessage = "Code 128 barcode length must be between 1 and 80 characters.";
                    return result;
                }

                foreach (char c in clean)
                {
                    if (c < 32 || c > 126)
                    {
                        result.IsValid = false;
                        result.ErrorMessage = $"Character '{c}' is not supported in standard Code 128 Subset B.";
                        return result;
                    }
                }

                result.IsValid = true;
                return result;
            }
        }

        public static int CalculateEan13CheckDigit(string first12Digits)
        {
            if (first12Digits == null || first12Digits.Length != 12)
                throw new ArgumentException("EAN-13 prefix must be 12 digits long.");

            int sum = 0;
            for (int i = 0; i < 12; i++)
            {
                int val = first12Digits[i] - '0';
                sum += (i % 2 == 0) ? val * 1 : val * 3;
            }

            int mod = sum % 10;
            return (mod == 0) ? 0 : 10 - mod;
        }

        public bool IsBarcodeUnique(string barcode, long? excludeProductId = null)
        {
            if (string.IsNullOrWhiteSpace(barcode)) return true;
            return !_productRepo.ExistsBarcode(barcode.Trim(), excludeProductId);
        }

        public string GenerateNewBarcode(string format = "Code128", string prefix = "890")
        {
            var rnd = new Random();

            if (format.Equals("EAN13", StringComparison.OrdinalIgnoreCase))
            {
                // Generate 12 digits (starting with 890 for India or custom store prefix) and append check digit
                for (int attempts = 0; attempts < 1000; attempts++)
                {
                    string body = (prefix ?? "890") + rnd.Next(100000000, 999999999).ToString("D9");
                    body = body.Substring(0, 12);
                    int cd = CalculateEan13CheckDigit(body);
                    string candidate = body + cd;

                    if (IsBarcodeUnique(candidate))
                    {
                        return candidate;
                    }
                }
            }
            else
            {
                // Code 128: alphanumeric SKU or random standard barcode
                for (int attempts = 0; attempts < 1000; attempts++)
                {
                    string candidate = $"{prefix ?? "BC"}{DateTime.Now:yyMM}{rnd.Next(10000, 99999)}";
                    if (IsBarcodeUnique(candidate))
                    {
                        return candidate;
                    }
                }
            }

            return $"{prefix}{DateTime.Now.Ticks % 10000000000}";
        }

        public bool AssignBarcodeToProduct(long productId, string newBarcode, bool forceOverwrite, out string errorMessage)
        {
            errorMessage = string.Empty;

            var product = _productRepo.GetById(productId);
            if (product == null)
            {
                errorMessage = $"Product ID {productId} does not exist.";
                return false;
            }

            string clean = newBarcode?.Trim();
            if (string.IsNullOrWhiteSpace(clean))
            {
                errorMessage = "Barcode cannot be blank.";
                return false;
            }

            // Validation
            var val = ValidateBarcode(clean);
            if (!val.IsValid)
            {
                errorMessage = val.ErrorMessage;
                return false;
            }

            // Uniqueness check
            if (!IsBarcodeUnique(clean, productId))
            {
                errorMessage = $"Barcode '{clean}' is already assigned to another product in the catalog.";
                return false;
            }

            // Overwrite protection
            if (!string.IsNullOrWhiteSpace(product.Barcode) && !product.Barcode.Equals(clean, StringComparison.OrdinalIgnoreCase) && !forceOverwrite)
            {
                errorMessage = $"Product already has barcode '{product.Barcode}'. User confirmation required to overwrite.";
                return false;
            }

            string oldBarcode = product.Barcode;
            product.Barcode = clean;
            product.UpdatedAt = DateTime.UtcNow;

            // Save without altering current stock, prices, or reorder levels
            bool success = _productRepo.Update(product);
            if (success)
            {
                _auditRepo?.Log("Product", product.ProductCode, "BARCODE_UPDATE", $"Updated barcode for '{product.NameEn}' from '{oldBarcode}' to '{clean}'. Stock & price preserved.");
            }
            else
            {
                errorMessage = "Database update failed while assigning barcode.";
            }

            return success;
        }

        public List<BarcodeStudioItem> LoadCatalogItems(string searchTerm = null)
        {
            var paged = _productRepo.Search(searchTerm ?? "", 1, 500);
            var items = new List<BarcodeStudioItem>();

            foreach (var p in paged.Items)
            {
                items.Add(new BarcodeStudioItem
                {
                    ProductId = p.Id,
                    ProductCode = p.ProductCode,
                    Barcode = p.Barcode,
                    NameEn = p.NameEn,
                    NameTa = p.NameTa,
                    SaleRate = p.SaleRate,
                    Mrp = p.Mrp,
                    CurrentStock = p.CurrentStock,
                    LabelCount = 1,
                    IsSelected = false
                });
            }

            return items;
        }

        public (int totalLabels, int totalSheets) CalculateLayoutMetrics(List<BarcodeStudioItem> items, BarcodePrintConfig config)
        {
            if (items == null || config == null) return (0, 0);

            int totalLabels = items.Where(i => i.IsSelected).Sum(i => Math.Max(0, i.LabelCount));

            // Estimate labels per sheet based on A4 dimensions (210 x 297 mm)
            float printableWidth = 210f - (config.PageMarginLeftMm * 2);
            float printableHeight = 297f - (config.PageMarginTopMm * 2);

            int cols = Math.Max(1, config.LabelsPerRow);
            int rows = Math.Max(1, (int)(printableHeight / (config.LabelHeightMm + config.VerticalGapMm)));

            int labelsPerSheet = cols * rows;
            if (labelsPerSheet <= 0) labelsPerSheet = 1;

            int totalSheets = (int)Math.Ceiling((double)totalLabels / labelsPerSheet);
            return (totalLabels, Math.Max(1, totalSheets));
        }
    }
}
