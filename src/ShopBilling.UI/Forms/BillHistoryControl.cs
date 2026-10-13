using System;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;
using ShopBilling.Core.Models;
using ShopBilling.Core.Services;
using ShopBilling.UI.Utilities;

namespace ShopBilling.UI.Forms
{
    public class BillHistoryControl : UserControl
    {
        private readonly InvoiceService _invoiceService;

        private TextBox txtSearch;
        private ComboBox cmbStatus;
        private ComboBox cmbPayStatus;
        private DateTimePicker dtpFrom;
        private DateTimePicker dtpTo;
        private Button btnSearch;
        private Button btnReset;
        private DataGridView gridInvoices;

        private int currentPage = 1;
        private int pageSize = 50;
        private PagedResult<InvoiceHeader> lastResult;

        public BillHistoryControl(InvoiceService invoiceService)
        {
            _invoiceService = invoiceService ?? throw new ArgumentNullException(nameof(invoiceService));
            InitializeUI();
            LoadData();
        }

        private void InitializeUI()
        {
            this.BackColor = Color.FromArgb(240, 243, 246);
            this.Font = new Font("Segoe UI", 9f);
            this.Dock = DockStyle.Fill;

            // Top Header
            var pnlTop = new Panel
            {
                Dock = DockStyle.Top,
                Height = 52,
                BackColor = Color.FromArgb(31, 78, 121),
                Padding = new Padding(16, 0, 16, 0)
            };

            var lblHeader = new Label
            {
                Text = "BILL HISTORY & GST SALES INVOICES (F6)",
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 12f, FontStyle.Bold),
                AutoSize = false,
                Size = new Size(500, 52),
                TextAlign = ContentAlignment.MiddleLeft,
                Dock = DockStyle.Left
            };
            pnlTop.Controls.Add(lblHeader);

            // Filter Bar
            var pnlFilter = new Panel
            {
                Dock = DockStyle.Top,
                Height = 48,
                BackColor = Color.White,
                Padding = new Padding(12, 10, 12, 10),
                BorderStyle = BorderStyle.FixedSingle
            };

            var lblS = new Label { Text = "Search:", Location = new Point(12, 13), AutoSize = true, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) };
            txtSearch = new TextBox { Location = new Point(65, 10), Width = 160 };

