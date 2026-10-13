using System;
using System.Collections.Generic;
using System.Linq;
using ShopBilling.Core.Interfaces;
using ShopBilling.Core.Models;

namespace ShopBilling.Core.Services
{
    public class InvoiceService
    {
        private readonly IInvoiceRepository _invoiceRepo;
        private readonly IProductRepository _productRepo;
        private readonly ICustomerRepository _customerRepo;
        private readonly IAuditLogRepository _auditRepo;

        public InvoiceService(
            IInvoiceRepository invoiceRepo,
            IProductRepository productRepo,
            ICustomerRepository customerRepo,
            IAuditLogRepository auditRepo)
        {
            _invoiceRepo = invoiceRepo ?? throw new ArgumentNullException(nameof(invoiceRepo));
            _productRepo = productRepo;
            _customerRepo = customerRepo;
            _auditRepo = auditRepo;
        }

        public static void CalculateInvoice(InvoiceHeader inv)
        {
            if (inv == null) return;

            decimal totalQty = 0;
            decimal grossAmount = 0;
            decimal itemDiscountTotal = 0;
            decimal taxableAmountTotal = 0;
            decimal cgstAmountTotal = 0;
            decimal sgstAmountTotal = 0;
            decimal igstAmountTotal = 0;
            decimal totalTaxTotal = 0;

            if (inv.Items != null)
            {
                foreach (var item in inv.Items)
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
                    if (inv.IsInterstate)
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

            inv.TotalItems = inv.Items?.Count ?? 0;
            inv.TotalQty = totalQty;
            inv.GrossAmount = grossAmount;
            inv.ItemDiscount = itemDiscountTotal;

            // Bill discount cannot exceed taxable amount
            decimal billDisc = Math.Max(0, inv.BillDiscount);
            if (billDisc > taxableAmountTotal) billDisc = taxableAmountTotal;
            inv.BillDiscount = billDisc;

            decimal netTaxable = Math.Max(0, taxableAmountTotal - billDisc);
            inv.TaxableAmount = netTaxable;

            // Re-calculate proportional tax if bill discount applies
            if (billDisc > 0 && taxableAmountTotal > 0)
            {
                decimal discountRatio = netTaxable / taxableAmountTotal;
                inv.CgstAmount = Math.Round(cgstAmountTotal * discountRatio, 2);
                inv.SgstAmount = Math.Round(sgstAmountTotal * discountRatio, 2);
                inv.IgstAmount = Math.Round(igstAmountTotal * discountRatio, 2);
            }
            else
            {
                inv.CgstAmount = cgstAmountTotal;
                inv.SgstAmount = sgstAmountTotal;
                inv.IgstAmount = igstAmountTotal;
            }
            inv.TotalTaxAmount = inv.CgstAmount + inv.SgstAmount + inv.IgstAmount;

            decimal preRound = inv.TaxableAmount + inv.TotalTaxAmount + inv.OtherCharges;
            decimal grandTotal = Math.Round(preRound, 0, MidpointRounding.AwayFromZero);
            inv.RoundOff = grandTotal - preRound;
            inv.GrandTotal = Math.Max(0, grandTotal);

            // Calculate paid amount from payments list if present
            if (inv.Payments != null && inv.Payments.Count > 0)
            {
                inv.AmountPaid = inv.Payments.Sum(p => p.Amount);
            }

            if (inv.AmountPaid >= inv.GrandTotal)
            {
                inv.BalanceDue = 0;
                inv.CashChange = inv.AmountPaid - inv.GrandTotal;
                inv.PaymentStatus = "Paid";
            }
            else if (inv.AmountPaid > 0)
            {
                inv.BalanceDue = inv.GrandTotal - inv.AmountPaid;
                inv.CashChange = 0;
                inv.PaymentStatus = "Partial";
            }
            else
            {
                inv.BalanceDue = inv.GrandTotal;
                inv.CashChange = 0;
                inv.PaymentStatus = "Unpaid";
            }
        }

        public ValidationResult ValidateInvoice(InvoiceHeader inv)
        {
            var res = new ValidationResult();

            if (inv == null)
            {
                res.AddError("Invoice cannot be null.");
                return res;
            }

            if (inv.Items == null || inv.Items.Count == 0)
            {
                res.AddError("At least one product item is required to generate an invoice.");
                return res;
            }

            foreach (var item in inv.Items)
            {
                if (item.ProductId <= 0)
                {
                    res.AddError("Each item must correspond to a valid product.");
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

            if (inv.BillDiscount < 0)
            {
                res.AddError("Bill discount cannot be negative.");
            }

            if (inv.GrandTotal < 0)
            {
                res.AddError("Grand total cannot be negative.");
            }

            return res;
        }

        public ValidationResult SaveDraft(InvoiceHeader invoice)
        {
            CalculateInvoice(invoice);
            var val = ValidateInvoice(invoice);
            if (!val.IsValid) return val;

            try
            {
                if (string.IsNullOrWhiteSpace(invoice.InvoiceNumber))
                {
                    invoice.InvoiceNumber = _invoiceRepo.GenerateNextInvoiceNumber();
                }

                invoice.Status = "Draft";

                if (invoice.Id == 0)
                {
                    invoice.Id = _invoiceRepo.CreateDraft(invoice);
                    _auditRepo?.Log("Invoice", invoice.InvoiceNumber, "INSERT", $"Created draft invoice #{invoice.InvoiceNumber} (Total: ₹{invoice.GrandTotal})");
                }
                else
                {
                    _invoiceRepo.UpdateDraft(invoice);
                    _auditRepo?.Log("Invoice", invoice.InvoiceNumber, "UPDATE", $"Updated draft invoice #{invoice.InvoiceNumber}");
                }
            }
            catch (Exception ex)
            {
                val.AddError($"Failed to save draft invoice: {ex.Message}");
            }

            return val;
        }

        public bool FinalizeInvoice(InvoiceHeader invoice, out string errorMessage)
        {
            errorMessage = string.Empty;

            CalculateInvoice(invoice);
            var val = ValidateInvoice(invoice);
            if (!val.IsValid)
            {
                errorMessage = string.Join("; ", val.Errors);
                return false;
            }

            if (string.IsNullOrWhiteSpace(invoice.InvoiceNumber))
            {
                invoice.InvoiceNumber = _invoiceRepo.GenerateNextInvoiceNumber();
            }

            invoice.Status = "Confirmed";

            // Verify stock for each item before calling repo
            if (_productRepo != null)
            {
                foreach (var item in invoice.Items)
                {
                    var p = _productRepo.GetById(item.ProductId);
                    if (p == null)
                    {
                        errorMessage = $"Product '{item.ProductName ?? item.ProductCode}' not found in database.";
                        return false;
                    }

                    if (p.CurrentStock < item.Quantity)
                    {
                        errorMessage = $"Insufficient stock for '{p.NameEn}'. Available: {p.CurrentStock}, Requested: {item.Quantity}.";
                        return false;
                    }
                }
            }

            bool success = _invoiceRepo.FinalizeInvoice(invoice, out errorMessage);
            if (success)
            {
                _auditRepo?.Log("Invoice", invoice.InvoiceNumber, "FINALIZE", $"Finalized POS invoice #{invoice.InvoiceNumber} for ₹{invoice.GrandTotal} ({invoice.Items.Count} items)");
            }

            return success;
        }

        public bool CancelInvoice(long invoiceId, string cancellationReason, out string errorMessage)
        {
            errorMessage = string.Empty;
            if (string.IsNullOrWhiteSpace(cancellationReason))
            {
                errorMessage = "A valid cancellation reason is required.";
                return false;
            }

            bool success = _invoiceRepo.CancelInvoice(invoiceId, cancellationReason, out errorMessage);
            if (success)
            {
                var inv = _invoiceRepo.GetById(invoiceId);
                _auditRepo?.Log("Invoice", inv?.InvoiceNumber ?? invoiceId.ToString(), "CANCEL", $"Cancelled invoice #{inv?.InvoiceNumber}: {cancellationReason}");
            }

            return success;
        }

        public InvoiceHeader GetById(long id)
        {
            return _invoiceRepo.GetById(id);
        }

        public InvoiceHeader GetByNumber(string invoiceNumber)
        {
            return _invoiceRepo.GetByNumber(invoiceNumber);
        }

        public PagedResult<InvoiceHeader> SearchInvoices(InvoiceFilter filter)
        {
            return _invoiceRepo.Search(filter);
        }

        public string GenerateNextInvoiceNumber()
        {
            return _invoiceRepo.GenerateNextInvoiceNumber();
        }

        public List<GstSlabSummary> GetGstSummary(InvoiceHeader invoice)
        {
            var summaries = new Dictionary<decimal, GstSlabSummary>();

            if (invoice?.Items != null)
            {
                foreach (var item in invoice.Items)
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
