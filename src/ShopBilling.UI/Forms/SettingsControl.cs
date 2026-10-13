using System;
using System.Drawing;
using System.Windows.Forms;
using ShopBilling.Core.Models;
using ShopBilling.Core.Services;

namespace ShopBilling.UI.Forms
{
    public class SettingsControl : UserControl
    {
        private readonly SettingsService _settingsService;

        private TextBox txtStoreName;
        private TextBox txtStoreAddress;
        private TextBox txtStorePhone;
        private TextBox txtStoreEmail;
        private TextBox txtGstNumber;

        private TextBox txtCurrencySymbol;
        private ComboBox cmbReceiptSize;
        private NumericUpDown numDefaultDiscount;
        private ComboBox cmbTaxDisplay;

        private NumericUpDown numLowStockThreshold;
        private ComboBox cmbBarcodeFormat;

        private ComboBox cmbDefaultReportRange;
        private ComboBox cmbStartupScreen;
        private CheckBox chkConfirmDialogs;

        private Button btnSave;

        public SettingsControl(SettingsService settingsService)
        {
            _settingsService = settingsService ?? throw new ArgumentNullException(nameof(settingsService));
            InitializeComponent();
            LoadCurrentSettings();
        }

        private void InitializeComponent()
        {
            this.Dock = DockStyle.Fill;
            this.BackColor = Color.FromArgb(243, 244, 246);
            this.Font = new Font("Segoe UI", 9f);

            var pnlMain = new Panel
            {
                Dock = DockStyle.Fill,
                AutoScroll = true,
                Padding = new Padding(24)
            };

            // Header
            var lblTitle = new Label
            {
                Text = "Application Preferences & Store Configuration",
                Font = new Font("Segoe UI", 15f, FontStyle.Bold),
                ForeColor = Color.FromArgb(24, 43, 73),
                Dock = DockStyle.Top,
                Height = 35
            };

            var lblSubtitle = new Label
            {
                Text = "Manage your retail profile, default hardware print preferences, GST registration, and alert thresholds.",
                Font = new Font("Segoe UI", 9.5f),
                ForeColor = Color.FromArgb(100, 116, 139),
                Dock = DockStyle.Top,
                Height = 28
            };

            // Disclamer banner
            var pnlNotice = new Panel
            {
                Dock = DockStyle.Top,
                Height = 44,
                BackColor = Color.FromArgb(238, 242, 255),
                BorderStyle = BorderStyle.FixedSingle,
                Padding = new Padding(12, 10, 12, 10),
                Margin = new Padding(0, 5, 0, 15)
            };
            var lblNotice = new Label
            {
                Text = "ℹ Notice: Changing business profile or tax settings applies only to future transactions and will NEVER alter finalized invoices.",
                ForeColor = Color.FromArgb(49, 46, 129),
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                Dock = DockStyle.Fill
            };
            pnlNotice.Controls.Add(lblNotice);

            // Container for Settings Groups
            var pnlCards = new FlowLayoutPanel
            {
                Dock = DockStyle.Top,
                AutoSize = true,
                WrapContents = true,
                Margin = new Padding(0, 10, 0, 10)
            };

            // Card 1: Business Profile
            var grpProfile = CreateGroupCard("BUSINESS & STORE PROFILE", 480, 270);
            AddFormRow(grpProfile, "Business Name *:", txtStoreName = new TextBox { Width = 300 }, 35);
            AddFormRow(grpProfile, "Store Address:", txtStoreAddress = new TextBox { Width = 300 }, 75);
            AddFormRow(grpProfile, "Contact Phone:", txtStorePhone = new TextBox { Width = 300 }, 115);
            AddFormRow(grpProfile, "Contact Email:", txtStoreEmail = new TextBox { Width = 300 }, 155);
            AddFormRow(grpProfile, "GSTIN (15 Digits):", txtGstNumber = new TextBox { Width = 300, CharacterCasing = CharacterCasing.Upper }, 195);
            pnlCards.Controls.Add(grpProfile);

            // Card 2: Billing & Print Settings
            var grpBilling = CreateGroupCard("BILLING & PRINT PREFERENCES", 480, 270);
            AddFormRow(grpBilling, "Currency Symbol:", txtCurrencySymbol = new TextBox { Width = 100, Text = "₹" }, 35);
            cmbReceiptSize = new ComboBox { Width = 200, DropDownStyle = ComboBoxStyle.DropDownList };
            cmbReceiptSize.Items.AddRange(new object[] { "80mm Thermal", "A4 Full Page" });
            AddFormRow(grpBilling, "Default Bill Size:", cmbReceiptSize, 75);

            numDefaultDiscount = new NumericUpDown { Width = 100, Minimum = 0, Maximum = 100, DecimalPlaces = 1 };
            AddFormRow(grpBilling, "Default Line Discount %:", numDefaultDiscount, 115);

            cmbTaxDisplay = new ComboBox { Width = 200, DropDownStyle = ComboBoxStyle.DropDownList };
            cmbTaxDisplay.Items.AddRange(new object[] { "Itemized", "SlabSummary" });
            AddFormRow(grpBilling, "Tax Presentation Mode:", cmbTaxDisplay, 155);
            pnlCards.Controls.Add(grpBilling);

            // Card 3: Stock & Barcode Settings
            var grpStock = CreateGroupCard("INVENTORY & BARCODE CONFIGURATION", 480, 190);
            numLowStockThreshold = new NumericUpDown { Width = 100, Minimum = 0, Maximum = 10000, DecimalPlaces = 0, Value = 5 };
            AddFormRow(grpStock, "Low Stock Alert (Units):", numLowStockThreshold, 35);

            cmbBarcodeFormat = new ComboBox { Width = 200, DropDownStyle = ComboBoxStyle.DropDownList };
            cmbBarcodeFormat.Items.AddRange(new object[] { "Code128", "EAN13" });
            AddFormRow(grpStock, "Default Barcode Type:", cmbBarcodeFormat, 75);
            pnlCards.Controls.Add(grpStock);

            // Card 4: Application System Preferences
            var grpApp = CreateGroupCard("APPLICATION & SYSTEM PREFERENCES", 480, 190);
            cmbDefaultReportRange = new ComboBox { Width = 200, DropDownStyle = ComboBoxStyle.DropDownList };
            cmbDefaultReportRange.Items.AddRange(new object[] { "Today", "Last 7 Days", "This Month", "Last 30 Days" });
            AddFormRow(grpApp, "Default Report Range:", cmbDefaultReportRange, 35);

            cmbStartupScreen = new ComboBox { Width = 200, DropDownStyle = ComboBoxStyle.DropDownList };
            cmbStartupScreen.Items.AddRange(new object[] { "Dashboard", "POS", "Products" });
            AddFormRow(grpApp, "Initial Startup Screen:", cmbStartupScreen, 75);

            chkConfirmDialogs = new CheckBox { Text = "Prompt confirmation before critical transactions", Checked = true, AutoSize = true, Location = new Point(20, 125) };
            grpApp.Controls.Add(chkConfirmDialogs);
            pnlCards.Controls.Add(grpApp);

            // Save Button
            var pnlFooter = new Panel
            {
                Dock = DockStyle.Top,
                Height = 60,
                Padding = new Padding(0, 10, 0, 0)
            };

            btnSave = new Button
            {
                Text = "💾 Save Application Settings",
                Font = new Font("Segoe UI", 10.5f, FontStyle.Bold),
                Size = new Size(240, 42),
                BackColor = Color.FromArgb(16, 110, 190),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand,
                Location = new Point(0, 10)
            };
            btnSave.FlatAppearance.BorderSize = 0;
            btnSave.Click += (s, e) => SaveSettings();
            pnlFooter.Controls.Add(btnSave);

            pnlMain.Controls.Add(pnlFooter);
            pnlMain.Controls.Add(pnlCards);
            pnlMain.Controls.Add(pnlNotice);
            pnlMain.Controls.Add(lblSubtitle);
            pnlMain.Controls.Add(lblTitle);

            this.Controls.Add(pnlMain);
        }

