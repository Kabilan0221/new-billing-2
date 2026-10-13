using System;
using System.Drawing;
using System.Windows.Forms;
using ShopBilling.Core.Interfaces;
using ShopBilling.Core.Services;
using ShopBilling.Data.Repositories;

namespace ShopBilling.UI.Forms
{
    public class MainForm : Form
    {
        private Panel panelSidebar;
        private Panel panelContent;
        private StatusStrip statusStrip;
        private ToolStripStatusLabel lblStatusDb;
        private ToolStripStatusLabel lblStatusItems;
        private ToolStripStatusLabel lblStatusClock;
        private Timer clockTimer;

        private Button[] navButtons;
        private int activeNavIndex = 2; // Default to Products (Index 2)

        private readonly IProductRepository _productRepository;
        private readonly ICategoryRepository _categoryRepository;
        private readonly IBrandRepository _brandRepository;
        private readonly IAuditLogRepository _auditLogRepository;
        private readonly ISupplierRepository _supplierRepository;
        private readonly IPurchaseRepository _purchaseRepository;
        private readonly ISupplierPaymentRepository _supplierPaymentRepository;
        private readonly IStockMovementRepository _stockMovementRepository;

        private readonly ProductService _productService;
        private readonly SupplierService _supplierService;
        private readonly PurchaseService _purchaseService;
        private readonly StockRepository _stockRepository;
        private readonly StockService _stockService;

        private readonly CustomerRepository _customerRepository;
        private readonly CustomerLedgerRepository _customerLedgerRepository;
        private readonly PaymentRepository _paymentRepository;
        private readonly InvoiceRepository _invoiceRepository;
        private readonly EstimateRepository _estimateRepository;
        private readonly InvoiceService _invoiceService;
        private readonly CustomerService _customerService;
        private readonly PaymentService _paymentService;
        private readonly EstimateService _estimateService;
        private readonly BarcodeService _barcodeService;

        private readonly SettingsRepository _settingsRepository;
        private readonly ReportRepository _reportRepository;
        private readonly DataManagementRepository _dataManagementRepository;
        private readonly SettingsService _settingsService;
        private readonly ReportService _reportService;
        private readonly DashboardService _dashboardService;
        private readonly DataManagementService _dataManagementService;

        public MainForm()
        {
            _productRepository = new ProductRepository();
            _categoryRepository = new CategoryRepository();
            _brandRepository = new BrandRepository();
            _auditLogRepository = new AuditLogRepository();
            _supplierRepository = new SupplierRepository();
            _purchaseRepository = new PurchaseRepository();
            _supplierPaymentRepository = new SupplierPaymentRepository();
            _stockMovementRepository = new StockMovementRepository();
            _stockRepository = new StockRepository();
            _customerRepository = new CustomerRepository();
            _customerLedgerRepository = new CustomerLedgerRepository();
            _paymentRepository = new PaymentRepository();
            _invoiceRepository = new InvoiceRepository();
            _estimateRepository = new EstimateRepository();

            _productService = new ProductService(_productRepository, _auditLogRepository);
            _supplierService = new SupplierService(_supplierRepository, _auditLogRepository);
            _purchaseService = new PurchaseService(_purchaseRepository, _productRepository, _supplierRepository, _auditLogRepository);
            _supplierPaymentService = new SupplierPaymentService(_supplierPaymentRepository, _supplierRepository, _auditLogRepository);
            _stockService = new StockService(_stockRepository, _productRepository, _auditLogRepository);
            _invoiceService = new InvoiceService(_invoiceRepository, _productRepository, _customerRepository, _auditLogRepository);
            _customerService = new CustomerService(_customerRepository, _customerLedgerRepository, _invoiceRepository, _paymentRepository, _auditLogRepository);
            _paymentService = new PaymentService(_paymentRepository, _invoiceService != null ? _invoiceRepository : null, _auditLogRepository);
            _estimateService = new EstimateService(_estimateRepository, _productRepository, _customerRepository, _auditLogRepository);
            _barcodeService = new BarcodeService(_productRepository, _auditLogRepository);

            _settingsRepository = new SettingsRepository();
            _reportRepository = new ReportRepository();
            _dataManagementRepository = new DataManagementRepository();
            _settingsService = new SettingsService(_settingsRepository);
            _reportService = new ReportService(_reportRepository);
            _dashboardService = new DashboardService(_reportRepository);
            _dataManagementService = new DataManagementService(_dataManagementRepository);

            InitializeComponent();
            SetupShortcuts();
            LoadSection(1); // Load POS Billing section (Phase 4 Core)
        }