            var lblSt = new Label { Text = "Status:", Location = new Point(235, 13), AutoSize = true, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) };
            cmbStatus = new ComboBox { Location = new Point(285, 10), Width = 110, DropDownStyle = ComboBoxStyle.DropDownList };
            cmbStatus.Items.AddRange(new object[] { "All", "Confirmed", "Draft", "Cancelled" });
            cmbStatus.SelectedIndex = 0;

            var lblPs = new Label { Text = "Payment:", Location = new Point(405, 13), AutoSize = true, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) };
            cmbPayStatus = new ComboBox { Location = new Point(470, 10), Width = 100, DropDownStyle = ComboBoxStyle.DropDownList };
            cmbPayStatus.Items.AddRange(new object[] { "All", "Paid", "Partial", "Unpaid" });
            cmbPayStatus.SelectedIndex = 0;

            var lblDt = new Label { Text = "From:", Location = new Point(580, 13), AutoSize = true };
            dtpFrom = new DateTimePicker { Location = new Point(620, 10), Width = 115, Format = DateTimePickerFormat.Short, Value = DateTime.Now.AddDays(-30) };

            var lblDt2 = new Label { Text = "To:", Location = new Point(745, 13), AutoSize = true };
            dtpTo = new DateTimePicker { Location = new Point(770, 10), Width = 115, Format = DateTimePickerFormat.Short, Value = DateTime.Now };

            btnSearch = new Button
            {
                Text = "Filter",
                Location = new Point(895, 9),
                Width = 70,
                BackColor = Color.FromArgb(31, 78, 121),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnSearch.Click += (s, e) => { currentPage = 1; LoadData(); };

            btnReset = new Button
            {
                Text = "Reset",
                Location = new Point(970, 9),
                Width = 65,
                BackColor = Color.FromArgb(235, 240, 245),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnReset.Click += (s, e) =>
            {
                txtSearch.Clear();
                cmbStatus.SelectedIndex = 0;
                cmbPayStatus.SelectedIndex = 0;
                dtpFrom.Value = DateTime.Now.AddDays(-30);
                dtpTo.Value = DateTime.Now;
                currentPage = 1;
                LoadData();
            };

            pnlFilter.Controls.Add(lblS);
            pnlFilter.Controls.Add(txtSearch);
            pnlFilter.Controls.Add(lblSt);
            pnlFilter.Controls.Add(cmbStatus);
            pnlFilter.Controls.Add(lblPs);
            pnlFilter.Controls.Add(cmbPayStatus);
            pnlFilter.Controls.Add(lblDt);
            pnlFilter.Controls.Add(dtpFrom);
            pnlFilter.Controls.Add(lblDt2);
            pnlFilter.Controls.Add(dtpTo);
            pnlFilter.Controls.Add(btnSearch);
            pnlFilter.Controls.Add(btnReset);

            // DataGridView Grid
            gridInvoices = new DataGridView
            {
                Dock = DockStyle.Fill,
                BackgroundColor = Color.White,
                BorderStyle = BorderStyle.None,
                AllowUserToAddRows = false,
                RowHeadersVisible = false,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                MultiSelect = false,
                Font = new Font("Segoe UI", 9f),
                RowTemplate = { Height = 28 }
            };
            ConfigureGridColumns();
            gridInvoices.CellContentClick += HandleGridActionClick;

            this.Controls.Add(gridInvoices);
            this.Controls.Add(pnlFilter);
            this.Controls.Add(pnlTop);
        }

        private void ConfigureGridColumns()
        {
            gridInvoices.Columns.Clear();
            gridInvoices.Columns.Add(new DataGridViewTextBoxColumn { Name = "colNum", HeaderText = "Invoice #", Width = 110, ReadOnly = true });
            gridInvoices.Columns.Add(new DataGridViewTextBoxColumn { Name = "colDate", HeaderText = "Date & Time", Width = 135, ReadOnly = true });
            gridInvoices.Columns.Add(new DataGridViewTextBoxColumn { Name = "colCustomer", HeaderText = "Customer", AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill, ReadOnly = true });
            gridInvoices.Columns.Add(new DataGridViewTextBoxColumn { Name = "colMobile", HeaderText = "Mobile", Width = 100, ReadOnly = true });
            gridInvoices.Columns.Add(new DataGridViewTextBoxColumn { Name = "colItems", HeaderText = "Items", Width = 55, ReadOnly = true });
            gridInvoices.Columns.Add(new DataGridViewTextBoxColumn { Name = "colTax", HeaderText = "GST (₹)", Width = 80, ReadOnly = true });
            gridInvoices.Columns.Add(new DataGridViewTextBoxColumn { Name = "colGrand", HeaderText = "Grand Total (₹)", Width = 110, ReadOnly = true });
            gridInvoices.Columns.Add(new DataGridViewTextBoxColumn { Name = "colPaid", HeaderText = "Paid (₹)", Width = 90, ReadOnly = true });
            gridInvoices.Columns.Add(new DataGridViewTextBoxColumn { Name = "colDue", HeaderText = "Due (₹)", Width = 85, ReadOnly = true });
            gridInvoices.Columns.Add(new DataGridViewTextBoxColumn { Name = "colStatus", HeaderText = "Status", Width = 85, ReadOnly = true });
            gridInvoices.Columns.Add(new DataGridViewTextBoxColumn { Name = "colPayStatus", HeaderText = "Payment", Width = 80, ReadOnly = true });

            var btnView = new DataGridViewButtonColumn { Name = "btnView", HeaderText = "", Text = "View", UseColumnTextForButtonValue = true, Width = 55 };
            var btnThermal = new DataGridViewButtonColumn { Name = "btnThermal", HeaderText = "", Text = "Thermal", UseColumnTextForButtonValue = true, Width = 65 };
            var btnA4 = new DataGridViewButtonColumn { Name = "btnA4", HeaderText = "", Text = "A4", UseColumnTextForButtonValue = true, Width = 45 };
            var btnVoid = new DataGridViewButtonColumn { Name = "btnVoid", HeaderText = "", Text = "Cancel", UseColumnTextForButtonValue = true, Width = 60 };

            gridInvoices.Columns.Add(btnView);
            gridInvoices.Columns.Add(btnThermal);
            gridInvoices.Columns.Add(btnA4);
            gridInvoices.Columns.Add(btnVoid);

            gridInvoices.EnableHeadersVisualStyles = false;
            gridInvoices.ColumnHeadersDefaultCellStyle.BackColor = Color.FromArgb(31, 78, 121);
            gridInvoices.ColumnHeadersDefaultCellStyle.ForeColor = Color.White;
            gridInvoices.ColumnHeadersDefaultCellStyle.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            gridInvoices.ColumnHeadersHeight = 32;
        }

        private void LoadData()
        {
            var filter = new InvoiceFilter
            {
                SearchTerm = txtSearch.Text.Trim(),
                Status = cmbStatus.SelectedItem?.ToString() ?? "All",
                PaymentStatus = cmbPayStatus.SelectedItem?.ToString() ?? "All",
                FromDate = dtpFrom.Value.Date,
                ToDate = dtpTo.Value.Date.AddDays(1).AddSeconds(-1),
                PageNumber = currentPage,
                PageSize = pageSize
            };

            lastResult = _invoiceService.SearchInvoices(filter);

            gridInvoices.Rows.Clear();
            if (lastResult?.Items != null)
            {
                foreach (var inv in lastResult.Items)
                {
                    int row = gridInvoices.Rows.Add(
                        inv.InvoiceNumber,
                        inv.InvoiceDate.ToString("dd-MMM-yyyy hh:mm tt"),
                        inv.CustomerName,
                        inv.CustomerMobile ?? "—",
                        inv.TotalItems,
                        inv.TotalTaxAmount.ToString("F2"),
                        inv.GrandTotal.ToString("F2"),
                        inv.AmountPaid.ToString("F2"),
                        inv.BalanceDue.ToString("F2"),
                        inv.Status,
                        inv.PaymentStatus
                    );

                    // Style row based on status
                    if (inv.Status == "Cancelled")
                    {
                        gridInvoices.Rows[row].DefaultCellStyle.ForeColor = Color.Gray;
                    }
                    else if (inv.BalanceDue > 0)
                    {
                        gridInvoices.Rows[row].Cells["colDue"].Style.ForeColor = Color.DarkRed;
                        gridInvoices.Rows[row].Cells["colDue"].Style.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
                    }
                }
            }
        }

        private void HandleGridActionClick(object sender, DataGridViewCellEventArgs e)
        {
            if (e.RowIndex < 0 || lastResult?.Items == null || e.RowIndex >= lastResult.Items.Count) return;

            var inv = lastResult.Items[e.RowIndex];
            string colName = gridInvoices.Columns[e.ColumnIndex].Name;

            if (colName == "btnView")
            {
                var full = _invoiceService.GetById(inv.Id);
                ShowInvoiceDetailsDialog(full ?? inv);
            }
            else if (colName == "btnThermal")
            {
                var full = _invoiceService.GetById(inv.Id);
                InvoicePrintHelper.PrintInvoice(full ?? inv, true);
            }
            else if (colName == "btnA4")
            {
                var full = _invoiceService.GetById(inv.Id);
                InvoicePrintHelper.PrintInvoice(full ?? inv, false);
            }
            else if (colName == "btnVoid")
            {
                if (inv.Status == "Cancelled")
                {
                    MessageBox.Show("This invoice is already cancelled.", "Notice", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }

                using (var prompt = new InputDialog("Cancel / Void Invoice", "Enter Reason for Cancellation (Stock will be safely restored):"))
                {
                    if (prompt.ShowDialog() == DialogResult.OK && !string.IsNullOrWhiteSpace(prompt.InputText))
                    {
                        bool ok = _invoiceService.CancelInvoice(inv.Id, prompt.InputText.Trim(), out string error);
                        if (ok)
                        {
                            MessageBox.Show($"Invoice #{inv.InvoiceNumber} cancelled. Stock restored to inventory.", "Cancelled", MessageBoxButtons.OK, MessageBoxIcon.Information);
                            LoadData();
                        }
                        else
                        {
                            MessageBox.Show($"Failed to cancel invoice: {error}", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        }
                    }
                }
            }
        }

        private void ShowInvoiceDetailsDialog(InvoiceHeader inv)
        {
            using (var dlg = new Form())
            {
                dlg.Text = $"Invoice Details: {inv.InvoiceNumber}";
                dlg.Size = new Size(720, 500);
                dlg.StartPosition = FormStartPosition.CenterParent;
                dlg.Font = new Font("Segoe UI", 9f);
                dlg.BackColor = Color.White;

                var grid = new DataGridView
                {
                    Dock = DockStyle.Fill,
                    BackgroundColor = Color.White,
                    ReadOnly = true,
                    AllowUserToAddRows = false,
                    RowHeadersVisible = false,
                    SelectionMode = DataGridViewSelectionMode.FullRowSelect
                };
                grid.Columns.Add("cItem", "Description");
                grid.Columns.Add("cQty", "Qty");
                grid.Columns.Add("cRate", "Rate (₹)");
                grid.Columns.Add("cDisc", "Disc (₹)");
                grid.Columns.Add("cGst", "GST %");
                grid.Columns.Add("cTaxable", "Taxable (₹)");
                grid.Columns.Add("cTax", "GST (₹)");
                grid.Columns.Add("cTotal", "Total (₹)");

                foreach (var it in inv.Items)
                {
                    grid.Rows.Add(it.ProductName, $"{it.Quantity} {it.Unit}", it.Rate.ToString("F2"), it.DiscountAmount.ToString("F2"), $"{it.TaxRate}%", it.TaxableAmount.ToString("F2"), it.TaxAmount.ToString("F2"), it.LineTotal.ToString("F2"));
                }

                dlg.Controls.Add(grid);
                dlg.ShowDialog(this);
            }
        }

        private class InputDialog : Form
        {
            private TextBox txt;
            public string InputText => txt?.Text;

            public InputDialog(string title, string prompt)
            {
                this.Text = title;
                this.Size = new Size(420, 180);
                this.StartPosition = FormStartPosition.CenterParent;
                this.FormBorderStyle = FormBorderStyle.FixedDialog;
                this.MaximizeBox = false;
                this.MinimizeBox = false;

                var lbl = new Label { Text = prompt, Location = new Point(14, 14), AutoSize = true };
                txt = new TextBox { Location = new Point(14, 40), Width = 370 };

                var btnOk = new Button { Text = "Confirm & Cancel Invoice", DialogResult = DialogResult.OK, Location = new Point(200, 80), Width = 184, BackColor = Color.Maroon, ForeColor = Color.White, FlatStyle = FlatStyle.Flat };
                var btnCancel = new Button { Text = "Dismiss", DialogResult = DialogResult.Cancel, Location = new Point(100, 80), Width = 90 };

                this.Controls.Add(lbl);
                this.Controls.Add(txt);
                this.Controls.Add(btnOk);
                this.Controls.Add(btnCancel);
                this.AcceptButton = btnOk;
                this.CancelButton = btnCancel;
            }
        }
    }
}
