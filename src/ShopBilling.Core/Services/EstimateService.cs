using System;
using System.Collections.Generic;
using System.Linq;
using ShopBilling.Core.Interfaces;
using ShopBilling.Core.Models;

namespace ShopBilling.Core.Services
{
    public class EstimateService
    {
        private readonly IEstimateRepository _estimateRepo;
        private readonly IProductRepository _productRepo;
        private readonly ICustomerRepository _customerRepo;
        private readonly IAuditLogRepository _auditRepo;

        public EstimateService(
            IEstimateRepository estimateRepo,
            IProductRepository productRepo,
            ICustomerRepository customerRepo,
            IAuditLogRepository auditRepo)
        {
            _estimateRepo = estimateRepo ?? throw new ArgumentNullException(nameof(estimateRepo));
            _productRepo = productRepo;
            _customerRepo = customerRepo;
            _auditRepo = auditRepo;
        }

        public static void CalculateEstimate(EstimateHeader est)
        {
            if (est == null) return;

            decimal totalQty = 0;
            decimal grossAmount = 0;
            decimal itemDiscountTotal = 0;
            decimal taxableAmountTotal = 0;
            decimal cgstAmountTotal = 0;
            decimal sgstAmountTotal = 0;
            decimal igstAmountTotal = 0;
            decimal totalTaxTotal = 0;

            if (est.Items != null)
            {
                foreach (var item in est.Items)
                {
                    totalQty += item.Quantity;

                    decimal lineGross = Math.Round(item.Quantity * item.Rate, 2);
                    grossAmount += lineGross;

                    decimal lineDisc = item.DiscountAmount;
                    if (item.DiscountPercent > 0)
                    {
                        lineDisc = Math.Round(lineGross * (item.DiscountPercent / 100m), 2);
                        item.DiscountAmount = lineDisc;
                    }
                    if (lineDisc > lineGross) lineDisc = lineGross;
                    itemDiscountTotal += lineDisc;

                    decimal lineTaxable = Math.Max(0, lineGross - lineDisc);
                    item.TaxableAmount = lineTaxable;
                    taxableAmountTotal += lineTaxable;

                    decimal taxRate = Math.Max(0, item.TaxRate);
                    if (est.IsInterstate)
                    {
                        item.CgstRate = 0;
                        item.CgstAmount = 0;
                        item.SgstRate = 0;
                        item.SgstAmount = 0;
                        item.IgstRate = taxRate;
                        item.IgstAmount = Math.Round(lineTaxable * (taxRate / 100m), 2);
                        item.TaxAmount = item.IgstAmount;
                        igstAmountTotal += item.IgstAmount;
                    }
                    else
                    {
                        decimal halfRate = taxRate / 2m;
                        item.CgstRate = halfRate;
                        item.CgstAmount = Math.Round(lineTaxable * (halfRate / 100m), 2);
                        item.SgstRate = halfRate;
                        item.SgstAmount = Math.Round(lineTaxable * (halfRate / 100m), 2);
                        item.IgstRate = 0;
                        item.IgstAmount = 0;
                        item.TaxAmount = item.CgstAmount + item.SgstAmount;
                        cgstAmountTotal += item.CgstAmount;
                        sgstAmountTotal += item.SgstAmount;
                    }

                    totalTaxTotal += item.TaxAmount;
                    item.LineTotal = lineTaxable + item.TaxAmount;
                }
            }

            est.TotalItems = est.Items?.Count ?? 0;
            est.TotalQty = totalQty;
            est.GrossAmount = grossAmount;
            est.ItemDiscount = itemDiscountTotal;

            // Bill discount cannot exceed taxable amount
            decimal billDisc = Math.Max(0, est.BillDiscount);
            if (billDisc > taxableAmountTotal) billDisc = taxableAmountTotal;
            est.BillDiscount = billDisc;

            decimal netTaxable = Math.Max(0, taxableAmountTotal - billDisc);
            est.TaxableAmount = netTaxable;

            // Proportional GST adjustment on bill discount
            if (billDisc > 0 && taxableAmountTotal > 0)
            {
                decimal discountRatio = netTaxable / taxableAmountTotal;
                est.CgstAmount = Math.Round(cgstAmountTotal * discountRatio, 2);
                est.SgstAmount = Math.Round(sgstAmountTotal * discountRatio, 2);
                est.IgstAmount = Math.Round(igstAmountTotal * discountRatio, 2);
            }
            else
            {
                est.CgstAmount = cgstAmountTotal;
                est.SgstAmount = sgstAmountTotal;
                est.IgstAmount = igstAmountTotal;
            }

            est.TotalTaxAmount = est.CgstAmount + est.SgstAmount + est.IgstAmount;

            decimal preRound = est.TaxableAmount + est.TotalTaxAmount + est.OtherCharges;
            decimal grandTotal = Math.Round(preRound, 0, MidpointRounding.AwayFromZero);
            est.RoundOff = grandTotal - preRound;
            est.GrandTotal = Math.Max(0, grandTotal);
        }

