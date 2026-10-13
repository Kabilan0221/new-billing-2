using System;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;
using ShopBilling.Core.Models;
using ShopBilling.Core.Services;

namespace ShopBilling.UI.Forms
{
    public class PaymentManagementControl : UserControl
    {
        private readonly PaymentService _paymentService;
        private readonly InvoiceService _invoiceService;
        private readonly CustomerService _customerService;

        private TextBox txtSearch;
        private ComboBox cmbMethod;
        private ComboBox cmbStatus;
        private DateTimePicker dtpFrom;
        private DateTimePicker dtpTo;
        private Button btnSearch;
        private Button btnReset;
        private Button btnRecordPayment;
        private Button btnReversePayment;

        private DataGridView gridPayments;

        public PaymentManagementControl(
            PaymentService paymentService,
            InvoiceService invoiceService,
            CustomerService customerService)
        {
            _paymentService = paymentService ?? throw new ArgumentNullException(nameof(paymentService));
            _invoiceService = invoiceService;
            _customerService = customerService;

            InitializeUI();
            LoadPayments();
        }

        private void InitializeUI()
        {
            this.Dock = DockStyle.Fill;
            this.BackColor = Color.FromArgb(240, 243, 246);
            this.Font = new Font("Segoe UI", 9f);

            // Header Panel
            var pnlTop = new Panel
            {
                Dock = DockStyle.Top,
                Height = 52,
                BackColor = Color.FromArgb(31, 78, 121),
                Padding = new Padding(16, 0, 16, 0)
            };

            var lblHeader = new Label
            {
                Text = "CUSTOMER PAYMENTS & RECEIPT AUDIT (F5)",
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 12f, FontStyle.Bold),
                Dock = DockStyle.Left,
                AutoSize = false,
                Size = new Size(500, 52),
                TextAlign = ContentAlignment.MiddleLeft
            };
            pnlTop.Controls.Add(lblHeader);

            // Filter Bar
            var pnlFilter = new Panel
            {
                Dock = DockStyle.Top,
                Height = 50,
                BackColor = Color.White,
                Padding = new Padding(12, 10, 12, 10),
                BorderStyle = BorderStyle.FixedSingle
            };

            var lblS = new Label { Text = "Search:", Location = new Point(12, 14), AutoSize = true, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) };
            txtSearch = new TextBox { Location = new Point(65, 11), Width = 160 };

