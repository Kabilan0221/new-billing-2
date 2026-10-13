using System;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;
using ShopBilling.Core.Models;
using ShopBilling.Core.Services;

namespace ShopBilling.UI.Forms
{
    public class CustomerManagementControl : UserControl
    {
        private readonly CustomerService _customerService;
        private readonly InvoiceService _invoiceService;

        // UI Controls - Split Container
        private SplitContainer splitMain;

        // Left Panel - Search & Customer List
        private TextBox txtSearch;
        private Button btnSearch;
        private Button btnNewCustomer;
        private DataGridView gridCustomers;

        // Right Panel - Tabs
        private TabControl tabCustomerDetails;
        private TabPage tabProfile;
        private TabPage tabPurchases;
        private TabPage tabPayments;
        private TabPage tabLedger;

        // Profile Form Inputs
        private TextBox txtCode;
        private TextBox txtName;
        private TextBox txtMobile;
        private TextBox txtEmail;
        private TextBox txtGstin;
        private TextBox txtAddress;
        private TextBox txtCity;
        private TextBox txtState;
        private TextBox txtStateCode;
        private Label lblCurrentBalance;
        private Button btnSaveCustomer;
        private Button btnDeactivateCustomer;

        // Purchase History Grid
        private DataGridView gridPurchases;

        // Payment History Grid
        private DataGridView gridPayments;

        // Customer Ledger Tab
        private DateTimePicker dtpLedgerFrom;
        private DateTimePicker dtpLedgerTo;
        private Button btnLoadLedger;
        private Label lblLedgerOpeningBal;
        private Label lblLedgerDebits;
        private Label lblLedgerCredits;
        private Label lblLedgerClosingBal;
        private DataGridView gridLedger;

        private Customer _selectedCustomer;

        public event Action<Customer> OnCustomerSelectedForPOS;

        public CustomerManagementControl(CustomerService customerService, InvoiceService invoiceService)
        {
            _customerService = customerService ?? throw new ArgumentNullException(nameof(customerService));
            _invoiceService = invoiceService;

            InitializeUI();
            LoadCustomers();
        }

        private void InitializeUI()
        {
            this.Dock = DockStyle.Fill;
            this.BackColor = Color.FromArgb(240, 243, 246);
            this.Font = new Font("Segoe UI", 9f);

            // Top Header Panel
            var pnlTop = new Panel
            {
                Dock = DockStyle.Top,
                Height = 52,
                BackColor = Color.FromArgb(31, 78, 121),
                Padding = new Padding(16, 0, 16, 0)
            };

            var lblHeader = new Label
            {
                Text = "CUSTOMER MANAGEMENT & FINANCIAL LEDGER (F7)",
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 12f, FontStyle.Bold),
                Dock = DockStyle.Left,
                AutoSize = false,
                Size = new Size(500, 52),
                TextAlign = ContentAlignment.MiddleLeft
            };
            pnlTop.Controls.Add(lblHeader);

            // Main Split Container
            splitMain = new SplitContainer
            {
                Dock = DockStyle.Fill,
                Orientation = Orientation.Vertical,
                SplitterDistance = 460,
                SplitterWidth = 5
            };

            // LEFT PANEL: Search and Customer List
            var pnlLeft = splitMain.Panel1;
            pnlLeft.Padding = new Padding(8);

            var pnlSearch = new Panel { Dock = DockStyle.Top, Height = 42, Padding = new Padding(0, 0, 0, 8) };
            txtSearch = new TextBox { Location = new Point(0, 8), Width = 240, Height = 26 };
            txtSearch.KeyDown += (s, e) => { if (e.KeyCode == Keys.Enter) LoadCustomers(); };

            btnSearch = new Button
            {
                Text = "Search",
                Location = new Point(246, 7),
                Width = 75,
                Height = 28,
                BackColor = Color.FromArgb(41, 128, 185),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            btnSearch.Click += (s, e) => LoadCustomers();

            btnNewCustomer = new Button
            {
                Text = "+ Add (F7)",
                Location = new Point(326, 7),
                Width = 100,
                Height = 28,
                BackColor = Color.FromArgb(39, 174, 96),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold)
            };
            btnNewCustomer.Click += (s, e) => StartNewCustomer();

            pnlSearch.Controls.Add(txtSearch);
            pnlSearch.Controls.Add(btnSearch);
            pnlSearch.Controls.Add(btnNewCustomer);

            gridCustomers = new DataGridView
            {
                Dock = DockStyle.Fill,
                BackgroundColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
                ReadOnly = true,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                MultiSelect = false,
                AllowUserToAddRows = false,
                RowHeadersVisible = false,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill
            };
            gridCustomers.SelectionChanged += GridCustomers_SelectionChanged;

