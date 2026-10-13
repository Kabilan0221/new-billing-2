using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Printing;
using System.Drawing.Text;
using System.Linq;
using System.Windows.Forms;
using ShopBilling.Core.Models;

namespace ShopBilling.UI.Utilities
{
    public static class BarcodeRenderer
    {
        // Standard ISO/IEC 15417 Code 128 patterns (widths of alternate bars and spaces: 6 digits totaling 11 modules)
        private static readonly string[] Code128Patterns = new string[]
        {
            "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
            "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
            "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
            "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
            "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
            "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
            "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
            "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
            "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
            "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
            "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106 (104=Start B, 106=Stop)
        };

        // EAN-13 Digits A, B, C patterns (7 modules each: 1=bar, 0=space)
        private static readonly string[] EanA = new string[] { "0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011" };
        private static readonly string[] EanB = new string[] { "0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111" };
        private static readonly string[] EanC = new string[] { "1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100" };

        // Parity mapping for the 6 left digits of EAN-13 based on the 1st digit
        private static readonly string[] EanParity = new string[]
        {
            "AAAAAA", "AABABB", "AABBAB", "AABBBA", "ABAABB",
            "ABBAAB", "ABBBAA", "ABABAB", "ABABBA", "ABBABA"
        };

        public static Bitmap GenerateBarcodeImage(string barcodeText, int width = 280, int height = 80, string format = "Code128")
        {
            if (format.Equals("EAN13", StringComparison.OrdinalIgnoreCase) && barcodeText?.Length == 13 && barcodeText.All(char.IsDigit))
            {
                return GenerateEan13Bitmap(barcodeText, width, height);
            }

            return GenerateCode128Bitmap(barcodeText, width, height);
        }

        public static Bitmap GenerateCode128Bitmap(string text, int width = 280, int height = 80)
        {
            if (string.IsNullOrEmpty(text)) text = "000000";

            // Encode using Code 128 Subset B
            var symbols = new List<int> { 104 }; // Start B
            int checksum = 104;

            for (int i = 0; i < text.Length; i++)
            {
                int val = text[i] - 32;
                if (val < 0 || val > 95) val = 0; // Fallback space
                symbols.Add(val);
                checksum += (i + 1) * val;
            }

            symbols.Add(checksum % 103);
            symbols.Add(106); // Stop code

            // Expand to module bits (true = bar, false = space)
            var modules = new List<bool>();
            // Left quiet zone (10 modules)
            for (int q = 0; q < 10; q++) modules.Add(false);

            foreach (int sym in symbols)
            {
                string pattern = Code128Patterns[sym];
                bool isBar = true;
                foreach (char ch in pattern)
                {
                    int run = ch - '0';
                    for (int r = 0; r < run; r++) modules.Add(isBar);
                    isBar = !isBar;
                }
            }

            // Right quiet zone (10 modules)
            for (int q = 0; q < 10; q++) modules.Add(false);

            var bmp = new Bitmap(Math.Max(width, modules.Count * 2), height);
            using (var g = Graphics.FromImage(bmp))
            {
                g.Clear(Color.White);
                g.SmoothingMode = SmoothingMode.None;
                g.PixelOffsetMode = PixelOffsetMode.Half;
                g.TextRenderingHint = TextRenderingHint.SingleBitPerPixelGridFit;

                float moduleWidth = (float)bmp.Width / modules.Count;
                float barHeight = height - 20;

                using (var brush = new SolidBrush(Color.Black))
                {
                    for (int m = 0; m < modules.Count; m++)
                    {
                        if (modules[m])
                        {
                            g.FillRectangle(brush, m * moduleWidth, 4, moduleWidth + 0.2f, barHeight);
                        }
                    }
                }

                // Barcode text label
                using (var font = new Font("Consolas", 9f, FontStyle.Bold))
                using (var brush = new SolidBrush(Color.Black))
                using (var sf = new StringFormat { Alignment = StringAlignment.Center })
                {
                    g.DrawString(text, font, brush, new RectangleF(0, height - 16, bmp.Width, 16), sf);
                }
            }

            return bmp;
        }

