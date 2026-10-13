using System;
using System.Drawing;
using System.Drawing.Printing;
using System.Linq;
using System.Windows.Forms;
using ShopBilling.Core.Models;

namespace ShopBilling.UI.Utilities
{
    public static class InvoicePrintHelper
    {
        public static void PrintInvoice(InvoiceHeader invoice, bool isThermal = true)
        {
            if (invoice == null) return;

            try
            {
                var pd = new PrintDocument();
                pd.DocumentName = $"Invoice_{invoice.InvoiceNumber}";

                if (isThermal)
                {
                    // 80mm width paper
                    pd.DefaultPageSettings.PaperSize = new PaperSize("Thermal80mm", 315, 1200);
                    pd.DefaultPageSettings.Margins = new Margins(10, 10, 10, 10);
                    pd.PrintPage += (s, e) => RenderThermalReceipt(e, invoice);
                }
                else
                {
                    // Standard A4 Paper
                    pd.DefaultPageSettings.PaperSize = new PaperSize("A4", 827, 1169);
                    pd.DefaultPageSettings.Margins = new Margins(30, 30, 30, 30);
                    pd.PrintPage += (s, e) => RenderA4Invoice(e, invoice);
                }

                using (var previewDlg = new PrintPreviewDialog())
                {
                    previewDlg.Document = pd;
                    previewDlg.WindowState = FormWindowState.Maximized;
                    previewDlg.ShowDialog();
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Print Error: {ex.Message}", "Printing Notice", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        private static void RenderThermalReceipt(PrintPageEventArgs e, InvoiceHeader inv)
        {
            var g = e.Graphics;
            float y = 15;
            float width = 295;

            var titleFont = new Font("Segoe UI", 12f, FontStyle.Bold);
            var subFont = new Font("Segoe UI", 8f, FontStyle.Regular);
            var boldFont = new Font("Segoe UI", 8.5f, FontStyle.Bold);
            var normalFont = new Font("Segoe UI", 8f, FontStyle.Regular);

            var sfCenter = new StringFormat { Alignment = StringAlignment.Center };
            var sfRight = new StringFormat { Alignment = StringAlignment.Far };
            var sfLeft = new StringFormat { Alignment = StringAlignment.Near };

            // Store Header
            g.DrawString("SRI MEENAKSHI SUPER STORE", titleFont, Brushes.Black, new RectangleF(0, y, width, 22), sfCenter);
            y += 22;
            g.DrawString("124, West Masi Street, Madurai - 625001", subFont, Brushes.Black, new RectangleF(0, y, width, 16), sfCenter);
            y += 16;
            g.DrawString("Phone: 0452-2345678 | GSTIN: 33AABCS1429B1Z1", subFont, Brushes.Black, new RectangleF(0, y, width, 16), sfCenter);
            y += 18;

            g.DrawLine(Pens.Black, 5, y, width - 5, y);
            y += 6;

            // Invoice Info
            g.DrawString($"Bill No: {inv.InvoiceNumber}", boldFont, Brushes.Black, 5, y);
            y += 16;
            g.DrawString($"Date: {inv.InvoiceDate:dd-MMM-yyyy hh:mm tt}", normalFont, Brushes.Black, 5, y);
            y += 16;
            g.DrawString($"Customer: {inv.CustomerName} ({inv.CustomerMobile ?? "N/A"})", normalFont, Brushes.Black, 5, y);
            y += 18;

            g.DrawLine(Pens.Black, 5, y, width - 5, y);
            y += 6;

            // Item Headers
            g.DrawString("Item", boldFont, Brushes.Black, 5, y);
            g.DrawString("Qty", boldFont, Brushes.Black, 150, y);
            g.DrawString("Rate", boldFont, Brushes.Black, 200, y);
            g.DrawString("Amount", boldFont, Brushes.Black, new RectangleF(210, y, 80, 16), sfRight);
            y += 16;
            g.DrawLine(Pens.Black, 5, y, width - 5, y);
            y += 4;

            // Item Rows
            foreach (var item in inv.Items)
            {
                g.DrawString(item.ProductName, boldFont, Brushes.Black, new RectangleF(5, y, 280, 16), sfLeft);
                y += 14;
                g.DrawString($"{item.Quantity} {item.Unit}", normalFont, Brushes.Black, 150, y);
                g.DrawString($"₹{item.Rate:F2}", normalFont, Brushes.Black, 200, y);
                g.DrawString($"₹{item.LineTotal:F2}", boldFont, Brushes.Black, new RectangleF(210, y, 80, 16), sfRight);
                y += 16;
            }

            g.DrawLine(Pens.Black, 5, y, width - 5, y);
            y += 6;

            // Summary Totals
            g.DrawString("Gross Amount:", normalFont, Brushes.Black, 50, y);
            g.DrawString($"₹{inv.GrossAmount:F2}", normalFont, Brushes.Black, new RectangleF(180, y, 110, 16), sfRight);
            y += 16;

            if (inv.ItemDiscount + inv.BillDiscount > 0)
            {
                g.DrawString("Discount:", normalFont, Brushes.Black, 50, y);
                g.DrawString($"-₹{(inv.ItemDiscount + inv.BillDiscount):F2}", normalFont, Brushes.Black, new RectangleF(180, y, 110, 16), sfRight);
                y += 16;
            }

            g.DrawString("Taxable Value:", normalFont, Brushes.Black, 50, y);
            g.DrawString($"₹{inv.TaxableAmount:F2}", normalFont, Brushes.Black, new RectangleF(180, y, 110, 16), sfRight);
            y += 16;

            if (inv.IsInterstate)
            {
                g.DrawString("IGST:", normalFont, Brushes.Black, 50, y);
                g.DrawString($"₹{inv.IgstAmount:F2}", normalFont, Brushes.Black, new RectangleF(180, y, 110, 16), sfRight);
                y += 16;
            }
            else
            {
                g.DrawString("CGST:", normalFont, Brushes.Black, 50, y);
                g.DrawString($"₹{inv.CgstAmount:F2}", normalFont, Brushes.Black, new RectangleF(180, y, 110, 16), sfRight);
                y += 16;
                g.DrawString("SGST:", normalFont, Brushes.Black, 50, y);
                g.DrawString($"₹{inv.SgstAmount:F2}", normalFont, Brushes.Black, new RectangleF(180, y, 110, 16), sfRight);
                y += 16;
            }

            if (inv.RoundOff != 0)
            {
                g.DrawString("Round Off:", normalFont, Brushes.Black, 50, y);
                g.DrawString($"₹{inv.RoundOff:F2}", normalFont, Brushes.Black, new RectangleF(180, y, 110, 16), sfRight);
                y += 16;
            }

            g.DrawLine(Pens.Black, 5, y, width - 5, y);
            y += 4;

            // Grand Total
            var grandFont = new Font("Segoe UI", 11f, FontStyle.Bold);
            g.DrawString("NET PAYABLE:", grandFont, Brushes.Black, 10, y);
            g.DrawString($"₹{inv.GrandTotal:F2}", grandFont, Brushes.Black, new RectangleF(140, y, 150, 22), sfRight);
            y += 24;

            g.DrawString($"Amount Paid: ₹{inv.AmountPaid:F2}", boldFont, Brushes.Black, 10, y);
            if (inv.CashChange > 0)
            {
                g.DrawString($"Change: ₹{inv.CashChange:F2}", boldFont, Brushes.Black, new RectangleF(140, y, 150, 16), sfRight);
            }
            y += 18;

            g.DrawLine(Pens.Black, 5, y, width - 5, y);
            y += 10;

            g.DrawString("Thank you for shopping with us!", boldFont, Brushes.Black, new RectangleF(0, y, width, 16), sfCenter);
            y += 16;
            g.DrawString("Please visit again • Goods once sold cannot be returned without bill", subFont, Brushes.Black, new RectangleF(0, y, width, 24), sfCenter);
        }

        private static void RenderA4Invoice(PrintPageEventArgs e, InvoiceHeader inv)
        {
            var g = e.Graphics;
            float y = 40;
            float margin = 35;
            float pageWidth = 750;

            var titleFont = new Font("Segoe UI", 16f, FontStyle.Bold);
            var subFont = new Font("Segoe UI", 9f, FontStyle.Regular);
            var boldFont = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            var normalFont = new Font("Segoe UI", 9f, FontStyle.Regular);

            var sfCenter = new StringFormat { Alignment = StringAlignment.Center };
            var sfRight = new StringFormat { Alignment = StringAlignment.Far };
            var sfLeft = new StringFormat { Alignment = StringAlignment.Near };

            // Header Banner
            g.DrawString("TAX INVOICE", titleFont, Brushes.Black, new RectangleF(margin, y, pageWidth, 28), sfCenter);
            y += 32;

            g.DrawString("SRI MEENAKSHI SUPER STORE", new Font("Segoe UI", 12f, FontStyle.Bold), Brushes.Black, margin, y);
            y += 20;
            g.DrawString("124, West Masi Street, Madurai - 625001, Tamil Nadu | Phone: 0452-2345678", subFont, Brushes.Black, margin, y);
            y += 16;
            g.DrawString("GSTIN: 33AABCS1429B1Z1 | State Code: 33", boldFont, Brushes.Black, margin, y);
            y += 24;

            g.DrawLine(Pens.DarkGray, margin, y, margin + pageWidth, y);
            y += 8;

            // Invoice Details Box
            g.DrawString($"Invoice No: {inv.InvoiceNumber}", boldFont, Brushes.Black, margin, y);
            g.DrawString($"Billed To: {inv.CustomerName}", boldFont, Brushes.Black, margin + 400, y);
            y += 18;

            g.DrawString($"Date: {inv.InvoiceDate:dd-MMM-yyyy hh:mm tt}", normalFont, Brushes.Black, margin, y);
            g.DrawString($"Mobile: {inv.CustomerMobile ?? "N/A"}", normalFont, Brushes.Black, margin + 400, y);
            y += 18;

            g.DrawString($"Place of Supply: {(inv.IsInterstate ? "Other State (Inter-state)" : "Tamil Nadu (33)")}", normalFont, Brushes.Black, margin, y);
            g.DrawString($"Customer GSTIN: {inv.CustomerGstin ?? "Unregistered"}", normalFont, Brushes.Black, margin + 400, y);
            y += 24;

            // Items Table Header
            float colNum = margin;
            float colItem = margin + 30;
            float colBarcode = margin + 260;
            float colQty = margin + 360;
            float colRate = margin + 430;
            float colDisc = margin + 500;
            float colGst = margin + 570;
            float colTotal = margin + 640;

            g.FillRectangle(new SolidBrush(Color.FromArgb(240, 244, 248)), margin, y, pageWidth, 24);
            g.DrawRectangle(Pens.SteelBlue, margin, y, pageWidth, 24);

            g.DrawString("#", boldFont, Brushes.Black, colNum + 5, y + 4);
            g.DrawString("Description", boldFont, Brushes.Black, colItem, y + 4);
            g.DrawString("Barcode", boldFont, Brushes.Black, colBarcode, y + 4);
            g.DrawString("Qty", boldFont, Brushes.Black, colQty, y + 4);
            g.DrawString("Rate", boldFont, Brushes.Black, colRate, y + 4);
            g.DrawString("Disc", boldFont, Brushes.Black, colDisc, y + 4);
            g.DrawString("GST %", boldFont, Brushes.Black, colGst, y + 4);
            g.DrawString("Total (₹)", boldFont, Brushes.Black, new RectangleF(colTotal, y + 4, 100, 20), sfRight);
            y += 26;

            int rowIdx = 1;
            foreach (var item in inv.Items)
            {
                g.DrawString(rowIdx.ToString(), normalFont, Brushes.Black, colNum + 5, y);
                g.DrawString(item.ProductName, boldFont, Brushes.Black, colItem, y);
                g.DrawString(item.Barcode, normalFont, Brushes.Black, colBarcode, y);
                g.DrawString($"{item.Quantity} {item.Unit}", normalFont, Brushes.Black, colQty, y);
                g.DrawString($"₹{item.Rate:F2}", normalFont, Brushes.Black, colRate, y);
                g.DrawString($"₹{item.DiscountAmount:F2}", normalFont, Brushes.Black, colDisc, y);
                g.DrawString($"{item.TaxRate}%", normalFont, Brushes.Black, colGst, y);
                g.DrawString($"₹{item.LineTotal:F2}", boldFont, Brushes.Black, new RectangleF(colTotal, y, 100, 18), sfRight);

                y += 20;
                rowIdx++;
            }

            g.DrawLine(Pens.SteelBlue, margin, y, margin + pageWidth, y);
            y += 10;

            // Totals and Tax Breakdown
            float totX = margin + 450;
            g.DrawString("Gross Amount:", normalFont, Brushes.Black, totX, y);
            g.DrawString($"₹{inv.GrossAmount:F2}", normalFont, Brushes.Black, new RectangleF(totX + 150, y, 140, 18), sfRight);
            y += 18;

            g.DrawString("Discounts:", normalFont, Brushes.Black, totX, y);
            g.DrawString($"-₹{(inv.ItemDiscount + inv.BillDiscount):F2}", normalFont, Brushes.Black, new RectangleF(totX + 150, y, 140, 18), sfRight);
            y += 18;

            g.DrawString("Taxable Amount:", normalFont, Brushes.Black, totX, y);
            g.DrawString($"₹{inv.TaxableAmount:F2}", normalFont, Brushes.Black, new RectangleF(totX + 150, y, 140, 18), sfRight);
            y += 18;

            if (inv.IsInterstate)
            {
                g.DrawString("IGST Total:", normalFont, Brushes.Black, totX, y);
                g.DrawString($"₹{inv.IgstAmount:F2}", normalFont, Brushes.Black, new RectangleF(totX + 150, y, 140, 18), sfRight);
                y += 18;
            }
            else
            {
                g.DrawString("CGST Total:", normalFont, Brushes.Black, totX, y);
                g.DrawString($"₹{inv.CgstAmount:F2}", normalFont, Brushes.Black, new RectangleF(totX + 150, y, 140, 18), sfRight);
                y += 18;
                g.DrawString("SGST Total:", normalFont, Brushes.Black, totX, y);
                g.DrawString($"₹{inv.SgstAmount:F2}", normalFont, Brushes.Black, new RectangleF(totX + 150, y, 140, 18), sfRight);
                y += 18;
            }

            if (inv.RoundOff != 0)
            {
                g.DrawString("Round Off:", normalFont, Brushes.Black, totX, y);
                g.DrawString($"₹{inv.RoundOff:F2}", normalFont, Brushes.Black, new RectangleF(totX + 150, y, 140, 18), sfRight);
                y += 18;
            }

            g.DrawLine(Pens.SteelBlue, totX, y, margin + pageWidth, y);
            y += 6;

            var grandFontA4 = new Font("Segoe UI", 12f, FontStyle.Bold);
            g.DrawString("TOTAL INVOICE VALUE:", grandFontA4, Brushes.Black, totX - 40, y);
            g.DrawString($"₹{inv.GrandTotal:F2}", grandFontA4, Brushes.Black, new RectangleF(totX + 140, y, 150, 24), sfRight);
            y += 30;

            g.DrawString($"Payment Status: {inv.PaymentStatus} | Paid: ₹{inv.AmountPaid:F2} | Balance Due: ₹{inv.BalanceDue:F2}", boldFont, Brushes.Black, margin, y);
            y += 40;

            g.DrawString("Authorized Signatory", boldFont, Brushes.Black, new RectangleF(margin + 550, y, 190, 20), sfCenter);
            g.DrawLine(Pens.Black, margin + 550, y - 5, margin + 740, y - 5);
        }
    }
}