        public ValidationResult ValidateEstimate(EstimateHeader est)
        {
            var res = new ValidationResult();

            if (est == null)
            {
                res.AddError("Estimate cannot be null.");
                return res;
            }

            if (est.CustomerId <= 0)
            {
                res.AddError("Please select a customer for this estimate.");
            }

            if (est.Items == null || est.Items.Count == 0)
            {
                res.AddError("At least one product item is required for an estimate.");
                return res;
            }

            foreach (var item in est.Items)
            {
                if (item.ProductId <= 0)
                {
                    res.AddError("Each item must correspond to a valid catalog product.");
                }

                if (item.Quantity <= 0)
                {
                    res.AddError($"Product '{item.ProductName ?? item.ProductCode}': Quantity must be greater than zero.");
                }

                if (item.Rate < 0)
                {
                    res.AddError($"Product '{item.ProductName ?? item.ProductCode}': Rate cannot be negative.");
                }

                if (item.DiscountPercent < 0 || item.DiscountPercent > 100)
                {
                    res.AddError($"Product '{item.ProductName ?? item.ProductCode}': Discount percentage must be between 0 and 100.");
                }
            }

            if (est.BillDiscount < 0)
            {
                res.AddError("Bill discount cannot be negative.");
            }

            if (est.GrandTotal < 0)
            {
                res.AddError("Grand total cannot be negative.");
            }

            return res;
        }

        public ValidationResult SaveDraft(EstimateHeader estimate)
        {
            CalculateEstimate(estimate);
            var val = ValidateEstimate(estimate);
            if (!val.IsValid) return val;

            try
            {
                if (string.IsNullOrWhiteSpace(estimate.EstimateNumber))
                {
                    estimate.EstimateNumber = _estimateRepo.GenerateNextEstimateNumber();
                }

                if (estimate.Id == 0)
                {
                    estimate.Status = "Draft";
                    estimate.Id = _estimateRepo.CreateDraft(estimate);
                    _auditRepo?.Log("Estimate", estimate.EstimateNumber, "INSERT", $"Created estimate draft #{estimate.EstimateNumber} for customer {estimate.CustomerName} (Total: ₹{estimate.GrandTotal})");
                }
                else
                {
                    _estimateRepo.UpdateDraft(estimate);
                    _auditRepo?.Log("Estimate", estimate.EstimateNumber, "UPDATE", $"Updated estimate #{estimate.EstimateNumber}");
                }
            }
            catch (Exception ex)
            {
                val.AddError($"Failed to save estimate: {ex.Message}");
            }

            return val;
        }

        public bool ConfirmEstimate(long estimateId, out string errorMessage)
        {
            bool success = _estimateRepo.ConfirmEstimate(estimateId, out errorMessage);
            if (success)
            {
                var est = _estimateRepo.GetById(estimateId);
                _auditRepo?.Log("Estimate", est?.EstimateNumber ?? estimateId.ToString(), "CONFIRM", $"Confirmed quotation #{est?.EstimateNumber}");
            }
            return success;
        }

        public bool CancelEstimate(long estimateId, string reason, out string errorMessage)
        {
            if (string.IsNullOrWhiteSpace(reason))
            {
                errorMessage = "A cancellation reason is required.";
                return false;
            }

            bool success = _estimateRepo.CancelEstimate(estimateId, reason, out errorMessage);
            if (success)
            {
                var est = _estimateRepo.GetById(estimateId);
                _auditRepo?.Log("Estimate", est?.EstimateNumber ?? estimateId.ToString(), "CANCEL", $"Cancelled estimate #{est?.EstimateNumber}: {reason}");
            }
            return success;
        }

        public bool ConvertToInvoice(long estimateId, InvoiceHeader invoiceToCreate, out InvoiceHeader createdInvoice, out string errorMessage)
        {
            bool success = _estimateRepo.ConvertToInvoice(estimateId, invoiceToCreate, out createdInvoice, out errorMessage);
            if (success && createdInvoice != null)
            {
                var est = _estimateRepo.GetById(estimateId);
                _auditRepo?.Log("Estimate", est?.EstimateNumber ?? estimateId.ToString(), "CONVERT", $"Converted Estimate #{est?.EstimateNumber} to Confirmed Invoice #{createdInvoice.InvoiceNumber} (Total: ₹{createdInvoice.GrandTotal})");
            }
            return success;
        }

        public EstimateHeader GetById(long id)
        {
            return _estimateRepo.GetById(id);
        }

        public EstimateHeader GetByNumber(string estimateNumber)
        {
            return _estimateRepo.GetByNumber(estimateNumber);
        }

        public PagedResult<EstimateHeader> SearchEstimates(EstimateFilter filter)
        {
            return _estimateRepo.Search(filter);
        }

        public string GenerateNextEstimateNumber()
        {
            return _estimateRepo.GenerateNextEstimateNumber();
        }

        public List<GstSlabSummary> GetGstSummary(EstimateHeader estimate)
        {
            var summaries = new Dictionary<decimal, GstSlabSummary>();

            if (estimate?.Items != null)
            {
                foreach (var item in estimate.Items)
                {
                    decimal rate = item.TaxRate;
                    if (!summaries.ContainsKey(rate))
                    {
                        summaries[rate] = new GstSlabSummary { TaxRate = rate };
                    }

                    summaries[rate].TaxableAmount += item.TaxableAmount;
                    summaries[rate].CgstAmount += item.CgstAmount;
                    summaries[rate].SgstAmount += item.SgstAmount;
                    summaries[rate].IgstAmount += item.IgstAmount;
                }
            }

            return summaries.Values.OrderBy(s => s.TaxRate).ToList();
        }
    }
}