            var lblM = new Label { Text = "Method:", Location = new Point(235, 14), AutoSize = true, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) };
            cmbMethod = new ComboBox { Location = new Point(290, 11), Width = 110, DropDownStyle = ComboBoxStyle.DropDownList };
            cmbMethod.Items.AddRange(new object[] { "All", "Cash", "UPI", "Card", "Bank Transfer", "Cheque" });
            cmbMethod.SelectedIndex = 0;

            var lblSt = new Label { Text = "Status:", Location = new Point(410, 14), AutoSize = true, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) };
            cmbStatus = new ComboBox { Location = new Point(460, 11), Width = 100, DropDownStyle = ComboBoxStyle.DropDownList };
            cmbStatus.Items.AddRange(new object[] { "All", "Active", "Reversed" });
            cmbStatus.SelectedIndex = 1; // Default to Active payments

            var lblFrom = new Label { Text = "From:", Location = new Point(570, 14), AutoSize = true };
            dtpFrom = new DateTimePicker { Location = new Point(610, 11), Width = 110, Format = DateTimePickerFormat.Short, Value = DateTime.Today.AddDays(-30) };

            var lblTo = new Label { Text = "To:", Location = new Point(730, 14), AutoSize = true };
            dtpTo = new DateTimePicker { Location = new Point(755, 11), Width = 110, Format = DateTimePickerFormat.Short, Value = DateTime.Today };

            btnSearch = new Button
            {
                Text = "Filter",
                Location = new Point(875, 10),
                Width = 70,
                Height = 26,
                BackColor = Color.FromArgb(31, 78, 121),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            btnSearch.Click += (s, e) => LoadPayments();

            btnReset = new Button
            {
                Text = "Reset",
                Location = new Point(950, 10),
                Width = 65,
                Height = 26,
                BackColor = Color.FromArgb(230, 235, 240),
                FlatStyle = FlatStyle.Flat
            };
            btnReset.Click += (s, e) =>
            {
                txtSearch.Text = "";
                cmbMethod.SelectedIndex = 0;
                cmbStatus.SelectedIndex = 0;
                dtpFrom.Value = DateTime.Today.AddDays(-30);
                dtpTo.Value = DateTime.Today;
                LoadPayments();
            };

            pnlFilter.Controls.Add(lblS);
            pnlFilter.Controls.Add(txtSearch);
            pnlFilter.Controls.Add(lblM);
            pnlFilter.Controls.Add(cmbMethod);
            pnlFilter.Controls.Add(lblSt);
            pnlFilter.Controls.Add(cmbStatus);
            pnlFilter.Controls.Add(lblFrom);
            pnlFilter.Controls.Add(dtpFrom);
            pnlFilter.Controls.Add(lblTo);
            pnlFilter.Controls.Add(dtpTo);
            pnlFilter.Controls.Add(btnSearch);
            pnlFilter.Controls.Add(btnReset);

            // Action Strip
            var pnlActions = new Panel
            {
                Dock = DockStyle.Top,
                Height = 44,
                BackColor = Color.FromArgb(245, 248, 252),
                Padding = new Padding(12, 6, 12, 6)
            };

            btnRecordPayment = new Button
            {
                Text = "+ Record Payment against Bill",
                Dock = DockStyle.Left,
                Width = 240,
                BackColor = Color.FromArgb(39, 174, 96),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnRecordPayment.Click += BtnRecordPayment_Click;

            btnReversePayment = new Button
            {
                Text = "Reverse Selected Payment",
                Dock = DockStyle.Right,
                Width = 200,
                BackColor = Color.FromArgb(231, 76, 60),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnReversePayment.Click += BtnReversePayment_Click;

            pnlActions.Controls.Add(btnRecordPayment);
            pnlActions.Controls.Add(btnReversePayment);

            // Grid
            gridPayments = new DataGridView
            {
                Dock = DockStyle.Fill,
                BackgroundColor = Color.White,
                ReadOnly = true,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                RowHeadersVisible = false,
                AllowUserToAddRows = false,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill
            };

            this.Controls.Add(gridPayments);
            this.Controls.Add(pnlActions);
            this.Controls.Add(pnlFilter);
            this.Controls.Add(pnlTop);
        }

        private void LoadPayments()
        {
            var filter = new PaymentFilter
            {
                SearchTerm = txtSearch.Text,
                PaymentMethod = cmbMethod.SelectedItem?.ToString(),
                Status = cmbStatus.SelectedItem?.ToString(),
                FromDate = dtpFrom.Value.Date,
                ToDate = dtpTo.Value.Date.AddDays(1).AddSeconds(-1),
                PageNumber = 1,
                PageSize = 100
            };

            var paged = _paymentService.Search(filter);
            gridPayments.DataSource = paged.Items.Select(p => new
            {
                p.Id,
                PaymentNumber = p.PaymentNumber,
                Date = p.CreatedAt.ToString("dd-MMM-yyyy hh:mm tt"),
                InvoiceNumber = p.InvoiceNumber ?? "—",
                Customer = p.CustomerName,
                Method = p.PaymentMethod,
                Amount = $"₹{p.Amount:F2}",
                Status = p.IsReversed ? "REVERSED" : "Active",
                Reference = p.ReferenceNumber ?? "—",
                ReversalReason = p.ReversalReason ?? "—"
            }).ToList();
        }

        private void BtnRecordPayment_Click(object sender, EventArgs e)
        {
            if (_invoiceService == null) return;

            // Fetch unpaid or partial invoices
            var unpaid = _invoiceService.SearchInvoices(new InvoiceFilter { PaymentStatus = "Partial", PageSize = 100 }).Items.ToList();
            unpaid.AddRange(_invoiceService.SearchInvoices(new InvoiceFilter { PaymentStatus = "Unpaid", PageSize = 100 }).Items);

            if (unpaid.Count == 0)
            {
                MessageBox.Show("There are no invoices with pending balances due at this time.", "All Bills Paid", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            using (var dlg = new Form())
            {
                dlg.Text = "Record Customer Payment Against Invoice";
                dlg.Size = new Size(480, 360);
                dlg.StartPosition = FormStartPosition.CenterParent;
                dlg.FormBorderStyle = FormBorderStyle.FixedDialog;
                dlg.MaximizeBox = false;
                dlg.MinimizeBox = false;

                var lblInv = new Label { Text = "Select Invoice with Balance Due:", Location = new Point(20, 20), AutoSize = true, Font = new Font("Segoe UI", 9f, FontStyle.Bold) };
                var cmbInvoices = new ComboBox { Location = new Point(20, 42), Width = 420, DropDownStyle = ComboBoxStyle.DropDownList };
                foreach (var inv in unpaid)
                {
                    cmbInvoices.Items.Add($"[{inv.InvoiceNumber}] - {inv.CustomerName} - Bal Due: ₹{inv.BalanceDue:F2} (Total: ₹{inv.GrandTotal:F2})");
                }
                cmbInvoices.SelectedIndex = 0;

                var lblAmt = new Label { Text = "Amount Received (₹):", Location = new Point(20, 80), AutoSize = true, Font = new Font("Segoe UI", 9f, FontStyle.Bold) };
                var numAmt = new NumericUpDown { Location = new Point(20, 102), Width = 180, DecimalPlaces = 2, Maximum = 10000000, Value = unpaid[0].BalanceDue };

                cmbInvoices.SelectedIndexChanged += (s2, e2) =>
                {
                    int sel = cmbInvoices.SelectedIndex;
                    if (sel >= 0 && sel < unpaid.Count)
                    {
                        numAmt.Value = unpaid[sel].BalanceDue;
                    }
                };

                var lblMethod = new Label { Text = "Payment Method:", Location = new Point(220, 80), AutoSize = true, Font = new Font("Segoe UI", 9f, FontStyle.Bold) };
                var cmbM = new ComboBox { Location = new Point(220, 102), Width = 220, DropDownStyle = ComboBoxStyle.DropDownList };
                cmbM.Items.AddRange(new object[] { "Cash", "UPI", "Card", "Bank Transfer", "Cheque" });
                cmbM.SelectedIndex = 0;

                var lblRef = new Label { Text = "Reference / Transaction ID:", Location = new Point(20, 140), AutoSize = true };
                var txtRef = new TextBox { Location = new Point(20, 160), Width = 420 };

                var lblNotes = new Label { Text = "Notes:", Location = new Point(20, 195), AutoSize = true };
                var txtNotes = new TextBox { Location = new Point(20, 215), Width = 420 };

                var btnConfirm = new Button
                {
                    Text = "Post Payment Transaction",
                    Location = new Point(140, 265),
                    Size = new Size(200, 36),
                    BackColor = Color.FromArgb(39, 174, 96),
                    ForeColor = Color.White,
                    FlatStyle = FlatStyle.Flat,
                    Font = new Font("Segoe UI", 9.5f, FontStyle.Bold)
                };

                btnConfirm.Click += (s2, e2) =>
                {
                    int sel = cmbInvoices.SelectedIndex;
                    if (sel < 0 || sel >= unpaid.Count) return;

                    var chosenInv = unpaid[sel];
                    decimal payAmt = numAmt.Value;

                    if (payAmt <= 0)
                    {
                        MessageBox.Show("Payment amount must be greater than zero.", "Invalid Amount", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                        return;
                    }

                    if (payAmt > chosenInv.BalanceDue)
                    {
                        MessageBox.Show($"Payment amount cannot exceed the balance due of ₹{chosenInv.BalanceDue:F2}.", "Overpayment Blocked", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                        return;
                    }

                    bool ok = _paymentService.RecordPayment(chosenInv.Id, cmbM.SelectedItem.ToString(), payAmt, txtRef.Text.Trim(), txtNotes.Text.Trim(), out string err);
                    if (ok)
                    {
                        MessageBox.Show($"Payment of ₹{payAmt:F2} successfully recorded and credited to customer ledger!", "Payment Posted", MessageBoxButtons.OK, MessageBoxIcon.Information);
                        dlg.DialogResult = DialogResult.OK;
                        dlg.Close();
                    }
                    else
                    {
                        MessageBox.Show(err, "Payment Failed", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    }
                };

                dlg.Controls.Add(lblInv);
                dlg.Controls.Add(cmbInvoices);
                dlg.Controls.Add(lblAmt);
                dlg.Controls.Add(numAmt);
                dlg.Controls.Add(lblMethod);
                dlg.Controls.Add(cmbM);
                dlg.Controls.Add(lblRef);
                dlg.Controls.Add(txtRef);
                dlg.Controls.Add(lblNotes);
                dlg.Controls.Add(txtNotes);
                dlg.Controls.Add(btnConfirm);

                if (dlg.ShowDialog(this) == DialogResult.OK)
                {
                    LoadPayments();
                }
            }
        }

        private void BtnReversePayment_Click(object sender, EventArgs e)
        {
            if (gridPayments.CurrentRow == null)
            {
                MessageBox.Show("Please select a payment record to reverse.", "Notice", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            long id = Convert.ToInt64(gridPayments.CurrentRow.Cells["Id"].Value);
            var payment = _paymentService.GetById(id);
            if (payment == null) return;

            if (payment.IsReversed)
            {
                MessageBox.Show($"Payment #{payment.PaymentNumber} is already reversed on {payment.ReversedAt:dd-MMM-yyyy}. It cannot be reversed again.", "Already Reversed", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            using (var dlg = new Form())
            {
                dlg.Text = $"Confirm Payment Reversal - #{payment.PaymentNumber}";
                dlg.Size = new Size(440, 240);
                dlg.StartPosition = FormStartPosition.CenterParent;
                dlg.FormBorderStyle = FormBorderStyle.FixedDialog;

                var lblInfo = new Label
                {
                    Text = $"Are you sure you want to REVERSE payment #{payment.PaymentNumber} for ₹{payment.Amount:F2}?\nThis will restore the invoice balance due and debit the customer ledger.",
                    Location = new Point(20, 16),
                    Size = new Size(390, 48),
                    Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                    ForeColor = Color.FromArgb(192, 57, 43)
                };

                var lblReason = new Label { Text = "Mandatory Reversal Reason:", Location = new Point(20, 72), AutoSize = true, Font = new Font("Segoe UI", 9f, FontStyle.Bold) };
                var txtReason = new TextBox { Location = new Point(20, 94), Width = 380 };

                var btnConfirm = new Button
                {
                    Text = "Confirm Reversal",
                    Location = new Point(140, 140),
                    Size = new Size(150, 32),
                    BackColor = Color.FromArgb(231, 76, 60),
                    ForeColor = Color.White,
                    FlatStyle = FlatStyle.Flat,
                    Font = new Font("Segoe UI", 9f, FontStyle.Bold)
                };

                btnConfirm.Click += (s2, e2) =>
                {
                    if (string.IsNullOrWhiteSpace(txtReason.Text))
                    {
                        MessageBox.Show("Please provide a valid reason for reversing this payment.", "Reason Required", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                        return;
                    }

                    bool ok = _paymentService.ReversePayment(payment.Id, txtReason.Text.Trim(), out string err);
                    if (ok)
                    {
                        MessageBox.Show($"Payment #{payment.PaymentNumber} has been reversed. Invoice and customer balance restored.", "Reversed", MessageBoxButtons.OK, MessageBoxIcon.Information);
                        dlg.DialogResult = DialogResult.OK;
                        dlg.Close();
                    }
                    else
                    {
                        MessageBox.Show(err, "Reversal Failed", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    }
                };

                dlg.Controls.Add(lblInfo);
                dlg.Controls.Add(lblReason);
                dlg.Controls.Add(txtReason);
                dlg.Controls.Add(btnConfirm);

                if (dlg.ShowDialog(this) == DialogResult.OK)
                {
                    LoadPayments();
                }
            }
        }
    }
}
