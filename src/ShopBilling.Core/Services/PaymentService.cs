using System;
using System.Collections.Generic;
using ShopBilling.Core.Interfaces;
using ShopBilling.Core.Models;

namespace ShopBilling.Core.Services
{
    public class PaymentService
    {
        private readonly IPaymentRepository _paymentRepo;
        private readonly IInvoiceRepository _invoiceRepo;
        private readonly IAuditLogRepository _auditRepo;

        public PaymentService(
            IPaymentRepository paymentRepo,
            IInvoiceRepository invoiceRepo,
            IAuditLogRepository auditRepo)
        {
            _paymentRepo = paymentRepo ?? throw new ArgumentNullException(nameof(paymentRepo));
            _invoiceRepo = invoiceRepo;
            _auditRepo = auditRepo;
        }

        public bool RecordPayment(long invoiceId, string paymentMethod, decimal amount, string referenceNumber, string notes, out string errorMessage)
        {
            errorMessage = string.Empty;

            if (amount <= 0)
            {
                errorMessage = "Payment amount must be greater than zero.";
                return false;
            }

            if (_invoiceRepo != null)
            {
                var inv = _invoiceRepo.GetById(invoiceId);
                if (inv == null)
                {
                    errorMessage = $"Invoice #{invoiceId} not found.";
                    return false;
                }

                if (inv.BalanceDue <= 0)
                {
                    errorMessage = $"Invoice #{inv.InvoiceNumber} is already fully paid (Balance Due is ₹0.00).";
                    return false;
                }

                if (amount > inv.BalanceDue)
                {
                    errorMessage = $"Payment amount ₹{amount:F2} cannot exceed remaining balance due of ₹{inv.BalanceDue:F2}.";
                    return false;
                }
            }

            long paymentId = _paymentRepo.RecordPayment(invoiceId, paymentMethod, amount, referenceNumber, notes, out errorMessage);
            if (paymentId > 0)
            {
                _auditRepo?.Log("Payment", paymentId.ToString(), "RECEIPT", $"Received payment of ₹{amount:F2} via {paymentMethod} for Invoice ID #{invoiceId} (Ref: {referenceNumber ?? "N/A"})");
                return true;
            }

            return false;
        }

        public bool ReversePayment(long paymentId, string reason, out string errorMessage)
        {
            errorMessage = string.Empty;
            if (string.IsNullOrWhiteSpace(reason))
            {
                errorMessage = "A clear reversal reason is mandatory to reverse a payment.";
                return false;
            }

            var p = _paymentRepo.GetById(paymentId);
            if (p == null)
            {
                errorMessage = $"Payment ID {paymentId} not found.";
                return false;
            }

            if (p.IsReversed)
            {
                errorMessage = $"Payment #{p.PaymentNumber} has already been reversed on {p.ReversedAt:dd-MMM-yyyy}. Double reversal is prohibited.";
                return false;
            }

            bool ok = _paymentRepo.ReversePayment(paymentId, reason, out errorMessage);
            if (ok)
            {
                _auditRepo?.Log("Payment", p.PaymentNumber, "REVERSAL", $"Reversed payment #{p.PaymentNumber} of ₹{p.Amount:F2} for invoice #{p.InvoiceNumber}. Reason: {reason}");
            }

            return ok;
        }

        public PagedResult<InvoicePayment> Search(PaymentFilter filter) => _paymentRepo.Search(filter);
        public IEnumerable<InvoicePayment> GetByInvoice(long invoiceId) => _paymentRepo.GetByInvoice(invoiceId);
        public IEnumerable<InvoicePayment> GetByCustomer(long customerId) => _paymentRepo.GetByCustomer(customerId);
        public InvoicePayment GetById(long id) => _paymentRepo.GetById(id);
    }
}