        private void InitializeComponent()
        {
            this.Text = "ShopBilling - Commercial Offline Retail & Inventory Suite (Windows 7 SP1)";
            this.Size = new Size(1280, 800);
            this.MinimumSize = new Size(1024, 680);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.Font = new Font("Segoe UI", 9f);
            this.KeyPreview = true;
            this.Icon = SystemIcons.Application;

            // Header/Brand bar
            var panelTop = new Panel
            {
                Dock = DockStyle.Top,
                Height = 56,
                BackColor = Color.FromArgb(24, 43, 73),
                Padding = new Padding(16, 0, 16, 0)
            };

            var lblLogo = new Label
            {
                Text = "SHOP BILLING PRO",
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 13f, FontStyle.Bold),
                AutoSize = false,
                Size = new Size(220, 56),
                TextAlign = ContentAlignment.MiddleLeft,
                Dock = DockStyle.Left
            };

            var lblStoreInfo = new Label
            {
                Text = "Sri Murugan Super Market | Offline Mode (SQLite WAL) | Terminal #01",
                ForeColor = Color.FromArgb(180, 205, 237),
                Font = new Font("Segoe UI", 9.5f),
                AutoSize = false,
                Size = new Size(500, 56),
                TextAlign = ContentAlignment.MiddleLeft,
                Dock = DockStyle.Left
            };

            panelTop.Controls.Add(lblStoreInfo);
            panelTop.Controls.Add(lblLogo);

            // Sidebar
            panelSidebar = new Panel
            {
                Dock = DockStyle.Left,
                Width = 230,
                BackColor = Color.FromArgb(33, 43, 54),
                AutoScroll = true
            };

            // 15 Dedicated Navigation Sections (Full Commercial Desktop Suite)
            string[] navItems = new string[]
            {
                "Dashboard",                 // 0
                "POS Billing — F1",          // 1
                "Products — F2",             // 2
                "Inbound Goods — F3",        // 3
                "Barcode Studio — F4",       // 4
                "Payments — F5",             // 5
                "Bill History — F6",         // 6
                "Customers — F7",            // 7
                "Suppliers",                 // 8
                "Stock — F8",                // 9
                "Estimates & Invoices — F9", // 10
                "Reports — F10",             // 11
                "Backup & Restore",          // 12
                "Data Management",           // 13
                "Settings"                   // 14
            };

            navButtons = new Button[navItems.Length];
            int yPos = 8;
            for (int i = 0; i < navItems.Length; i++)
            {
                int index = i;
                var btn = new Button
                {
                    Text = "  " + navItems[i],
                    TextAlign = ContentAlignment.MiddleLeft,
                    FlatStyle = FlatStyle.Flat,
                    ForeColor = Color.FromArgb(200, 210, 225),
                    BackColor = (i == activeNavIndex) ? Color.FromArgb(16, 110, 190) : Color.FromArgb(33, 43, 54),
                    Font = new Font("Segoe UI", 9.5f, (i == activeNavIndex) ? FontStyle.Bold : FontStyle.Regular),
                    Size = new Size(210, 40),
                    Location = new Point(10, yPos),
                    Cursor = Cursors.Hand
                };
                btn.FlatAppearance.BorderSize = 0;
                btn.FlatAppearance.MouseOverBackColor = Color.FromArgb(48, 64, 80);
                btn.Click += (s, e) => LoadSection(index);

                panelSidebar.Controls.Add(btn);
                navButtons[i] = btn;
                yPos += 44;
            }