            pnlLeft.Controls.Add(gridCustomers);
            pnlLeft.Controls.Add(pnlSearch);

            // RIGHT PANEL: Tabs for Profile, Invoices, Payments, Ledger
            var pnlRight = splitMain.Panel2;
            pnlRight.Padding = new Padding(8);

            tabCustomerDetails = new TabControl { Dock = DockStyle.Fill };

            // 1. Profile Tab
            tabProfile = new TabPage("Customer Profile");
            tabProfile.BackColor = Color.White;
            tabProfile.Padding = new Padding(16);
            BuildProfileForm(tabProfile);
            tabCustomerDetails.TabPages.Add(tabProfile);

            // 2. Purchases Tab
            tabPurchases = new TabPage("Sales History");
            tabPurchases.BackColor = Color.White;
            gridPurchases = new DataGridView
            {
                Dock = DockStyle.Fill,
                BackgroundColor = Color.White,
                ReadOnly = true,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                RowHeadersVisible = false,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill
            };
            tabPurchases.Controls.Add(gridPurchases);
            tabCustomerDetails.TabPages.Add(tabPurchases);

            // 3. Payments Tab
            tabPayments = new TabPage("Payment Receipts");
            tabPayments.BackColor = Color.White;
            gridPayments = new DataGridView
            {
                Dock = DockStyle.Fill,
                BackgroundColor = Color.White,
                ReadOnly = true,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                RowHeadersVisible = false,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill
            };
            tabPayments.Controls.Add(gridPayments);
            tabCustomerDetails.TabPages.Add(tabPayments);

            // 4. Ledger Statement Tab
            tabLedger = new TabPage("Financial Ledger");
            tabLedger.BackColor = Color.White;
            BuildLedgerTab(tabLedger);
            tabCustomerDetails.TabPages.Add(tabLedger);

            pnlRight.Controls.Add(tabCustomerDetails);

            this.Controls.Add(splitMain);
            this.Controls.Add(pnlTop);
        }

        private void BuildProfileForm(TabPage page)
        {
            var pnl = new Panel { Dock = DockStyle.Fill, AutoScroll = true };

            int y = 10;
            txtCode = AddField(pnl, "Customer Code:", ref y);
            txtCode.ReadOnly = true;

            txtName = AddField(pnl, "Customer Name *:", ref y);
            txtMobile = AddField(pnl, "Mobile Number:", ref y);
            txtEmail = AddField(pnl, "Email Address:", ref y);
            txtGstin = AddField(pnl, "GSTIN Number:", ref y);
            txtAddress = AddField(pnl, "Address:", ref y);
            txtCity = AddField(pnl, "City:", ref y);
            txtState = AddField(pnl, "State:", ref y);
            txtStateCode = AddField(pnl, "State Code:", ref y);

            var lblBalTitle = new Label { Text = "Outstanding Balance:", Location = new Point(20, y), AutoSize = true, Font = new Font("Segoe UI", 9f, FontStyle.Bold) };
            lblCurrentBalance = new Label { Text = "₹0.00", Location = new Point(160, y), AutoSize = true, Font = new Font("Segoe UI", 12f, FontStyle.Bold), ForeColor = Color.FromArgb(192, 57, 43) };
            pnl.Controls.Add(lblBalTitle);
            pnl.Controls.Add(lblCurrentBalance);
            y += 40;

            btnSaveCustomer = new Button
            {
                Text = "Save Customer Details",
                Location = new Point(160, y),
                Size = new Size(180, 34),
                BackColor = Color.FromArgb(41, 128, 185),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold)
            };
            btnSaveCustomer.Click += BtnSaveCustomer_Click;
            pnl.Controls.Add(btnSaveCustomer);

            btnDeactivateCustomer = new Button
            {
                Text = "Archive Customer",
                Location = new Point(350, y),
                Size = new Size(140, 34),
                BackColor = Color.FromArgb(231, 76, 60),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            btnDeactivateCustomer.Click += BtnDeactivateCustomer_Click;
            pnl.Controls.Add(btnDeactivateCustomer);

            page.Controls.Add(pnl);
        }

        private TextBox AddField(Panel pnl, string label, ref int y)
        {
            var lbl = new Label { Text = label, Location = new Point(20, y + 4), AutoSize = true, Font = new Font("Segoe UI", 9f, FontStyle.Bold) };
            var txt = new TextBox { Location = new Point(160, y), Width = 300 };
            pnl.Controls.Add(lbl);
            pnl.Controls.Add(txt);
            y += 32;
            return txt;
        }

