using System;
using System.Drawing;
using System.Windows.Forms;
using ShopBilling.Core.Models;
using ShopBilling.Core.Services;

namespace ShopBilling.UI.Forms
{
    public class DashboardControl : UserControl
    {
        private readonly DashboardService _dashboardService;

        // Navigation callbacks to MainForm
        public event Action<int> OnNavigate;

        private FlowLayoutPanel pnlCards;
        private Label lblTodaySalesVal;
        private Label lblTodayBillsVal;
        private Label lblTodayPurchasesVal;
        private Label lblTotalProductsVal;
        private Label lblLowStockVal;
        private Label lblOutOfStockVal;
        private Label lblTotalCustomersVal;
        private Label lblOutstandingVal;
        private Label lblPaymentsReceivedVal;
        private Button btnRefresh;

        public DashboardControl(DashboardService dashboardService)
        {
            _dashboardService = dashboardService ?? throw new ArgumentNullException(nameof(dashboardService));
            InitializeComponent();
            LoadDashboardData();
        }

        private void InitializeComponent()
        {
            this.Dock = DockStyle.Fill;
            this.BackColor = Color.FromArgb(240, 242, 245);
            this.Font = new Font("Segoe UI", 9f);

            var pnlMain = new Panel
            {
                Dock = DockStyle.Fill,
                AutoScroll = true,
                Padding = new Padding(20)
            };

            // Top Header Bar
            var pnlHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 60,
                Padding = new Padding(0, 0, 0, 10)
            };

            var lblTitle = new Label
            {
                Text = "Store Overview & Executive Dashboard",
                Font = new Font("Segoe UI", 16f, FontStyle.Bold),
                ForeColor = Color.FromArgb(24, 43, 73),
                AutoSize = true,
                Location = new Point(0, 5)
            };

            var lblSubtitle = new Label
            {
                Text = "Real-time metrics calculated from active SQLite transactions (Zero sample data)",
                Font = new Font("Segoe UI", 9.5f),
                ForeColor = Color.FromArgb(100, 116, 139),
                AutoSize = true,
                Location = new Point(0, 34)
            };

            btnRefresh = new Button
            {
                Text = "↻ Refresh Data",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Size = new Size(130, 36),
                BackColor = Color.FromArgb(16, 110, 190),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand,
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Location = new Point(pnlHeader.Width - 130, 10)
            };
            btnRefresh.FlatAppearance.BorderSize = 0;
            btnRefresh.Click += (s, e) => LoadDashboardData();

            pnlHeader.Controls.Add(lblTitle);
            pnlHeader.Controls.Add(lblSubtitle);
            pnlHeader.Controls.Add(btnRefresh);

            // Flow Panel for 9 Summary Cards
            pnlCards = new FlowLayoutPanel
            {
                Dock = DockStyle.Top,
                Height = 230,
                AutoSize = false,
                WrapContents = true,
                Margin = new Padding(0, 10, 0, 10)
            };

            // Add 9 Summary Cards
            pnlCards.Controls.Add(CreateCard("TODAY'S SALES", "₹0.00", Color.FromArgb(16, 110, 190), out lblTodaySalesVal));
            pnlCards.Controls.Add(CreateCard("TODAY'S BILLS", "0", Color.FromArgb(30, 136, 229), out lblTodayBillsVal));
            pnlCards.Controls.Add(CreateCard("TODAY'S PURCHASES", "₹0.00", Color.FromArgb(142, 36, 170), out lblTodayPurchasesVal));
            pnlCards.Controls.Add(CreateCard("TOTAL PRODUCTS", "0", Color.FromArgb(0, 137, 123), out lblTotalProductsVal));
            pnlCards.Controls.Add(CreateCard("LOW STOCK ITEMS", "0", Color.FromArgb(245, 124, 0), out lblLowStockVal));
            pnlCards.Controls.Add(CreateCard("OUT OF STOCK", "0", Color.FromArgb(211, 47, 47), out lblOutOfStockVal));
            pnlCards.Controls.Add(CreateCard("TOTAL CUSTOMERS", "0", Color.FromArgb(57, 73, 171), out lblTotalCustomersVal));
            pnlCards.Controls.Add(CreateCard("OUTSTANDING BALANCE", "₹0.00", Color.FromArgb(194, 24, 91), out lblOutstandingVal));
            pnlCards.Controls.Add(CreateCard("PAYMENTS TODAY", "₹0.00", Color.FromArgb(46, 125, 50), out lblPaymentsReceivedVal));

            // Quick Actions Panel
            var pnlQuickActions = new Panel
            {
                Dock = DockStyle.Top,
                Height = 85,
                Margin = new Padding(0, 15, 0, 15),
                BackColor = Color.White,
                Padding = new Padding(12)
            };

