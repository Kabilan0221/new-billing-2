using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using ShopBilling.Core.Models;
using ShopBilling.Core.Services;

namespace ShopBilling.UI.Forms
{
    public class ReportsControl : UserControl
    {
        private readonly ReportService _reportService;

        private ComboBox cmbReportType;
        private DateTimePicker dtpFrom;
        private DateTimePicker dtpTo;
        private TextBox txtSearch;
        private ComboBox cmbStatus;
        private Button btnGenerate;
        private Button btnExportCsv;
        private Button btnQuickToday;
        private Button btnQuick7Days;
        private Button btnQuickMonth;
        private DataGridView gridReports;
        private Label lblSummary;

        public ReportsControl(ReportService reportService)
        {
            _reportService = reportService ?? throw new ArgumentNullException(nameof(reportService));
            InitializeComponent();
            LoadReport();
        }

        private void InitializeComponent()
        {
            this.Dock = DockStyle.Fill;
            this.BackColor = Color.FromArgb(243, 244, 246);
            this.Font = new Font("Segoe UI", 9f);

            var pnlTop = new Panel
            {
                Dock = DockStyle.Top,
                Height = 115,
                BackColor = Color.White,
                Padding = new Padding(16, 12, 16, 12)
            };

            var lblHeader = new Label
            {
                Text = "Business Intelligence & Statutory Reports (F10)",
                Font = new Font("Segoe UI", 13f, FontStyle.Bold),
                ForeColor = Color.FromArgb(24, 43, 73),
                Location = new Point(16, 10),
                AutoSize = true
            };

            // Row 1 Filters
            var lblType = new Label { Text = "Report Module:", Location = new Point(16, 42), AutoSize = true, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) };
            cmbReportType = new ComboBox
            {
                Location = new Point(16, 62),
                Width = 200,
                DropDownStyle = ComboBoxStyle.DropDownList
            };
            cmbReportType.Items.AddRange(new object[] {
                "Sales - Bill Wise",
                "Sales - Product Wise",
                "Purchase & Inbound Goods",
                "Stock Valuation & Inventory",
                "Customer Balances & Sales",
                "Payment Collections"
            });
            cmbReportType.SelectedIndex = 0;
            cmbReportType.SelectedIndexChanged += (s, e) => LoadReport();

            var lblFrom = new Label { Text = "From Date:", Location = new Point(230, 42), AutoSize = true, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) };
            dtpFrom = new DateTimePicker
            {
                Location = new Point(230, 62),
                Width = 120,
                Format = DateTimePickerFormat.Short,
                Value = DateTime.Now.AddDays(-6)
            };