        private void BuildLedgerTab(TabPage page)
        {
            var pnlTop = new Panel { Dock = DockStyle.Top, Height = 75, BackColor = Color.FromArgb(245, 248, 250), Padding = new Padding(10) };

            var lblConv = new Label
            {
                Text = "Ledger Convention: Debits increase receivable (Invoices); Credits decrease receivable (Payments received).",
                Location = new Point(10, 6),
                AutoSize = true,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Italic),
                ForeColor = Color.FromArgb(80, 90, 100)
            };

            var lblF = new Label { Text = "From:", Location = new Point(10, 35), AutoSize = true };
            dtpLedgerFrom = new DateTimePicker { Location = new Point(50, 32), Width = 115, Format = DateTimePickerFormat.Short, Value = DateTime.Today.AddDays(-60) };

            var lblT = new Label { Text = "To:", Location = new Point(175, 35), AutoSize = true };
            dtpLedgerTo = new DateTimePicker { Location = new Point(205, 32), Width = 115, Format = DateTimePickerFormat.Short, Value = DateTime.Today };

            btnLoadLedger = new Button
            {
                Text = "Calculate Statement",
                Location = new Point(335, 30),
                Size = new Size(140, 28),
                BackColor = Color.FromArgb(31, 78, 121),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            btnLoadLedger.Click += (s, e) => LoadCustomerLedgerStatement();

            pnlTop.Controls.Add(lblConv);
            pnlTop.Controls.Add(lblF);
            pnlTop.Controls.Add(dtpLedgerFrom);
            pnlTop.Controls.Add(lblT);
            pnlTop.Controls.Add(dtpLedgerTo);
            pnlTop.Controls.Add(btnLoadLedger);

            // Statement summary strip
            var pnlSummary = new Panel { Dock = DockStyle.Top, Height = 36, BackColor = Color.FromArgb(230, 238, 248), Padding = new Padding(10, 8, 10, 8) };
            lblLedgerOpeningBal = new Label { Text = "Opening: ₹0.00", Location = new Point(10, 10), AutoSize = true, Font = new Font("Segoe UI", 9f, FontStyle.Bold) };
            lblLedgerDebits = new Label { Text = "Billed (Debits): ₹0.00", Location = new Point(160, 10), AutoSize = true, Font = new Font("Segoe UI", 9f, FontStyle.Bold) };
            lblLedgerCredits = new Label { Text = "Paid (Credits): ₹0.00", Location = new Point(340, 10), AutoSize = true, Font = new Font("Segoe UI", 9f, FontStyle.Bold), ForeColor = Color.FromArgb(39, 174, 96) };
            lblLedgerClosingBal = new Label { Text = "Closing Balance: ₹0.00", Location = new Point(520, 10), AutoSize = true, Font = new Font("Segoe UI", 9f, FontStyle.Bold), ForeColor = Color.FromArgb(192, 57, 43) };

            pnlSummary.Controls.Add(lblLedgerOpeningBal);
            pnlSummary.Controls.Add(lblLedgerDebits);
            pnlSummary.Controls.Add(lblLedgerCredits);
            pnlSummary.Controls.Add(lblLedgerClosingBal);

            gridLedger = new DataGridView
            {
                Dock = DockStyle.Fill,
                BackgroundColor = Color.White,
                ReadOnly = true,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                RowHeadersVisible = false,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill
            };

            page.Controls.Add(gridLedger);
            page.Controls.Add(pnlSummary);
            page.Controls.Add(pnlTop);
        }

        private void LoadCustomers()
        {
            var paged = _customerService.Search(txtSearch.Text, 1, 100);
            gridCustomers.DataSource = paged.Items.Select(c => new
            {
                c.Id,
                Code = c.Code,
                Name = c.Name,
                Mobile = c.Mobile,
                Balance = $"₹{c.CurrentBalance:F2}",
                Active = c.IsActive ? "Yes" : "No"
            }).ToList();
        }

        private void GridCustomers_SelectionChanged(object sender, EventArgs e)
        {
            if (gridCustomers.CurrentRow == null) return;
            long id = Convert.ToInt64(gridCustomers.CurrentRow.Cells["Id"].Value);
            _selectedCustomer = _customerService.GetById(id);
            if (_selectedCustomer != null)
            {
                DisplayCustomerDetails(_selectedCustomer);
            }
        }