        public static Bitmap GenerateEan13Bitmap(string code, int width = 280, int height = 80)
        {
            if (code == null || code.Length != 13) return GenerateCode128Bitmap(code, width, height);

            int firstDigit = code[0] - '0';
            string parity = EanParity[firstDigit];

            var modules = new List<bool>();
            // Quiet zone
            for (int q = 0; q < 9; q++) modules.Add(false);

            // Start guard (101)
            modules.Add(true); modules.Add(false); modules.Add(true);

            // Left 6 digits
            for (int i = 1; i <= 6; i++)
            {
                int digit = code[i] - '0';
                char type = parity[i - 1];
                string pattern = (type == 'A') ? EanA[digit] : EanB[digit];
                foreach (char c in pattern) modules.Add(c == '1');
            }

            // Center guard (01010)
            modules.Add(false); modules.Add(true); modules.Add(false); modules.Add(true); modules.Add(false);

            // Right 6 digits (C pattern)
            for (int i = 7; i <= 12; i++)
            {
                int digit = code[i] - '0';
                string pattern = EanC[digit];
                foreach (char c in pattern) modules.Add(c == '1');
            }

            // Stop guard (101)
            modules.Add(true); modules.Add(false); modules.Add(true);

            // Right quiet zone
            for (int q = 0; q < 9; q++) modules.Add(false);

            var bmp = new Bitmap(Math.Max(width, modules.Count * 2), height);
            using (var g = Graphics.FromImage(bmp))
            {
                g.Clear(Color.White);
                g.SmoothingMode = SmoothingMode.None;
                g.PixelOffsetMode = PixelOffsetMode.Half;
                g.TextRenderingHint = TextRenderingHint.SingleBitPerPixelGridFit;

                float moduleWidth = (float)bmp.Width / modules.Count;
                float barHeight = height - 20;

                using (var brush = new SolidBrush(Color.Black))
                {
                    for (int m = 0; m < modules.Count; m++)
                    {
                        if (modules[m])
                        {
                            g.FillRectangle(brush, m * moduleWidth, 4, moduleWidth + 0.2f, barHeight);
                        }
                    }
                }

                using (var font = new Font("Consolas", 9f, FontStyle.Bold))
                using (var brush = new SolidBrush(Color.Black))
                using (var sf = new StringFormat { Alignment = StringAlignment.Center })
                {
                    g.DrawString(code, font, brush, new RectangleF(0, height - 16, bmp.Width, 16), sf);
                }
            }

            return bmp;
        }

