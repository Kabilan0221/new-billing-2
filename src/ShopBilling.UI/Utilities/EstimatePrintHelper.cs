using System;
using System.Drawing;
using System.Drawing.Printing;
using System.Linq;
using System.Windows.Forms;
using ShopBilling.Core.Models;

namespace ShopBilling.UI.Utilities
{
    public static class EstimatePrintHelper
    {
        public static void PrintEstimate(EstimateHeader estimate)
        {
            if (estimate == null) return;

            try
            {
                var pd = new PrintDocument();
                pd.DocumentName = $"Estimate_{estimate.EstimateNumber}";
                pd.DefaultPageSettings.PaperSize = new PaperSize("A4", 827, 1169);
                pd.DefaultPageSettings.Margins = new Margins(30, 30, 30, 30);
                pd.PrintPage += (s, e) => RenderA4Estimate(e, estimate);

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

        private static void RenderA4Estimate(PrintPageEventArgs e, EstimateHeader est)
        {
            var g = e.Graphics;
            float left = 35;
            float right = e.PageBounds.Width - 35;
            float width = right - left;
            float y = 35;

            var titleFont = new Font("Segoe UI", 16f, FontStyle.Bold);
            var headerFont = new Font("Segoe UI", 12f, FontStyle.Bold);
            var subFont = new Font("Segoe UI", 9f, FontStyle.Regular);
            var boldFont = new Font("Segoe UI", 9f, FontStyle.Bold);
            var normalFont = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            var watermarkFont = new Font("Segoe UI", 10.5f, FontStyle.Bold);

            var sfCenter = new StringFormat { Alignment = StringAlignment.Center };
            var sfRight = new StringFormat { Alignment = StringAlignment.Far };
            var sfLeft = new StringFormat { Alignment = StringAlignment.Near };

            // Top Warning Notice Banner (Required by prompt: clearly distinct from tax invoice)
            var bannerRect = new RectangleF(left, y, width, 24);
            g.FillRectangle(new SolidBrush(Color.FromArgb(254, 243, 199)), bannerRect);
            g.DrawRectangle(new Pen(Color.FromArgb(245, 158, 11)), bannerRect.X, bannerRect.Y, bannerRect.Width, bannerRect.Height);
            g.DrawString("ESTIMATE / QUOTATION — NOT A TAX INVOICE", watermarkFont, new SolidBrush(Color.FromArgb(146, 64, 14)), bannerRect, sfCenter);
            y += 32;

            // Store Name & Header
            g.DrawString("SRI MEENAKSHI SUPER STORE", titleFont, Brushes.Black, new RectangleF(left, y, width, 26), sfCenter);
            y += 26;
            g.DrawString("124, West Masi Street, Madurai - 625001 | Phone: 0452-2345678", subFont, Brushes.Black, new RectangleF(left, y, width, 18), sfCenter);
            y += 18;
            g.DrawString("GSTIN: 33AABCS1429B1Z1 | State: Tamil Nadu (Code 33)", subFont, Brushes.Black, new RectangleF(left, y, width, 18), sfCenter);
            y += 24;

            g.DrawLine(new Pen(Color.Black, 1.5f), left, y, right, y);
            y += 8;

            // Two-column layout for Estimate Meta & Customer
            float colWidth = width / 2;

            // Left: Customer details
            g.DrawString("CUSTOMER DETAILS / QUOTATION TO:", boldFont, Brushes.Black, left, y);
            g.DrawString($"Name: {est.CustomerName}", normalFont, Brushes.Black, left, y + 18);
            g.DrawString($"Mobile: {est.CustomerMobile ?? "N/A"}", normalFont, Brushes.Black, left, y + 34);
            g.DrawString($"GSTIN: {est.CustomerGstin ?? "Unregistered / Consumer"}", normalFont, Brushes.Black, left, y + 50);
            g.DrawString($"Place of Supply: {est.StateName ?? "Tamil Nadu"} (Code: {est.StateCode ?? "33"})", normalFont, Brushes.Black, left, y + 66);

            // Right: Estimate Meta
            float rightCol = left + colWidth + 10;
            g.DrawString("ESTIMATE DETAILS:", boldFont, Brushes.Black, rightCol, y);
            g.DrawString($"Estimate No: {est.EstimateNumber}", boldFont, Brushes.DarkBlue, rightCol, y + 18);
            g.DrawString($"Date: {est.EstimateDate:dd-MMM-yyyy hh:mm tt}", normalFont, Brushes.Black, rightCol, y + 34);
            g.DrawString($"Valid Until: {(est.ValidUntil.HasValue ? est.ValidUntil.Value.ToString("dd-MMM-yyyy") : "15 Days")}", normalFont, Brushes.Black, rightCol, y + 50);
            g.DrawString($"Status: {est.Status.ToUpper()}", boldFont, est.Status == "Converted" ? Brushes.Purple : (est.Status == "Confirmed" ? Brushes.DarkGreen : Brushes.DarkOrange), rightCol, y + 66);

            y += 90;
            g.DrawLine(Pens.Gray, left, y, right, y);
            y += 6;

            // Items Table Header
            float colSNo = 30;
            float colBarcode = 90;
            float colName = 200;
            float colQty = 55;
            float colRate = 65;
            float colDisc = 55;
            float colTax = 65;
            float colTotal = width - (colSNo + colBarcode + colName + colQty + colRate + colDisc + colTax);

            g.FillRectangle(new SolidBrush(Color.FromArgb(243, 244, 246)), left, y, width, 22);
            g.DrawRectangle(Pens.Gray, left, y, width, 22);

            float curX = left;
            g.DrawString("#", boldFont, Brushes.Black, new RectangleF(curX, y + 3, colSNo, 18), sfCenter); curX += colSNo;
            g.DrawString("Barcode / Code", boldFont, Brushes.Black, new RectangleF(curX, y + 3, colBarcode, 18), sfLeft); curX += colBarcode;
            g.DrawString("Product Description", boldFont, Brushes.Black, new RectangleF(curX, y + 3, colName, 18), sfLeft); curX += colName;
            g.DrawString("Qty", boldFont, Brushes.Black, new RectangleF(curX, y + 3, colQty, 18), sfRight); curX += colQty;
            g.DrawString("Rate", boldFont, Brushes.Black, new RectangleF(curX, y + 3, colRate, 18), sfRight); curX += colRate;
            g.DrawString("Disc", boldFont, Brushes.Black, new RectangleF(curX, y + 3, colDisc, 18), sfRight); curX += colDisc;
            g.DrawString("GST %", boldFont, Brushes.Black, new RectangleF(curX, y + 3, colTax, 18), sfRight); curX += colTax;
            g.DrawString("Line Total", boldFont, Brushes.Black, new RectangleF(curX, y + 3, colTotal, 18), sfRight);

            y += 24;

            // Line items
            int sNo = 1;
            foreach (var item in est.Items)
            {
                curX = left;
                g.DrawString(sNo.ToString(), normalFont, Brushes.Black, new RectangleF(curX, y + 2, colSNo, 18), sfCenter); curX += colSNo;
                g.DrawString(item.Barcode ?? item.ProductCode, normalFont, Brushes.Black, new RectangleF(curX, y + 2, colBarcode, 18), sfLeft); curX += colBarcode;
                g.DrawString(item.ProductName, boldFont, Brushes.Black, new RectangleF(curX, y + 2, colName, 18), sfLeft); curX += colName;
                g.DrawString($"{item.Quantity:N0} {item.Unit}", normalFont, Brushes.Black, new RectangleF(curX, y + 2, colQty, 18), sfRight); curX += colQty;
                g.DrawString($"₹{item.Rate:N2}", normalFont, Brushes.Black, new RectangleF(curX, y + 2, colRate, 18), sfRight); curX += colRate;
                g.DrawString(item.DiscountAmount > 0 ? $"₹{item.DiscountAmount:N2}" : "-", normalFont, Brushes.Black, new RectangleF(curX, y + 2, colDisc, 18), sfRight); curX += colDisc;
                g.DrawString($"{item.TaxRate}%", normalFont, Brushes.Black, new RectangleF(curX, y + 2, colTax, 18), sfRight); curX += colTax;
                g.DrawString($"₹{item.LineTotal:N2}", boldFont, Brushes.Black, new RectangleF(curX, y + 2, colTotal, 18), sfRight);

                y += 20;
                sNo++;
            }

            g.DrawLine(Pens.Gray, left, y, right, y);
            y += 8;

            // Summary Totals Panel on the Right
            float totalsWidth = 260;
            float totalsLeft = right - totalsWidth;

            g.DrawString("Gross Subtotal:", normalFont, Brushes.Black, totalsLeft, y);
            g.DrawString($"₹{est.GrossAmount:N2}", normalFont, Brushes.Black, new RectangleF(totalsLeft, y, totalsWidth, 18), sfRight);
            y += 18;

            if (est.ItemDiscount > 0)
            {
                g.DrawString("Item Discounts:", normalFont, Brushes.Black, totalsLeft, y);
                g.DrawString($"-₹{est.ItemDiscount:N2}", normalFont, Brushes.Black, new RectangleF(totalsLeft, y, totalsWidth, 18), sfRight);
                y += 18;
            }

            if (est.BillDiscount > 0)
            {
                g.DrawString("Bill Discount:", normalFont, Brushes.Black, totalsLeft, y);
                g.DrawString($"-₹{est.BillDiscount:N2}", normalFont, Brushes.Black, new RectangleF(totalsLeft, y, totalsWidth, 18), sfRight);
                y += 18;
            }

            g.DrawString("Taxable Value:", normalFont, Brushes.Black, totalsLeft, y);
            g.DrawString($"₹{est.TaxableAmount:N2}", normalFont, Brushes.Black, new RectangleF(totalsLeft, y, totalsWidth, 18), sfRight);
            y += 18;

            if (est.IsInterstate)
            {
                g.DrawString("Integrated GST (IGST):", normalFont, Brushes.Black, totalsLeft, y);
                g.DrawString($"₹{est.IgstAmount:N2}", normalFont, Brushes.Black, new RectangleF(totalsLeft, y, totalsWidth, 18), sfRight);
                y += 18;
            }
            else
            {
                g.DrawString("Central GST (CGST):", normalFont, Brushes.Black, totalsLeft, y);
                g.DrawString($"₹{est.CgstAmount:N2}", normalFont, Brushes.Black, new RectangleF(totalsLeft, y, totalsWidth, 18), sfRight);
                y += 18;
                g.DrawString("State GST (SGST):", normalFont, Brushes.Black, totalsLeft, y);
                g.DrawString($"₹{est.SgstAmount:N2}", normalFont, Brushes.Black, new RectangleF(totalsLeft, y, totalsWidth, 18), sfRight);
                y += 18;
            }

            if (est.RoundOff != 0)
            {
                g.DrawString("Round Off:", normalFont, Brushes.Black, totalsLeft, y);
                g.DrawString($"₹{est.RoundOff:N2}", normalFont, Brushes.Black, new RectangleF(totalsLeft, y, totalsWidth, 18), sfRight);
                y += 18;
            }

            g.DrawLine(Pens.Black, totalsLeft, y, right, y);
            y += 4;

            var grandBox = new RectangleF(totalsLeft, y, totalsWidth, 26);
            g.FillRectangle(new SolidBrush(Color.FromArgb(238, 242, 255)), grandBox);
            g.DrawRectangle(new Pen(Color.FromArgb(99, 102, 241)), grandBox.X, grandBox.Y, grandBox.Width, grandBox.Height);
            g.DrawString("ESTIMATED TOTAL:", boldFont, Brushes.Black, totalsLeft + 5, y + 4);
            g.DrawString($"₹{est.GrandTotal:N2}", headerFont, new SolidBrush(Color.FromArgb(30, 27, 75)), new RectangleF(totalsLeft, y + 2, totalsWidth - 5, 22), sfRight);

            // Left side notes and terms
            float termsWidth = width - totalsWidth - 20;
            float termsY = y - 90;
            g.DrawString("TERMS & CONDITIONS / NOTES:", boldFont, Brushes.Black, left, termsY);
            string terms = est.TermsConditions ?? "1. Prices valid for 15 days from date of quotation.\n2. GST levied as per applicable rates.\n3. Goods subject to availability at time of billing.\n4. This quotation does not constitute an invoice.";
            g.DrawString(terms, normalFont, Brushes.Black, new RectangleF(left, termsY + 18, termsWidth, 80));

            y += 60;

            // Sign-off
            g.DrawLine(Pens.Black, right - 180, y, right, y);
            g.DrawString("Authorized Signatory", normalFont, Brushes.Black, new RectangleF(right - 180, y + 4, 180, 18), sfCenter);
            g.DrawString("For SRI MEENAKSHI SUPER STORE", subFont, Brushes.Black, new RectangleF(right - 180, y + 20, 180, 18), sfCenter);

            y += 45;
            g.DrawString("Thank you for your business inquiry! This document is generated by ShopBilling Pro.", subFont, Brushes.Gray, new RectangleF(left, y, width, 18), sfCenter);
        }
    }
}