            // Main Content Area
            panelContent = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = Color.FromArgb(243, 244, 246)
            };

            // Status Strip
            statusStrip = new StatusStrip();
            lblStatusDb = new ToolStripStatusLabel { Text = "Database: SQLite (WAL Active)", ForeColor = Color.DarkGreen };
            lblStatusItems = new ToolStripStatusLabel { Text = "Products: Loading...", BorderSides = ToolStripStatusLabelBorderSides.Left };
            lblStatusClock = new ToolStripStatusLabel { Text = DateTime.Now.ToString("dd-MMM-yyyy hh:mm:ss tt"), BorderSides = ToolStripStatusLabelBorderSides.Left };

            statusStrip.Items.AddRange(new ToolStripItem[] { lblStatusDb, lblStatusItems, lblStatusClock });

            clockTimer = new Timer { Interval = 1000 };
            clockTimer.Tick += (s, e) =>
            {
                lblStatusClock.Text = DateTime.Now.ToString("dd-MMM-yyyy hh:mm:ss tt");
            };
            clockTimer.Start();

            this.Controls.Add(panelContent);
            this.Controls.Add(panelSidebar);
            this.Controls.Add(panelTop);
            this.Controls.Add(statusStrip);

            UpdateProductCountStatus();
        }

        private void SetupShortcuts()
        {
            this.KeyDown += (s, e) =>
            {
                switch (e.KeyCode)
                {
                    case Keys.F1: LoadSection(1); e.Handled = true; break;  // POS Billing
                    case Keys.F2: LoadSection(2); e.Handled = true; break;  // Products
                    case Keys.F3: LoadSection(3); e.Handled = true; break;  // Inbound Goods
                    case Keys.F4: LoadSection(4); e.Handled = true; break;  // Barcode Studio
                    case Keys.F5: LoadSection(5); e.Handled = true; break;  // Payments
                    case Keys.F6: LoadSection(6); e.Handled = true; break;  // Bill History
                    case Keys.F7: LoadSection(7); e.Handled = true; break;  // Customers
                    case Keys.F8: LoadSection(9); e.Handled = true; break;  // Stock
                    case Keys.F9: LoadSection(10); e.Handled = true; break; // Estimates & Invoices
                    case Keys.F10: LoadSection(11); e.Handled = true; break; // Reports
                }
            };
        }

        public void LoadSection(int index)
        {
            activeNavIndex = index;
            for (int i = 0; i < navButtons.Length; i++)
            {
                bool isActive = (i == index);
                navButtons[i].BackColor = isActive ? Color.FromArgb(16, 110, 190) : Color.FromArgb(33, 43, 54);
                navButtons[i].ForeColor = isActive ? Color.White : Color.FromArgb(200, 210, 225);
                navButtons[i].Font = new Font("Segoe UI", 9.5f, isActive ? FontStyle.Bold : FontStyle.Regular);
            }

            panelContent.Controls.Clear();

            if (index == 0)
            {
                // Executive Dashboard (Phase 7 Core)
                var dashboardControl = new DashboardControl(_dashboardService);
                dashboardControl.OnNavigate += (sec) => LoadSection(sec);
                dashboardControl.Dock = DockStyle.Fill;
                panelContent.Controls.Add(dashboardControl);
            }
            else if (index == 1)
            {
                // POS Billing & GST Invoices (Phase 4 Core — F1)
                var posControl = new PosBillingControl(_invoiceService, _productService, _customerRepository, _auditLogRepository);
                posControl.OnNavigateToHistory += () => LoadSection(6);
                posControl.Dock = DockStyle.Fill;
                panelContent.Controls.Add(posControl);
            }
            else if (index == 2)
            {
                // Products Master (Phase 1 Core — F2)
                var productControl = new ProductMasterControl(_productService, _categoryRepository, _brandRepository, _auditLogRepository);
                productControl.Dock = DockStyle.Fill;
                panelContent.Controls.Add(productControl);
            }
            else if (index == 3)
            {
                // Inbound Goods / Purchase Entry (Phase 2 Core — F3)
                var inboundControl = new InboundGoodsControl(_purchaseService, _supplierService, _productService, _auditLogRepository);
                inboundControl.Dock = DockStyle.Fill;
                panelContent.Controls.Add(inboundControl);
            }
            else if (index == 4)
            {
                // Barcode Studio (Phase 6 Core — F4)
                var barcodeControl = new BarcodeStudioControl(_barcodeService, _productService);
                barcodeControl.Dock = DockStyle.Fill;
                panelContent.Controls.Add(barcodeControl);
            }
            else if (index == 5)
            {
                // Payments / Customer & Supplier Payment Entry (Phase 4 Core — F5)
                var paymentControl = new PaymentManagementControl(_paymentService, _customerService, _invoiceService);
                paymentControl.Dock = DockStyle.Fill;
                panelContent.Controls.Add(paymentControl);
            }
            else if (index == 6)
            {
                // Bill History & Sales Invoices (Phase 4 Core — F6)
                var billHistoryControl = new BillHistoryControl(_invoiceService);
                billHistoryControl.Dock = DockStyle.Fill;
                panelContent.Controls.Add(billHistoryControl);
            }
            else if (index == 7)
            {
                // Customer Management & Financial Ledger (Phase 2 Core — F7)
                var customerControl = new CustomerManagementControl(_customerService, _invoiceService);
                customerControl.Dock = DockStyle.Fill;
                panelContent.Controls.Add(customerControl);
            }
            else if (index == 8)
            {
                // Supplier Management (Phase 2 Core)
                var supplierControl = new SupplierManagementControl(_supplierService, _auditLogRepository);
                supplierControl.Dock = DockStyle.Fill;
                panelContent.Controls.Add(supplierControl);
            }
            else if (index == 9)
            {
                // Stock Management & Inventory (Phase 3 Core — F8)
                var stockControl = new StockManagementControl(_stockService, _productRepository, _categoryRepository, _brandRepository, _auditLogRepository);
                stockControl.Dock = DockStyle.Fill;
                panelContent.Controls.Add(stockControl);
            }
            else if (index == 10)
            {
                // Estimates & Invoices (Phase 6 Core — F9)
                var estimateControl = new EstimatesAndInvoicesControl(_estimateService, _productService, _customerService);
                estimateControl.OnNavigateToInvoice += (invNum) => LoadSection(6);
                estimateControl.Dock = DockStyle.Fill;
                panelContent.Controls.Add(estimateControl);
            }
            else if (index == 11)
            {
                // Reports & Business Intelligence (Phase 7 Core — F10)
                var reportsControl = new ReportsControl(_reportService);
                reportsControl.Dock = DockStyle.Fill;
                panelContent.Controls.Add(reportsControl);
            }
            else if (index == 12)
            {
                // Backup & Disaster Recovery (Phase 1 Core)
                var backupControl = new BackupRestoreControl();
                backupControl.Dock = DockStyle.Fill;
                panelContent.Controls.Add(backupControl);
            }
            else if (index == 13)
            {
                // Data Management & Integrity Diagnostics (Phase 7 Core)
                var dataControl = new DataManagementControl(_dataManagementService);
                dataControl.Dock = DockStyle.Fill;
                panelContent.Controls.Add(dataControl);
            }
            else if (index == 14)
            {
                // Application Settings & Business Profile (Phase 7 Core)
                var settingsControl = new SettingsControl(_settingsService);
                settingsControl.Dock = DockStyle.Fill;
                panelContent.Controls.Add(settingsControl);
            }

            UpdateProductCountStatus();
        }

        public void UpdateProductCountStatus()
        {
            try
            {
                var (total, low) = _productService.GetStockMetrics();
                lblStatusItems.Text = $"Active Catalog: {total:N0} products | Low Stock: {low:N0}";
            }
            catch
            {
                lblStatusItems.Text = "Products: Ready";
            }
        }
    }
}