        private void DisplayCustomerDetails(Customer c)
        {
            txtCode.Text = c.Code;
            txtName.Text = c.Name;
            txtMobile.Text = c.Mobile;
            txtEmail.Text = c.Email;
            txtGstin.Text = c.Gstin;
            txtAddress.Text = c.Address;
            txtCity.Text = c.City;
            txtState.Text = c.State;
            txtStateCode.Text = c.StateCode;
            lblCurrentBalance.Text = $"₹{c.CurrentBalance:F2}";

            btnDeactivateCustomer.Enabled = (c.Id > 1);

            // Load Sales
            var purchases = _customerService.GetCustomerPurchases(c.Id).ToList();
            gridPurchases.DataSource = purchases.Select(p => new
            {
                InvoiceNumber = p.InvoiceNumber,
                Date = p.InvoiceDate.ToString("dd-MMM-yyyy hh:mm tt"),
                Total = $"₹{p.GrandTotal:F2}",
                Paid = $"₹{p.AmountPaid:F2}",
                Due = $"₹{p.BalanceDue:F2}",
                Status = p.Status,
                Payment = p.PaymentStatus
            }).ToList();

            // Load Payments
            var payments = _customerService.GetCustomerPayments(c.Id).ToList();
            gridPayments.DataSource = payments.Select(pm => new
            {
                PaymentNumber = pm.PaymentNumber,
                Date = pm.CreatedAt.ToString("dd-MMM-yyyy hh:mm tt"),
                Invoice = pm.InvoiceNumber,
                Method = pm.PaymentMethod,
                Amount = $"₹{pm.Amount:F2}",
                Reversed = pm.IsReversed ? "REVERSED" : "Valid",
                Ref = pm.ReferenceNumber
            }).ToList();

            // Auto-load ledger
            LoadCustomerLedgerStatement();
        }

        private void StartNewCustomer()
        {
            _selectedCustomer = new Customer
            {
                Code = $"CUST-{DateTime.Now:yyyyMMddHHmmss}",
                City = "Chennai",
                State = "Tamil Nadu",
                StateCode = "33"
            };
            DisplayCustomerDetails(_selectedCustomer);
            txtName.Focus();
        }

        private void BtnSaveCustomer_Click(object sender, EventArgs e)
        {
            if (_selectedCustomer == null) return;

            _selectedCustomer.Name = txtName.Text.Trim();
            _selectedCustomer.Mobile = txtMobile.Text.Trim();
            _selectedCustomer.Email = txtEmail.Text.Trim();
            _selectedCustomer.Gstin = txtGstin.Text.Trim().ToUpper();
            _selectedCustomer.Address = txtAddress.Text.Trim();
            _selectedCustomer.City = txtCity.Text.Trim();
            _selectedCustomer.State = txtState.Text.Trim();
            _selectedCustomer.StateCode = txtStateCode.Text.Trim();

            var res = _customerService.SaveCustomer(_selectedCustomer, out var warnings);
            if (!res.IsValid)
            {
                MessageBox.Show(string.Join("\n", res.Errors), "Validation Error", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            if (warnings != null && warnings.Count > 0)
            {
                MessageBox.Show("Warning: " + string.Join("\n", warnings), "Notice", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }

            MessageBox.Show("Customer details saved successfully.", "Success", MessageBoxButtons.OK, MessageBoxIcon.Information);
            LoadCustomers();
        }

        private void BtnDeactivateCustomer_Click(object sender, EventArgs e)
        {
            if (_selectedCustomer == null || _selectedCustomer.Id <= 1) return;

            var confirm = MessageBox.Show($"Are you sure you want to archive customer '{_selectedCustomer.Name}'?", "Confirm Archive", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
            if (confirm == DialogResult.Yes)
            {
                if (_customerService.DeactivateCustomer(_selectedCustomer.Id, out string err))
                {
                    MessageBox.Show("Customer archived successfully.", "Success", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    LoadCustomers();
                }
                else
                {
                    MessageBox.Show(err, "Cannot Archive", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
            }
        }

        private void LoadCustomerLedgerStatement()
        {
            if (_selectedCustomer == null || _selectedCustomer.Id <= 0) return;

            var statement = _customerService.GetCustomerStatement(_selectedCustomer.Id, dtpLedgerFrom.Value.Date, dtpLedgerTo.Value.Date.AddDays(1).AddSeconds(-1));
            if (statement != null)
            {
                lblLedgerOpeningBal.Text = $"Opening: ₹{statement.OpeningBalance:F2}";
                lblLedgerDebits.Text = $"Billed (Debits): ₹{statement.TotalPeriodDebits:F2}";
                lblLedgerCredits.Text = $"Paid (Credits): ₹{statement.TotalPeriodCredits:F2}";
                lblLedgerClosingBal.Text = $"Closing Balance: ₹{statement.ClosingBalance:F2}";

                gridLedger.DataSource = statement.Entries.Select(en => new
                {
                    Date = en.TransactionDate.ToString("dd-MMM-yyyy"),
                    Type = en.TransactionType,
                    Reference = en.ReferenceId,
                    Debit_Billed = en.Debit > 0 ? $"₹{en.Debit:F2}" : "-",
                    Credit_Paid = en.Credit > 0 ? $"₹{en.Credit:F2}" : "-",
                    RunningBalance = $"₹{en.BalanceAfter:F2}",
                    Notes = en.Notes
                }).ToList();
            }
        }
    }
}
