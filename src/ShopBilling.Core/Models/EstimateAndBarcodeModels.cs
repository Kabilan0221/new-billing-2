using System;
using System.Collections.Generic;

namespace ShopBilling.Core.Models
{
    public class EstimateHeader
    {
        public long Id { get; set; }
        public string EstimateNumber { get; set; }
        public DateTime EstimateDate { get; set; } = DateTime.UtcNow;
        public DateTime? ValidUntil { get; set; } = DateTime.UtcNow.AddDays(15);
        public long CustomerId { get; set; } = 1;
        public string CustomerCode { get; set; } = "CUST-WALKIN";
        public string CustomerName { get; set; } = "Walk-in Customer";
        public string CustomerMobile { get; set; }
        public string CustomerGstin { get; set; }
        public string StateCode { get; set; } = "33";
        public string StateName { get; set; } = "Tamil Nadu";
        public bool IsInterstate { get; set; } = false;

        public string Status { get; set; } = "Draft"; // "Draft", "Confirmed", "Converted", "Cancelled"
        public long? ConvertedInvoiceId { get; set; }
        public string ConvertedInvoiceNumber { get; set; }
        public DateTime? ConvertedAt { get; set; }

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

        public string Notes { get; set; }
        public string TermsConditions { get; set; } = "1. Prices valid for 15 days from date of estimate.\n2. GST charged as per applicable rates.\n3. Goods subject to availability at time of billing.";
        public string CreatedBy { get; set; } = "Admin";
        public string CancellationReason { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public List<EstimateItem> Items { get; set; } = new List<EstimateItem>();
    }

    public class EstimateItem
    {
        public long Id { get; set; }
        public long EstimateId { get; set; }
        public long ProductId { get; set; }
        public string ProductCode { get; set; }
        public string Barcode { get; set; }
        public string ProductName { get; set; }
        public string Unit { get; set; } = "PCS";
        public string HsnCode { get; set; }
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

    public class EstimateFilter
    {
        public string SearchTerm { get; set; }
        public long? CustomerId { get; set; }
        public string Status { get; set; } = "All"; // "All", "Draft", "Confirmed", "Converted", "Cancelled"
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public int PageNumber { get; set; } = 1;
        public int PageSize { get; set; } = 50;
    }

    public class BarcodeStudioItem
    {
        public long ProductId { get; set; }
        public string ProductCode { get; set; }
        public string Barcode { get; set; }
        public string NameEn { get; set; }
        public string NameTa { get; set; }
        public decimal SaleRate { get; set; }
        public decimal Mrp { get; set; }
        public decimal CurrentStock { get; set; }
        public int LabelCount { get; set; } = 1;
        public bool IsSelected { get; set; } = true;
    }

    public class BarcodePrintConfig
    {
        public string BarcodeFormat { get; set; } = "Code128"; // "Code128", "EAN13"
        public float LabelWidthMm { get; set; } = 50f;
        public float LabelHeightMm { get; set; } = 25f;
        public int LabelsPerRow { get; set; } = 2;
        public float HorizontalGapMm { get; set; } = 3f;
        public float VerticalGapMm { get; set; } = 3f;
        public float PageMarginLeftMm { get; set; } = 5f;
        public float PageMarginTopMm { get; set; } = 8f;
        public bool IncludeProductName { get; set; } = true;
        public bool IncludePrice { get; set; } = true;
        public bool IncludeBarcodeText { get; set; } = true;
        public bool IncludeStoreName { get; set; } = true;
        public string StoreName { get; set; } = "SRI MEENAKSHI SUPER STORE";
        public string CurrencySymbol { get; set; } = "₹";
    }

    public class BarcodeValidationResult
    {
        public bool IsValid { get; set; }
        public string Barcode { get; set; }
        public string Format { get; set; }
        public string ErrorMessage { get; set; }
    }
}