            var lblTo = new Label { Text = "To Date:", Location = new Point(360, 42), AutoSize = true, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) };
            dtpTo = new DateTimePicker
            {
                Location = new Point(360, 62),
                Width = 120,
                Format = DateTimePickerFormat.Short,
                Value = DateTime.Now
            };

            var lblSearch = new Label { Text = "Search Keyword:", Location = new Point(490, 42), AutoSize = true, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) };
            txtSearch = new TextBox
            {
                Location = new Point(490, 62),
                Width = 160
            };
            txtSearch.KeyDown += (s, e) => { if (e.KeyCode == Keys.Enter) LoadReport(); };

            var lblStatus = new Label { Text = "Status:", Location = new Point(660, 42), AutoSize = true, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) };
            cmbStatus = new ComboBox
            {
                Location = new Point(660, 62),
                Width = 110,
                DropDownStyle = ComboBoxStyle.DropDownList
            };
            cmbStatus.Items.AddRange(new object[] { "All", "Confirmed", "Cancelled" });
            cmbStatus.SelectedIndex = 1; // Confirmed by default

            btnGenerate = new Button
            {
                Text = "🔍 Run Report",
                Location = new Point(780, 58),
                Size = new Size(110, 30),
                BackColor = Color.FromArgb(16, 110, 190),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnGenerate.FlatAppearance.BorderSize = 0;
            btnGenerate.Click += (s, e) => LoadReport();

            btnExportCsv = new Button
            {
                Text = "💾 Export CSV",
                Location = new Point(900, 58),
                Size = new Size(110, 30),
                BackColor = Color.FromArgb(46, 125, 50),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnExportCsv.FlatAppearance.BorderSize = 0;
            btnExportCsv.Click += (s, e) => ExportCurrentReport();

            // Quick date buttons
            btnQuickToday = new Button { Text = "Today", Location = new Point(400, 10), Size = new Size(60, 24), FlatStyle = FlatStyle.Flat };
            btnQuickToday.Click += (s, e) => { dtpFrom.Value = DateTime.Now; dtpTo.Value = DateTime.Now; LoadReport(); };

            btnQuick7Days = new Button { Text = "7 Days", Location = new Point(465, 10), Size = new Size(65, 24), FlatStyle = FlatStyle.Flat };
            btnQuick7Days.Click += (s, e) => { dtpFrom.Value = DateTime.Now.AddDays(-6); dtpTo.Value = DateTime.Now; LoadReport(); };

            btnQuickMonth = new Button { Text = "This Month", Location = new Point(535, 10), Size = new Size(80, 24), FlatStyle = FlatStyle.Flat };
            btnQuickMonth.Click += (s, e) => { dtpFrom.Value = new DateTime(DateTime.Now.Year, DateTime.Now.Month, 1); dtpTo.Value = DateTime.Now; LoadReport(); };

            pnlTop.Controls.AddRange(new Control[] {
                lblHeader, lblType, cmbReportType, lblFrom, dtpFrom, lblTo, dtpTo,
                lblSearch, txtSearch, lblStatus, cmbStatus, btnGenerate, btnExportCsv,
                btnQuickToday, btnQuick7Days, btnQuickMonth
            });

            // Bottom Summary Strip
            var pnlBottom = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 44,
                BackColor = Color.FromArgb(238, 242, 246),
                Padding = new Padding(16, 10, 16, 10),
                BorderStyle = BorderStyle.FixedSingle
            };

            lblSummary = new Label
            {
                Dock = DockStyle.Fill,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(24, 43, 73),
                TextAlign = ContentAlignment.MiddleLeft,
                Text = "Ready to run report."
            };
            pnlBottom.Controls.Add(lblSummary);

            // Data Grid View
            gridReports = new DataGridView
            {
                Dock = DockStyle.Fill,
                BackgroundColor = Color.White,
                BorderStyle = BorderStyle.None,
                RowHeadersVisible = false,
                AllowUserToAddRows = false,
                AllowUserToDeleteRows = false,
                ReadOnly = true,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill
            };

            this.Controls.Add(gridReports);
            this.Controls.Add(pnlBottom);
            this.Controls.Add(pnlTop);
        }

        public void LoadReport()
        {
            if (dtpFrom.Value > dtpTo.Value)
            {
                MessageBox.Show("Start Date cannot be greater than End Date.", "Invalid Date Range", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            var filter = new ReportFilter
            {
                FromDate = dtpFrom.Value.Date,
                ToDate = dtpTo.Value.Date.AddDays(1).AddTicks(-1),
                SearchTerm = txtSearch.Text.Trim(),
                Status = cmbStatus.SelectedItem?.ToString() ?? "All"
            };

            string repType = cmbReportType.SelectedItem?.ToString() ?? "Sales - Bill Wise";

            gridReports.Columns.Clear();
            gridReports.Rows.Clear();

            switch (repType)
            {
                case "Sales - Bill Wise":
                    LoadBillWiseSales(filter);
                    break;
                case "Sales - Product Wise":
                    LoadProductWiseSales(filter);
                    break;
                case "Purchase & Inbound Goods":
                    LoadPurchases(filter);
                    break;
                case "Stock Valuation & Inventory":
                    LoadStock(filter);
                    break;
                case "Customer Balances & Sales":
                    LoadCustomers(filter);
                    break;
                case "Payment Collections":
                    LoadPayments(filter);
                    break;
            }
        }

        private void LoadBillWiseSales(ReportFilter filter)
        {
            gridReports.Columns.Add("Num", "Invoice #");
            gridReports.Columns.Add("Date", "Date");
            gridReports.Columns.Add("Customer", "Customer");
            gridReports.Columns.Add("Mode", "Pay Mode");
            gridReports.Columns.Add("Items", "Items");
            gridReports.Columns.Add("Qty", "Total Qty");
            gridReports.Columns.Add("Gross", "Gross");
            gridReports.Columns.Add("Discount", "Discount");
            gridReports.Columns.Add("Taxable", "Taxable");
            gridReports.Columns.Add("Tax", "GST");
            gridReports.Columns.Add("Total", "Grand Total");

            var rows = _reportService.GetSalesReport(filter);
            foreach (var r in rows)
            {
                gridReports.Rows.Add(
                    r.DocumentNumber,
                    r.DocumentDate.ToString("dd-MMM-yyyy HH:mm"),
                    r.CustomerName,
                    r.PaymentMethod,
                    r.TotalItems,
                    r.TotalQuantity,
                    $"₹{r.GrossAmount:N2}",
                    $"₹{r.DiscountAmount:N2}",
                    $"₹{r.TaxableAmount:N2}",
                    $"₹{r.TotalTax:N2}",
                    $"₹{r.GrandTotal:N2}"
                );
            }

            var summary = _reportService.CalculateSalesSummary(rows);
            lblSummary.Text = $"Total Invoices: {summary.TotalRecords:N0}  |  Total Billed Qty: {summary.TotalQuantity:N0}  |  Total Discount: ₹{summary.TotalDiscount:N2}  |  Total GST: ₹{summary.TotalTax:N2}  |  Grand Total Sales: ₹{summary.TotalAmount:N2}";
        }

        private void LoadProductWiseSales(ReportFilter filter)
        {
            gridReports.Columns.Add("Code", "Product Code");
            gridReports.Columns.Add("Barcode", "Barcode");
            gridReports.Columns.Add("Name", "Product Name");
            gridReports.Columns.Add("Unit", "Unit");
            gridReports.Columns.Add("Qty", "Qty Sold");
            gridReports.Columns.Add("Bills", "Bills Count");
            gridReports.Columns.Add("Disc", "Total Discount");
            gridReports.Columns.Add("Tax", "Total GST");
            gridReports.Columns.Add("Rev", "Total Revenue");

            var rows = _reportService.GetProductWiseSalesReport(filter);
            foreach (var r in rows)
            {
                gridReports.Rows.Add(
                    r.ProductCode,
                    r.Barcode,
                    r.ProductName,
                    r.Unit,
                    r.QuantitySold,
                    r.BillCount,
                    $"₹{r.TotalDiscount:N2}",
                    $"₹{r.TotalTax:N2}",
                    $"₹{r.TotalRevenue:N2}"
                );
            }

            decimal totalRev = 0;
            decimal totalQty = 0;
            foreach (var r in rows) { totalRev += r.TotalRevenue; totalQty += r.QuantitySold; }
            lblSummary.Text = $"Distinct Products Sold: {rows.Count:N0}  |  Total Units Sold: {totalQty:N0}  |  Total Revenue: ₹{totalRev:N2}";
        }

        private void LoadPurchases(ReportFilter filter)
        {
            gridReports.Columns.Add("Num", "Purchase #");
            gridReports.Columns.Add("Date", "Date");
            gridReports.Columns.Add("Supplier", "Supplier");
            gridReports.Columns.Add("InvNum", "Supplier Bill #");
            gridReports.Columns.Add("Qty", "Quantity");
            gridReports.Columns.Add("Taxable", "Taxable");
            gridReports.Columns.Add("Tax", "Tax");
            gridReports.Columns.Add("Total", "Grand Total");
            gridReports.Columns.Add("Paid", "Amount Paid");
            gridReports.Columns.Add("Due", "Balance Due");

            var rows = _reportService.GetPurchaseReport(filter);
            foreach (var r in rows)
            {
                gridReports.Rows.Add(
                    r.PurchaseNumber,
                    r.PurchaseDate.ToString("dd-MMM-yyyy"),
                    r.SupplierName,
                    r.SupplierInvoiceNumber,
                    r.TotalQuantity,
                    $"₹{r.TaxableAmount:N2}",
                    $"₹{r.TaxAmount:N2}",
                    $"₹{r.GrandTotal:N2}",
                    $"₹{r.AmountPaid:N2}",
                    $"₹{r.BalanceDue:N2}"
                );
            }

            var sum = _reportService.CalculatePurchaseSummary(rows);
            lblSummary.Text = $"Purchase Orders: {sum.TotalRecords:N0}  |  Purchased Qty: {sum.TotalQuantity:N0}  |  Total Purchases: ₹{sum.TotalAmount:N2}  |  Amount Paid: ₹{sum.TotalPaid:N2}  |  Balance Due: ₹{sum.TotalOutstanding:N2}";
        }

        private void LoadStock(ReportFilter filter)
        {
            gridReports.Columns.Add("Code", "Product Code");
            gridReports.Columns.Add("Barcode", "Barcode");
            gridReports.Columns.Add("Name", "Product Name");
            gridReports.Columns.Add("Category", "Category");
            gridReports.Columns.Add("Stock", "In-Hand Stock");
            gridReports.Columns.Add("Status", "Stock Status");
            gridReports.Columns.Add("Cost", "Cost Price");
            gridReports.Columns.Add("Sale", "Sale Price");
            gridReports.Columns.Add("ValCost", "Valuation (Cost)");
            gridReports.Columns.Add("ValSale", "Valuation (Sale)");

            var rows = _reportService.GetStockReport(filter);
            foreach (var r in rows)
            {
                gridReports.Rows.Add(
                    r.ProductCode,
                    r.Barcode,
                    r.ProductName,
                    r.CategoryName,
                    $"{r.CurrentStock:N0} {r.Unit}",
                    r.StockStatus,
                    $"₹{r.PurchaseRate:N2}",
                    $"₹{r.SaleRate:N2}",
                    $"₹{r.StockValueAtCost:N2}",
                    $"₹{r.StockValueAtSale:N2}"
                );
            }

            var sum = _reportService.CalculateStockSummary(rows);
            decimal totalSale = 0;
            foreach (var r in rows) totalSale += r.StockValueAtSale;
            lblSummary.Text = $"Catalog Items: {sum.TotalRecords:N0}  |  Total Physical Stock: {sum.TotalQuantity:N0} units  |  Stock Value @ Cost: ₹{sum.TotalAmount:N2}  |  Stock Value @ Sale: ₹{totalSale:N2}";
        }

        private void LoadCustomers(ReportFilter filter)
        {
            gridReports.Columns.Add("Code", "Customer Code");
            gridReports.Columns.Add("Name", "Customer Name");
            gridReports.Columns.Add("Mobile", "Mobile");
            gridReports.Columns.Add("Gstin", "GSTIN");
            gridReports.Columns.Add("Invoices", "Bills Count");
            gridReports.Columns.Add("Billed", "Total Billed");
            gridReports.Columns.Add("Paid", "Total Paid");
            gridReports.Columns.Add("Balance", "Current Outstanding");

            var rows = _reportService.GetCustomerReport(filter);
            foreach (var r in rows)
            {
                gridReports.Rows.Add(
                    r.CustomerCode,
                    r.CustomerName,
                    r.Mobile,
                    r.Gstin,
                    r.InvoicesCount,
                    $"₹{r.TotalBilledAmount:N2}",
                    $"₹{r.TotalPaidAmount:N2}",
                    $"₹{r.OutstandingBalance:N2}"
                );
            }

            var sum = _reportService.CalculateCustomerSummary(rows);
            lblSummary.Text = $"Total Customers: {sum.TotalRecords:N0}  |  Total Billed: ₹{sum.TotalAmount:N2}  |  Total Collected: ₹{sum.TotalPaid:N2}  |  Net Outstanding Balance: ₹{sum.TotalOutstanding:N2}";
        }

        private void LoadPayments(ReportFilter filter)
        {
            gridReports.Columns.Add("Date", "Payment Date");
            gridReports.Columns.Add("Invoice", "Invoice #");
            gridReports.Columns.Add("Customer", "Customer");
            gridReports.Columns.Add("Mode", "Tender Mode");
            gridReports.Columns.Add("Ref", "Ref # / UTR");
            gridReports.Columns.Add("Amount", "Amount Collected");

            var rows = _reportService.GetPaymentCollectionReport(filter);
            foreach (var r in rows)
            {
                gridReports.Rows.Add(
                    r.PaymentDate.ToString("dd-MMM-yyyy HH:mm"),
                    r.InvoiceNumber,
                    r.CustomerName,
                    r.PaymentMode,
                    r.ReferenceNumber,
                    $"₹{r.Amount:N2}"
                );
            }

            decimal totalColl = 0;
            foreach (var r in rows) totalColl += r.Amount;
            lblSummary.Text = $"Payment Receipts: {rows.Count:N0}  |  Total Tender Collected: ₹{totalColl:N2}";
        }

        private void ExportCurrentReport()
        {
            try
            {
                var sfd = new SaveFileDialog
                {
                    Filter = "CSV Files (*.csv)|*.csv",
                    FileName = $"ShopBilling_Report_{DateTime.Now:yyyyMMdd_HHmmss}.csv"
                };

                if (sfd.ShowDialog() == DialogResult.OK)
                {
                    string repType = cmbReportType.SelectedItem?.ToString() ?? "Sales - Bill Wise";
                    var filter = new ReportFilter
                    {
                        FromDate = dtpFrom.Value.Date,
                        ToDate = dtpTo.Value.Date.AddDays(1).AddTicks(-1),
                        SearchTerm = txtSearch.Text.Trim(),
                        Status = cmbStatus.SelectedItem?.ToString() ?? "All"
                    };

                    string csvContent = "";
                    if (repType == "Sales - Bill Wise")
                    {
                        var rows = _reportService.GetSalesReport(filter);
                        csvContent = _reportService.ExportSalesReportToCsv(rows);
                    }
                    else if (repType == "Sales - Product Wise")
                    {
                        var rows = _reportService.GetProductWiseSalesReport(filter);
                        csvContent = _reportService.ExportProductWiseSalesReportToCsv(rows);
                    }
                    else if (repType == "Stock Valuation & Inventory")
                    {
                        var rows = _reportService.GetStockReport(filter);
                        csvContent = _reportService.ExportStockReportToCsv(rows);
                    }
                    else
                    {
                        // Generic grid CSV export
                        var sb = new System.Text.StringBuilder();
                        sb.AppendLine($"# {repType} - Exported {DateTime.Now:dd-MMM-yyyy HH:mm:ss}");
                        for (int i = 0; i < gridReports.Columns.Count; i++)
                        {
                            sb.Append(ReportService.EscapeCsvValue(gridReports.Columns[i].HeaderText));
                            if (i < gridReports.Columns.Count - 1) sb.Append(",");
                        }
                        sb.AppendLine();

                        foreach (DataGridViewRow row in gridReports.Rows)
                        {
                            for (int i = 0; i < gridReports.Columns.Count; i++)
                            {
                                sb.Append(ReportService.EscapeCsvValue(row.Cells[i].Value?.ToString() ?? ""));
                                if (i < gridReports.Columns.Count - 1) sb.Append(",");
                            }
                            sb.AppendLine();
                        }
                        csvContent = sb.ToString();
                    }

                    File.WriteAllText(sfd.FileName, csvContent, System.Text.Encoding.UTF8);
                    MessageBox.Show("Report exported successfully to:\n" + sfd.FileName, "Export Complete", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error exporting report: " + ex.Message, "Export Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
