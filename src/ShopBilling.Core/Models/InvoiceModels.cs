using System;
using System.Collections.Generic;

namespace ShopBilling.Core.Models
{
    public class Customer
    {
        public long Id { get; set; }
        public string Code { get; set; } = "CUST-WALKIN";
        public string Name { get; set; } = "Walk-in Customer";
        public string Mobile { get; set; }
        public string Email { get; set; }
        public string Gstin { get; set; }
        public string Address { get; set; }
        public string City { get; set; } = "Chennai";
        public string State { get; set; } = "Tamil Nadu";
        public string StateCode { get; set; } = "33";
        public decimal CurrentBalance { get; set; }
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    public class InvoiceHeader
    {
        public long Id { get; set; }
        public string InvoiceNumber { get; set; }
        public DateTime InvoiceDate { get; set; } = DateTime.UtcNow;
        public long CustomerId { get; set; } = 1;
        public string CustomerName { get; set; } = "Walk-in Customer";
        public string CustomerMobile { get; set; }
        public string CustomerGstin { get; set; }
        public string Salesperson { get; set; } = "Admin";
        public string Status { get; set; } = "Confirmed"; // "Draft", "Confirmed", "Cancelled"
        public string PaymentStatus { get; set; } = "Paid"; // "Paid", "Partial", "Unpaid"
        public bool IsInterstate { get; set; } = false;

        public int TotalItems { get; set; }
        public decimal TotalQty { get; set; }
        public decimal GrossAmount { get; set; }
        public decimal ItemDiscount { get; set; }
        public decimal BillDiscount { get; set; }
        public decimal TaxableAmount { get; set; }
        public decimal CgstAmount { get; set; }
        public decimal SgstAmount { get; set; }
        public decimal IgstAmount { get; set; }
        public decimal TotalTaxAmount { get; set; }
        public decimal OtherCharges { get; set; }
        public decimal RoundOff { get; set; }
        public decimal GrandTotal { get; set; }
        public decimal AmountPaid { get; set; }
        public decimal BalanceDue { get; set; }
        public decimal CashChange { get; set; } // Cash received minus GrandTotal when overpaid

        public long? EstimateId { get; set; }
        public string EstimateNumber { get; set; }

        public string Notes { get; set; }
        public string CancellationReason { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public List<InvoiceItem> Items { get; set; } = new List<InvoiceItem>();
        public List<InvoicePayment> Payments { get; set; } = new List<InvoicePayment>();
    }

    public class InvoiceItem
    {
        public long Id { get; set; }
        public long InvoiceId { get; set; }
        public long ProductId { get; set; }
        public string ProductCode { get; set; }
        public string Barcode { get; set; }
        public string ProductName { get; set; }
        public string Unit { get; set; } = "PCS";
        public decimal Quantity { get; set; }
        public decimal Rate { get; set; }
        public decimal DiscountPercent { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal TaxRate { get; set; }
        public decimal TaxableAmount { get; set; }
        public decimal CgstRate { get; set; }
        public decimal CgstAmount { get; set; }
        public decimal SgstRate { get; set; }
        public decimal SgstAmount { get; set; }
        public decimal IgstRate { get; set; }
        public decimal IgstAmount { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal LineTotal { get; set; }
    }

    public class InvoicePayment
    {
        public long Id { get; set; }
        public long InvoiceId { get; set; }
        public string InvoiceNumber { get; set; }
        public long CustomerId { get; set; }
        public string CustomerName { get; set; }
        public string PaymentNumber { get; set; }
        public string PaymentMethod { get; set; } = "Cash"; // "Cash", "UPI", "Card", "Bank Transfer", "Cheque", "Credit"
        public decimal Amount { get; set; }
        public string ReferenceNumber { get; set; }
        public string Notes { get; set; }
        public bool IsReversed { get; set; } = false;
        public DateTime? ReversedAt { get; set; }
        public string ReversalReason { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class CustomerLedgerEntry
    {
        public long Id { get; set; }
        public long CustomerId { get; set; }
        public string CustomerName { get; set; }
        public string TransactionType { get; set; } // "OPENING_BALANCE", "INVOICE", "PAYMENT", "PAYMENT_REVERSAL", "ADJUSTMENT"
        public string ReferenceId { get; set; }
        public decimal Debit { get; set; } // In Accounts Receivable: Debit increases customer balance (Invoice charge, reversal)
        public decimal Credit { get; set; } // Credit decreases customer balance (Payment received)
        public decimal BalanceAfter { get; set; }
        public string Notes { get; set; }
        public DateTime TransactionDate { get; set; } = DateTime.UtcNow;
    }

    public class CustomerStatement
    {
        public Customer Customer { get; set; }
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
        public decimal OpeningBalance { get; set; }
        public decimal TotalPeriodDebits { get; set; } // Total billed / charged
        public decimal TotalPeriodCredits { get; set; } // Total paid
        public decimal ClosingBalance { get; set; }
        public List<CustomerLedgerEntry> Entries { get; set; } = new List<CustomerLedgerEntry>();
    }

    public class PaymentFilter
    {
        public string SearchTerm { get; set; }
        public long? CustomerId { get; set; }
        public long? InvoiceId { get; set; }
        public string PaymentMethod { get; set; } // "All", "Cash", "UPI", "Card", "Bank Transfer", "Cheque", "Credit"
        public string Status { get; set; } = "Active"; // "All", "Active", "Reversed"
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public int PageNumber { get; set; } = 1;
        public int PageSize { get; set; } = 50;
    }

    public class InvoiceFilter
    {
        public string SearchTerm { get; set; }
        public long? CustomerId { get; set; }
        public string Status { get; set; } // "All", "Draft", "Confirmed", "Cancelled"
        public string PaymentStatus { get; set; } // "All", "Paid", "Partial", "Unpaid"
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public int PageNumber { get; set; } = 1;
        public int PageSize { get; set; } = 50;
    }

    public class GstSlabSummary
    {
        public decimal TaxRate { get; set; }
        public decimal TaxableAmount { get; set; }
        public decimal CgstAmount { get; set; }
        public decimal SgstAmount { get; set; }
        public decimal IgstAmount { get; set; }
        public decimal TotalTax => CgstAmount + SgstAmount + IgstAmount;
    }
}
