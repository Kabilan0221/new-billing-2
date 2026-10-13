using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using ShopBilling.Core.Interfaces;
using ShopBilling.Core.Models;

namespace ShopBilling.Core.Services
{
    public class ReportService
    {
        private readonly IReportRepository _reportRepository;

        public ReportService(IReportRepository reportRepository)
        {
            _reportRepository = reportRepository ?? throw new ArgumentNullException(nameof(reportRepository));
        }

        public List<SalesReportRow> GetSalesReport(ReportFilter filter)
        {
            return _reportRepository.GetSalesReport(filter ?? new ReportFilter());
        }

        public List<ProductWiseSalesReportRow> GetProductWiseSalesReport(ReportFilter filter)
        {
            return _reportRepository.GetProductWiseSalesReport(filter ?? new ReportFilter());
        }

        public List<PurchaseReportRow> GetPurchaseReport(ReportFilter filter)
        {
            return _reportRepository.GetPurchaseReport(filter ?? new ReportFilter());
        }

        public List<StockReportRow> GetStockReport(ReportFilter filter)
        {
            return _reportRepository.GetStockReport(filter ?? new ReportFilter());
        }

        public List<CustomerReportRow> GetCustomerReport(ReportFilter filter)
        {
            return _reportRepository.GetCustomerReport(filter ?? new ReportFilter());
        }

        public List<PaymentCollectionReportRow> GetPaymentCollectionReport(ReportFilter filter)
        {
            return _reportRepository.GetPaymentCollectionReport(filter ?? new ReportFilter());
        }

        public ReportSummary CalculateSalesSummary(List<SalesReportRow> rows)
        {
            if (rows == null || rows.Count == 0) return new ReportSummary();

            return new ReportSummary
            {
                TotalRecords = rows.Count,
                TotalAmount = rows.Sum(r => r.GrandTotal),
                TotalTax = rows.Sum(r => r.TotalTax),
                TotalDiscount = rows.Sum(r => r.DiscountAmount),
                TotalQuantity = rows.Sum(r => r.TotalQuantity)
            };
        }

        public ReportSummary CalculatePurchaseSummary(List<PurchaseReportRow> rows)
        {
            if (rows == null || rows.Count == 0) return new ReportSummary();

            return new ReportSummary
            {
                TotalRecords = rows.Count,
                TotalAmount = rows.Sum(r => r.GrandTotal),
                TotalTax = rows.Sum(r => r.TaxAmount),
                TotalQuantity = rows.Sum(r => r.TotalQuantity),
                TotalPaid = rows.Sum(r => r.AmountPaid),
                TotalOutstanding = rows.Sum(r => r.BalanceDue)
            };
        }

        public ReportSummary CalculateStockSummary(List<StockReportRow> rows)
        {
            if (rows == null || rows.Count == 0) return new ReportSummary();

            return new ReportSummary
            {
                TotalRecords = rows.Count,
                TotalQuantity = rows.Sum(r => r.CurrentStock),
                TotalAmount = rows.Sum(r => r.StockValueAtCost)
            };
        }

        public ReportSummary CalculateCustomerSummary(List<CustomerReportRow> rows)
        {
            if (rows == null || rows.Count == 0) return new ReportSummary();

            return new ReportSummary
            {
                TotalRecords = rows.Count,
                TotalAmount = rows.Sum(r => r.TotalBilledAmount),
                TotalPaid = rows.Sum(r => r.TotalPaidAmount),
                TotalOutstanding = rows.Sum(r => r.OutstandingBalance)
            };
        }

        // CSV Export Helper with RFC 4180 Escaping
        public static string EscapeCsvValue(string value)
        {
            if (string.IsNullOrEmpty(value)) return "";
            if (value.Contains(",") || value.Contains("\"") || value.Contains("\n") || value.Contains("\r"))
            {
                return "\"" + value.Replace("\"", "\"\"") + "\"";
            }
            return value;
        }