        private Panel CreateGroupCard(string title, int width, int height)
        {
            var pnl = new Panel
            {
                Width = width,
                Height = height,
                BackColor = Color.White,
                Margin = new Padding(8),
                Padding = new Padding(16)
            };

            var lbl = new Label
            {
                Text = title,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(71, 85, 105),
                Location = new Point(16, 10),
                AutoSize = true
            };
            pnl.Controls.Add(lbl);
            return pnl;
        }

        private void AddFormRow(Panel parent, string labelText, Control inputControl, int yPos)
        {
            var lbl = new Label
            {
                Text = labelText,
                Font = new Font("Segoe UI", 9f),
                ForeColor = Color.FromArgb(51, 65, 85),
                Location = new Point(16, yPos + 3),
                Size = new Size(160, 20)
            };
            inputControl.Location = new Point(180, yPos);
            parent.Controls.Add(lbl);
            parent.Controls.Add(inputControl);
        }

        public void LoadCurrentSettings()
        {
            try
            {
                var s = _settingsService.GetSettings();

                txtStoreName.Text = s.StoreName;
                txtStoreAddress.Text = s.StoreAddress;
                txtStorePhone.Text = s.StorePhone;
                txtStoreEmail.Text = s.StoreEmail;
                txtGstNumber.Text = s.GstNumber;

                txtCurrencySymbol.Text = s.CurrencySymbol;
                cmbReceiptSize.SelectedItem = s.ReceiptPaperSize;
                numDefaultDiscount.Value = s.DefaultDiscountPercent;
                cmbTaxDisplay.SelectedItem = s.TaxDisplayPreference;

                numLowStockThreshold.Value = s.DefaultLowStockThreshold;
                cmbBarcodeFormat.SelectedItem = s.BarcodeFormat;

                cmbDefaultReportRange.SelectedItem = s.DefaultReportDateRange;
                cmbStartupScreen.SelectedItem = s.StartupScreen;
                chkConfirmDialogs.Checked = s.EnableConfirmDialogs;
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error loading settings: " + ex.Message, "Settings Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void SaveSettings()
        {
            var s = new AppSettings
            {
                StoreName = txtStoreName.Text.Trim(),
                StoreAddress = txtStoreAddress.Text.Trim(),
                StorePhone = txtStorePhone.Text.Trim(),
                StoreEmail = txtStoreEmail.Text.Trim(),
                GstNumber = txtGstNumber.Text.Trim().ToUpper(),
                CurrencySymbol = txtCurrencySymbol.Text.Trim(),
                ReceiptPaperSize = cmbReceiptSize.SelectedItem?.ToString() ?? "80mm Thermal",
                DefaultDiscountPercent = numDefaultDiscount.Value,
                TaxDisplayPreference = cmbTaxDisplay.SelectedItem?.ToString() ?? "Itemized",
                DefaultLowStockThreshold = numLowStockThreshold.Value,
                BarcodeFormat = cmbBarcodeFormat.SelectedItem?.ToString() ?? "Code128",
                DefaultReportDateRange = cmbDefaultReportRange.SelectedItem?.ToString() ?? "Last 7 Days",
                StartupScreen = cmbStartupScreen.SelectedItem?.ToString() ?? "Dashboard",
                EnableConfirmDialogs = chkConfirmDialogs.Checked
            };

            bool saved = _settingsService.SaveSettings(s, out string error);
            if (saved)
            {
                MessageBox.Show("Settings persisted successfully to SQLite database.", "Settings Saved", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            else
            {
                MessageBox.Show("Validation Error: " + error, "Save Failed", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }
    }
}