        public static void RenderLabel(Graphics g, RectangleF rect, BarcodeStudioItem item, BarcodePrintConfig config)
        {
            if (item == null || config == null) return;

            g.FillRectangle(Brushes.White, rect);
            using (var borderPen = new Pen(Color.FromArgb(200, 200, 200), 0.5f))
            {
                g.DrawRectangle(borderPen, rect.X, rect.Y, rect.Width, rect.Height);
            }

            float y = rect.Y + 2;
            using (var sfCenter = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center, Trimming = StringTrimming.EllipsisCharacter })
            {
                // Store Name
                if (config.IncludeStoreName && !string.IsNullOrWhiteSpace(config.StoreName))
                {
                    using (var storeFont = new Font("Segoe UI", 7.5f, FontStyle.Bold))
                    {
                        g.DrawString(config.StoreName, storeFont, Brushes.Black, new RectangleF(rect.X + 2, y, rect.Width - 4, 12), sfCenter);
                    }
                    y += 12;
                }

                // Product Name
                if (config.IncludeProductName)
                {
                    using (var nameFont = new Font("Segoe UI", 7.5f, FontStyle.Bold))
                    {
                        g.DrawString(item.NameEn, nameFont, Brushes.Black, new RectangleF(rect.X + 2, y, rect.Width - 4, 12), sfCenter);
                    }
                    y += 13;
                }

                // Barcode graphic
                float barcodeHeight = Math.Max(20, rect.Height - (y - rect.Y) - 16);
                using (var barcodeBmp = GenerateBarcodeImage(item.Barcode, (int)rect.Width - 8, (int)barcodeHeight, config.BarcodeFormat))
                {
                    g.DrawImage(barcodeBmp, new RectangleF(rect.X + 4, y, rect.Width - 8, barcodeHeight));
                }
                y += barcodeHeight;

                // Price line
                if (config.IncludePrice)
                {
                    using (var priceFont = new Font("Segoe UI", 7.5f, FontStyle.Bold))
                    {
                        string priceText = $"{config.CurrencySymbol}{item.SaleRate:N2}";
                        if (item.Mrp > item.SaleRate)
                        {
                            priceText = $"MRP: {config.CurrencySymbol}{item.Mrp:N2} | SALE: {config.CurrencySymbol}{item.SaleRate:N2}";
                        }
                        g.DrawString(priceText, priceFont, Brushes.Black, new RectangleF(rect.X + 2, rect.Bottom - 14, rect.Width - 4, 12), sfCenter);
                    }
                }
            }
        }

        public static void PrintLabels(List<BarcodeStudioItem> selectedItems, BarcodePrintConfig config)
        {
            if (selectedItems == null || selectedItems.Count == 0)
            {
                MessageBox.Show("No products selected for barcode printing.", "Barcode Studio", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            // Flatten items by label count
            var queue = new List<BarcodeStudioItem>();
            foreach (var item in selectedItems.Where(i => i.IsSelected))
            {
                for (int c = 0; c < Math.Max(1, item.LabelCount); c++)
                {
                    queue.Add(item);
                }
            }

            if (queue.Count == 0)
            {
                MessageBox.Show("Total label count is zero.", "Barcode Studio", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            try
            {
                int itemIndex = 0;
                var pd = new PrintDocument();
                pd.DocumentName = $"BarcodeLabels_{DateTime.Now:yyyyMMdd_HHmmss}";
                pd.DefaultPageSettings.PaperSize = new PaperSize("A4", 827, 1169); // Standard A4 (100ths of inch: 8.27 x 11.69 in)
                pd.DefaultPageSettings.Margins = new Margins(20, 20, 20, 20);

                pd.PrintPage += (s, e) =>
                {
                    var g = e.Graphics;
                    // Convert mm to 100ths of an inch (1 mm = 3.937 hundredths of an inch)
                    float mmToInch100 = 3.937f;

                    float labelWidth = config.LabelWidthMm * mmToInch100;
                    float labelHeight = config.LabelHeightMm * mmToInch100;
                    float gapX = config.HorizontalGapMm * mmToInch100;
                    float gapY = config.VerticalGapMm * mmToInch100;
                    float marginX = config.PageMarginLeftMm * mmToInch100;
                    float marginY = config.PageMarginTopMm * mmToInch100;

                    int cols = Math.Max(1, config.LabelsPerRow);
                    float curY = marginY;

                    while (itemIndex < queue.Count)
                    {
                        if (curY + labelHeight > e.PageBounds.Height - marginY)
                        {
                            e.HasMorePages = true;
                            return;
                        }

                        for (int col = 0; col < cols && itemIndex < queue.Count; col++)
                        {
                            float curX = marginX + col * (labelWidth + gapX);
                            var labelRect = new RectangleF(curX, curY, labelWidth, labelHeight);
                            RenderLabel(g, labelRect, queue[itemIndex], config);
                            itemIndex++;
                        }

                        curY += labelHeight + gapY;
                    }

                    e.HasMorePages = false;
                };

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
    }
}