        public string ExportSalesReportToCsv(List<SalesReportRow> rows, string title = "Sales Report")
        {
            var sb = new StringBuilder();
            sb.AppendLine($"# {title} - Generated {DateTime.Now:dd-MMM-yyyy HH:mm:ss}");
            sb.AppendLine("Invoice #,Date,Customer,Payment Mode,Status,Items,Qty,Gross (INR),Discount (INR),Taxable (INR),CGST (INR),SGST (INR),IGST (INR),Total Tax (INR),Grand Total (INR)");

            foreach (var r in rows)
            {
                sb.AppendLine(string.Join(",",
                    EscapeCsvValue(r.DocumentNumber),
                    EscapeCsvValue(r.DocumentDate.ToString("yyyy-MM-dd HH:mm")),
                    EscapeCsvValue(r.CustomerName),
                    EscapeCsvValue(r.PaymentMethod),
                    EscapeCsvValue(r.Status),
                    r.TotalItems,
                    r.TotalQuantity,
                    r.GrossAmount.ToString("F2"),
                    r.DiscountAmount.ToString("F2"),
                    r.TaxableAmount.ToString("F2"),
                    r.CgstAmount.ToString("F2"),
                    r.SgstAmount.ToString("F2"),
                    r.IgstAmount.ToString("F2"),
                    r.TotalTax.ToString("F2"),
                    r.GrandTotal.ToString("F2")
                ));
            }

            var summary = CalculateSalesSummary(rows);
            sb.AppendLine();
            sb.AppendLine($"TOTALS,,,,,Total Bills: {summary.TotalRecords},{summary.TotalQuantity},,,{summary.TotalDiscount:F2},,,,,{summary.TotalTax:F2},{summary.TotalAmount:F2}");

            return sb.ToString();
        }

        public string ExportProductWiseSalesReportToCsv(List<ProductWiseSalesReportRow> rows)
        {
            var sb = new StringBuilder();
            sb.AppendLine($"# Product-Wise Sales Report - Generated {DateTime.Now:dd-MMM-yyyy HH:mm:ss}");
            sb.AppendLine("Product Code,Barcode,Product Name,Unit,Qty Sold,Bills Count,Total Discount (INR),Total Tax (INR),Total Revenue (INR)");

            foreach (var r in rows)
            {
                sb.AppendLine(string.Join(",",
                    EscapeCsvValue(r.ProductCode),
                    EscapeCsvValue(r.Barcode),
                    EscapeCsvValue(r.ProductName),
                    EscapeCsvValue(r.Unit),
                    r.QuantitySold,
                    r.BillCount,
                    r.TotalDiscount.ToString("F2"),
                    r.TotalTax.ToString("F2"),
                    r.TotalRevenue.ToString("F2")
                ));
            }

            decimal totalRev = rows.Sum(r => r.TotalRevenue);
            decimal totalQty = rows.Sum(r => r.QuantitySold);
            sb.AppendLine();
            sb.AppendLine($",,,TOTALS,{totalQty},,,,{totalRev:F2}");

            return sb.ToString();
        }

        public string ExportStockReportToCsv(List<StockReportRow> rows)
        {
            var sb = new StringBuilder();
            sb.AppendLine($"# Stock & Inventory Valuation Report - Generated {DateTime.Now:dd-MMM-yyyy HH:mm:ss}");
            sb.AppendLine("Product Code,Barcode,Product Name,Category,Unit,Current Stock,Reorder Level,Status,Cost Rate (INR),Sale Rate (INR),Value @ Cost (INR),Value @ Sale (INR)");

            foreach (var r in rows)
            {
                sb.AppendLine(string.Join(",",
                    EscapeCsvValue(r.ProductCode),
                    EscapeCsvValue(r.Barcode),
                    EscapeCsvValue(r.ProductName),
                    EscapeCsvValue(r.CategoryName),
                    EscapeCsvValue(r.Unit),
                    r.CurrentStock,
                    r.ReorderLevel,
                    EscapeCsvValue(r.StockStatus),
                    r.PurchaseRate.ToString("F2"),
                    r.SaleRate.ToString("F2"),
                    r.StockValueAtCost.ToString("F2"),
                    r.StockValueAtSale.ToString("F2")
                ));
            }

            var summary = CalculateStockSummary(rows);
            decimal totalSaleVal = rows.Sum(r => r.StockValueAtSale);
            sb.AppendLine();
            sb.AppendLine($",,,,,{summary.TotalQuantity},,,,TOTALS,{summary.TotalAmount:F2},{totalSaleVal:F2}");

            return sb.ToString();
        }
    }
}