            var lblQuickTitle = new Label
            {
                Text = "KEYBOARD SHORTCUTS & QUICK NAVIGATION:",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(71, 85, 105),
                Location = new Point(12, 10),
                AutoSize = true
            };
            pnlQuickActions.Controls.Add(lblQuickTitle);

            var flowShortcuts = new FlowLayoutPanel
            {
                Location = new Point(12, 32),
                Size = new Size(1100, 45),
                WrapContents = false
            };

            flowShortcuts.Controls.Add(CreateShortcutButton("F1: POS Billing", 1));
            flowShortcuts.Controls.Add(CreateShortcutButton("F2: Products", 2));
            flowShortcuts.Controls.Add(CreateShortcutButton("F3: Inbound", 3));
            flowShortcuts.Controls.Add(CreateShortcutButton("F4: Barcode", 4));
            flowShortcuts.Controls.Add(CreateShortcutButton("F5: Payments", 5));
            flowShortcuts.Controls.Add(CreateShortcutButton("F6: Bill History", 6));
            flowShortcuts.Controls.Add(CreateShortcutButton("F7: Customers", 7));
            flowShortcuts.Controls.Add(CreateShortcutButton("Suppliers", 8));
            flowShortcuts.Controls.Add(CreateShortcutButton("F8: Stock", 9));
            flowShortcuts.Controls.Add(CreateShortcutButton("F9: Estimates", 10));
            flowShortcuts.Controls.Add(CreateShortcutButton("F10: Reports", 11));

            pnlQuickActions.Controls.Add(flowShortcuts);

            pnlMain.Controls.Add(pnlQuickActions);
            pnlMain.Controls.Add(pnlCards);
            pnlMain.Controls.Add(pnlHeader);

            this.Controls.Add(pnlMain);
        }

        private Control CreateCard(string title, string initialValue, Color accentColor, out Label valueLabel)
        {
            var card = new Panel
            {
                Width = 230,
                Height = 98,
                BackColor = Color.White,
                Margin = new Padding(6),
                Padding = new Padding(14, 10, 14, 10)
            };

            var stripe = new Panel
            {
                Dock = DockStyle.Left,
                Width = 4,
                BackColor = accentColor
            };

            var lblTitle = new Label
            {
                Text = title,
                Font = new Font("Segoe UI", 7.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(100, 116, 139),
                Dock = DockStyle.Top,
                Height = 20
            };

            valueLabel = new Label
            {
                Text = initialValue,
                Font = new Font("Segoe UI", 14f, FontStyle.Bold),
                ForeColor = Color.FromArgb(15, 23, 42),
                Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleLeft
            };

            card.Controls.Add(valueLabel);
            card.Controls.Add(lblTitle);
            card.Controls.Add(stripe);

            return card;
        }

        private Button CreateShortcutButton(string text, int sectionIndex)
        {
            var btn = new Button
            {
                Text = text,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                Size = new Size(100, 32),
                BackColor = Color.FromArgb(241, 245, 249),
                ForeColor = Color.FromArgb(30, 41, 59),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand,
                Margin = new Padding(2)
            };
            btn.FlatAppearance.BorderColor = Color.FromArgb(203, 213, 225);
            btn.Click += (s, e) => OnNavigate?.Invoke(sectionIndex);
            return btn;
        }

        public void LoadDashboardData()
        {
            try
            {
                btnRefresh.Enabled = false;
                btnRefresh.Text = "Loading...";

                var metrics = _dashboardService.GetDashboardMetrics();

                lblTodaySalesVal.Text = $"₹{metrics.TodaySales:N2}";
                lblTodayBillsVal.Text = metrics.TodayBillsCount.ToString();
                lblTodayPurchasesVal.Text = $"₹{metrics.TodayPurchaseTotal:N2}";
                lblTotalProductsVal.Text = $"{metrics.TotalProducts:N0}";
                lblLowStockVal.Text = $"{metrics.LowStockProductCount:N0}";
                lblOutOfStockVal.Text = $"{metrics.OutOfStockProductCount:N0}";
                lblTotalCustomersVal.Text = $"{metrics.TotalCustomerCount:N0}";
                lblOutstandingVal.Text = $"₹{metrics.OutstandingCustomerBalance:N2}";
                lblPaymentsReceivedVal.Text = $"₹{metrics.PaymentsReceivedToday:N2}";
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error loading dashboard: {ex.Message}", "Dashboard Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                btnRefresh.Enabled = true;
                btnRefresh.Text = "↻ Refresh Data";
            }
        }
    }
}
