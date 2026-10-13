using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;
using ShopBilling.Core.Interfaces;
using ShopBilling.Core.Models;
using ShopBilling.Core.Services;
using ShopBilling.UI.Utilities;

namespace ShopBilling.UI.Forms
{
    public class PosBillingControl : UserControl
    {
        private readonly InvoiceService _invoiceService;
        private readonly ProductService _productService;
        private readonly ICustomerRepository _customerRepo;
        private readonly IAuditLogRepository _auditRepo;

        // Current Bill in Memory
        private InvoiceHeader _currentInvoice;
        private List<Customer> _allCustomers;

        // UI Controls - Top
        private Label lblInvoiceNumber;
        private Label lblInvoiceDate;
        private ComboBox cmbCustomer;
        private CheckBox chkInterstate;

        // UI Controls - Input
        private TextBox txtBarcode;
        private TextBox txtProductSearch;
        private ListBox lstSearchSuggestions;
        private NumericUpDown numQty;
        private Button btnAddProduct;

        // UI Controls - Cart Grid
        private DataGridView gridCart;

        // UI Controls - Totals Panel
        private Label lblItemCount;
        private Label lblTotalQty;
        private Label lblGrossAmount;
        private Label lblItemDiscount;
        private NumericUpDown numBillDiscount;
        private Label lblTaxableAmount;
        private Label lblCgst;
        private Label lblSgst;
        private Label lblIgst;
        private Label lblRoundOff;
        private Label lblGrandTotal;

        // Payment Inputs
        private ComboBox cmbPaymentMethod;
        private NumericUpDown numAmountReceived;
        private Label lblBalanceDue;
        private Label lblChangeToReturn;

        // Action Buttons
        private Button btnFinalizeThermal;
        private Button btnFinalizeA4;
        private Button btnSaveDraft;
        private Button btnClearBill;

        public event Action OnNavigateToHistory;

        public PosBillingControl(
            InvoiceService invoiceService,
            ProductService productService,
            ICustomerRepository customerRepo,
            IAuditLogRepository auditRepo)
        {
            _invoiceService = invoiceService ?? throw new ArgumentNullException(nameof(invoiceService));
            _productService = productService ?? throw new ArgumentNullException(nameof(productService));
            _customerRepo = customerRepo;
            _auditRepo = auditRepo;

            InitializeUI();
            StartNewBill();
        }

        private void InitializeUI()
        {
            this.BackColor = Color.FromArgb(240, 243, 246);
            this.Font = new Font("Segoe UI", 9f);
            this.Dock = DockStyle.Fill;

            // Header Panel
            var pnlTop = new Panel
            {
                Dock = DockStyle.Top,
                Height = 60,
                BackColor = Color.FromArgb(31, 78, 121),
                Padding = new Padding(12, 8, 12, 8)
            };

            var lblTitle = new Label
            {
                Text = "POS BILLING & GST INVOICE (F1)",
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 12f, FontStyle.Bold),
                AutoSize = true,
                Location = new Point(12, 8)
            };

            lblInvoiceNumber = new Label
            {
                Text = "Bill #: Loading...",
                ForeColor = Color.FromArgb(210, 230, 255),
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                AutoSize = true,
                Location = new Point(14, 32)
            };

            lblInvoiceDate = new Label
            {
                Text = DateTime.Now.ToString("dd-MMM-yyyy hh:mm tt"),
                ForeColor = Color.FromArgb(210, 230, 255),
                Font = new Font("Segoe UI", 9f),
                AutoSize = true,
                Location = new Point(200, 32)
            };

            var btnViewHistory = new Button
            {
                Text = "Bill History (F6)",
                BackColor = Color.FromArgb(41, 128, 185),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Size = new Size(130, 34),
                Location = new Point(620, 12),
                Cursor = Cursors.Hand
            };
            btnViewHistory.FlatAppearance.BorderSize = 0;
            btnViewHistory.Click += (s, e) => OnNavigateToHistory?.Invoke();

            pnlTop.Controls.Add(lblTitle);
            pnlTop.Controls.Add(lblInvoiceNumber);
            pnlTop.Controls.Add(lblInvoiceDate);
            pnlTop.Controls.Add(btnViewHistory);

            // Customer & Entry Sub-bar
            var pnlCustBar = new Panel
            {
                Dock = DockStyle.Top,
                Height = 44,
                BackColor = Color.FromArgb(232, 238, 244),
                Padding = new Padding(12, 6, 12, 6)
            };

            var lblCust = new Label { Text = "Customer:", Location = new Point(12, 12), AutoSize = true, Font = new Font("Segoe UI", 9f, FontStyle.Bold) };
            cmbCustomer = new ComboBox
            {
                Location = new Point(85, 9),
                Width = 240,
                DropDownStyle = ComboBoxStyle.DropDownList
            };
            LoadCustomers();
            cmbCustomer.SelectedIndexChanged += (s, e) =>
            {
                if (cmbCustomer.SelectedItem is Customer c)
                {
                    _currentInvoice.CustomerId = c.Id;
                    _currentInvoice.CustomerName = c.Name;
                    _currentInvoice.CustomerMobile = c.Mobile;
                    _currentInvoice.CustomerGstin = c.Gstin;
                }
            };

            chkInterstate = new CheckBox
            {
                Text = "Inter-State (IGST)",
                Location = new Point(340, 11),
                AutoSize = true,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                ForeColor = Color.FromArgb(31, 78, 121)
            };
            chkInterstate.CheckedChanged += (s, e) =>
            {
                _currentInvoice.IsInterstate = chkInterstate.Checked;
                RecalculateTotals();
            };

            pnlCustBar.Controls.Add(lblCust);
            pnlCustBar.Controls.Add(cmbCustomer);
            pnlCustBar.Controls.Add(chkInterstate);

            // Right Totals & Payment Panel
            var pnlTotals = new Panel
            {
                Dock = DockStyle.Right,
                Width = 330,
                BackColor = Color.White,
                Padding = new Padding(14),
                BorderStyle = BorderStyle.FixedSingle
            };
            BuildTotalsPanel(pnlTotals);

            // Center: Product Input & Cart Grid
            var pnlCenter = new Panel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(12),
                BackColor = Color.FromArgb(240, 243, 246)
            };

            // Barcode & Product Search Panel
            var pnlInput = new Panel
            {
                Dock = DockStyle.Top,
                Height = 65,
                BackColor = Color.White,
                Padding = new Padding(8),
                BorderStyle = BorderStyle.FixedSingle
            };

            var lblBar = new Label { Text = "Scan Barcode (Enter):", Location = new Point(8, 8), AutoSize = true, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) };
            txtBarcode = new TextBox
            {
                Location = new Point(8, 28),
                Width = 180,
                Font = new Font("Consolas", 10.5f),
                BackColor = Color.FromArgb(254, 254, 235)
            };
            txtBarcode.KeyDown += (s, e) =>
            {
                if (e.KeyCode == Keys.Enter)
                {
                    e.Handled = true;
                    e.SuppressKeyPress = true;
                    HandleBarcodeScan(txtBarcode.Text.Trim());
                }
            };

            var lblSearch = new Label { Text = "Search Product (Name / Code):", Location = new Point(200, 8), AutoSize = true, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) };
            txtProductSearch = new TextBox
            {
                Location = new Point(200, 28),
                Width = 260,
                Font = new Font("Segoe UI", 9.5f)
            };
            txtProductSearch.TextChanged += (s, e) => HandleSearchTyping(txtProductSearch.Text.Trim());
            txtProductSearch.KeyDown += (s, e) =>
            {
                if (e.KeyCode == Keys.Down && lstSearchSuggestions.Visible && lstSearchSuggestions.Items.Count > 0)
                {
                    lstSearchSuggestions.Focus();
                    lstSearchSuggestions.SelectedIndex = 0;
                }
            };

            var lblQty = new Label { Text = "Qty:", Location = new Point(470, 8), AutoSize = true, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) };
            numQty = new NumericUpDown
            {
                Location = new Point(470, 28),
                Width = 65,
                Minimum = 1,
                Maximum = 9999,
                Value = 1,
                Font = new Font("Segoe UI", 9.5f)
            };

            btnAddProduct = new Button
            {
                Text = "Add (Enter)",
                Location = new Point(545, 27),
                Width = 95,
                Height = 28,
                BackColor = Color.FromArgb(31, 78, 121),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnAddProduct.FlatAppearance.BorderSize = 0;
            btnAddProduct.Click += (s, e) =>
            {
                if (!string.IsNullOrWhiteSpace(txtBarcode.Text))
                {
                    HandleBarcodeScan(txtBarcode.Text.Trim());
                }
            };

            lstSearchSuggestions = new ListBox
            {
                Width = 350,
                Height = 160,
                Location = new Point(200, 56),
                Visible = false,
                Font = new Font("Segoe UI", 9f),
                BorderStyle = BorderStyle.FixedSingle
            };
            lstSearchSuggestions.DoubleClick += (s, e) => SelectSearchedProduct();
            lstSearchSuggestions.KeyDown += (s, e) =>
            {
                if (e.KeyCode == Keys.Enter)
                {
                    SelectSearchedProduct();
                    e.Handled = true;
                }
                else if (e.KeyCode == Keys.Escape)
                {
                    lstSearchSuggestions.Visible = false;
                    txtProductSearch.Focus();
                }
            };

            pnlInput.Controls.Add(lblBar);
            pnlInput.Controls.Add(txtBarcode);
            pnlInput.Controls.Add(lblSearch);
            pnlInput.Controls.Add(txtProductSearch);
            pnlInput.Controls.Add(lblQty);
            pnlInput.Controls.Add(numQty);
            pnlInput.Controls.Add(btnAddProduct);
            pnlInput.Controls.Add(lstSearchSuggestions);

            // Cart DataGridView
            gridCart = new DataGridView
            {
                Dock = DockStyle.Fill,
                BackgroundColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
                AllowUserToAddRows = false,
                RowHeadersVisible = false,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                MultiSelect = false,
                Font = new Font("Segoe UI", 9f),
                RowTemplate = { Height = 28 }
            };
            ConfigureCartGridColumns();
            gridCart.CellValueChanged += (s, e) => HandleCartCellEdit(e.RowIndex, e.ColumnIndex);
            gridCart.CellClick += (s, e) =>
            {
                if (e.RowIndex >= 0 && e.ColumnIndex == gridCart.Columns["colDelete"].Index)
                {
                    RemoveCartItem(e.RowIndex);
                }
            };

            pnlCenter.Controls.Add(gridCart);
            pnlCenter.Controls.Add(pnlInput);

            this.Controls.Add(pnlCenter);
            this.Controls.Add(pnlTotals);
            this.Controls.Add(pnlCustBar);
            this.Controls.Add(pnlTop);
        }

        private void ConfigureCartGridColumns()
        {
            gridCart.Columns.Clear();

            gridCart.Columns.Add(new DataGridViewTextBoxColumn { Name = "colNum", HeaderText = "#", Width = 35, ReadOnly = true });
            gridCart.Columns.Add(new DataGridViewTextBoxColumn { Name = "colBarcode", HeaderText = "Barcode", Width = 110, ReadOnly = true });
            gridCart.Columns.Add(new DataGridViewTextBoxColumn { Name = "colName", HeaderText = "Product Description", AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill, ReadOnly = true });
            gridCart.Columns.Add(new DataGridViewTextBoxColumn { Name = "colUnit", HeaderText = "Unit", Width = 55, ReadOnly = true });
            gridCart.Columns.Add(new DataGridViewTextBoxColumn { Name = "colQty", HeaderText = "Qty", Width = 60 });
            gridCart.Columns.Add(new DataGridViewTextBoxColumn { Name = "colRate", HeaderText = "Rate (₹)", Width = 75 });
            gridCart.Columns.Add(new DataGridViewTextBoxColumn { Name = "colDiscPct", HeaderText = "Disc %", Width = 60 });
            gridCart.Columns.Add(new DataGridViewTextBoxColumn { Name = "colTaxRate", HeaderText = "GST %", Width = 60, ReadOnly = true });
            gridCart.Columns.Add(new DataGridViewTextBoxColumn { Name = "colTaxable", HeaderText = "Taxable (₹)", Width = 80, ReadOnly = true });
            gridCart.Columns.Add(new DataGridViewTextBoxColumn { Name = "colGst", HeaderText = "GST (₹)", Width = 70, ReadOnly = true });
            gridCart.Columns.Add(new DataGridViewTextBoxColumn { Name = "colTotal", HeaderText = "Total (₹)", Width = 85, ReadOnly = true });

            var btnCol = new DataGridViewButtonColumn
            {
                Name = "colDelete",
                HeaderText = "",
                Text = "✕",
                UseColumnTextForButtonValue = true,
                Width = 35
            };
            gridCart.Columns.Add(btnCol);

            // Styling Header
            gridCart.EnableHeadersVisualStyles = false;
            gridCart.ColumnHeadersDefaultCellStyle.BackColor = Color.FromArgb(31, 78, 121);
            gridCart.ColumnHeadersDefaultCellStyle.ForeColor = Color.White;
            gridCart.ColumnHeadersDefaultCellStyle.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            gridCart.ColumnHeadersHeight = 32;
        }

        private void BuildTotalsPanel(Panel pnl)
        {
            int y = 10;
            void AddRow(string label, out Label valLabel, bool isBold = false)
            {
                var lbl = new Label { Text = label, Location = new Point(10, y), AutoSize = true, Font = new Font("Segoe UI", 9f, isBold ? FontStyle.Bold : FontStyle.Regular) };
                valLabel = new Label
                {
                    Text = "₹0.00",
                    Location = new Point(170, y),
                    Size = new Size(130, 20),
                    TextAlign = ContentAlignment.MiddleRight,
                    Font = new Font("Segoe UI", 9f, isBold ? FontStyle.Bold : FontStyle.Regular)
                };
                pnl.Controls.Add(lbl);
                pnl.Controls.Add(valLabel);
                y += 22;
            }

            AddRow("Items / Lines:", out lblItemCount);
            lblItemCount.Text = "0 items (0 qty)";

            AddRow("Gross Subtotal:", out lblGrossAmount);
            AddRow("Item Discounts:", out lblItemDiscount);

            // Bill Discount Input
            var lblBDisc = new Label { Text = "Bill Discount (₹):", Location = new Point(10, y), AutoSize = true };
            numBillDiscount = new NumericUpDown
            {
                Location = new Point(190, y),
                Width = 110,
                Maximum = 999999,
                DecimalPlaces = 2
            };
            numBillDiscount.ValueChanged += (s, e) =>
            {
                _currentInvoice.BillDiscount = numBillDiscount.Value;
                RecalculateTotals();
            };
            pnl.Controls.Add(lblBDisc);
            pnl.Controls.Add(numBillDiscount);
            y += 26;

            AddRow("Taxable Value:", out lblTaxableAmount);
            AddRow("CGST Amount:", out lblCgst);
            AddRow("SGST Amount:", out lblSgst);
            AddRow("IGST Amount:", out lblIgst);
            AddRow("Round Off:", out lblRoundOff);

            var line = new Panel { Location = new Point(10, y), Size = new Size(295, 2), BackColor = Color.SteelBlue };
            pnl.Controls.Add(line);
            y += 8;

            // Grand Total
            var lblGT = new Label { Text = "NET PAYABLE:", Location = new Point(10, y), AutoSize = true, Font = new Font("Segoe UI", 12f, FontStyle.Bold), ForeColor = Color.FromArgb(16, 110, 190) };
            lblGrandTotal = new Label
            {
                Text = "₹0.00",
                Location = new Point(130, y),
                Size = new Size(170, 28),
                TextAlign = ContentAlignment.MiddleRight,
                Font = new Font("Segoe UI", 15f, FontStyle.Bold),
                ForeColor = Color.FromArgb(16, 110, 190)
            };
            pnl.Controls.Add(lblGT);
            pnl.Controls.Add(lblGrandTotal);
            y += 36;

            // Payment Section
            var pnlPay = new GroupBox
            {
                Text = "Payment Collection",
                Location = new Point(6, y),
                Size = new Size(305, 130),
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold)
            };

            var lblMethod = new Label { Text = "Mode:", Location = new Point(8, 22), AutoSize = true };
            cmbPaymentMethod = new ComboBox
            {
                Location = new Point(100, 19),
                Width = 190,
                DropDownStyle = ComboBoxStyle.DropDownList
            };
            cmbPaymentMethod.Items.AddRange(new object[] { "Cash", "UPI", "Card", "Bank Transfer", "Credit / Pay Later" });
            cmbPaymentMethod.SelectedIndex = 0;

            var lblRecv = new Label { Text = "Received (₹):", Location = new Point(8, 48), AutoSize = true };
            numAmountReceived = new NumericUpDown
            {
                Location = new Point(100, 46),
                Width = 190,
                Maximum = 9999999,
                DecimalPlaces = 2
            };
            numAmountReceived.ValueChanged += (s, e) => RecalculateTotals();

            var lblChg = new Label { Text = "Change Due:", Location = new Point(8, 76), AutoSize = true };
            lblChangeToReturn = new Label { Text = "₹0.00", Location = new Point(100, 76), AutoSize = true, ForeColor = Color.DarkGreen };

            var lblBal = new Label { Text = "Balance Due:", Location = new Point(8, 98), AutoSize = true };
            lblBalanceDue = new Label { Text = "₹0.00", Location = new Point(100, 98), AutoSize = true, ForeColor = Color.DarkRed };

            pnlPay.Controls.Add(lblMethod);
            pnlPay.Controls.Add(cmbPaymentMethod);
            pnlPay.Controls.Add(lblRecv);
            pnlPay.Controls.Add(numAmountReceived);
            pnlPay.Controls.Add(lblChg);
            pnlPay.Controls.Add(lblChangeToReturn);
            pnlPay.Controls.Add(lblBal);
            pnlPay.Controls.Add(lblBalanceDue);

            pnl.Controls.Add(pnlPay);
            y += 140;

            // Action Buttons
            btnFinalizeThermal = new Button
            {
                Text = "Finalize & Print Thermal",
                Location = new Point(10, y),
                Size = new Size(295, 36),
                BackColor = Color.FromArgb(16, 124, 65),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnFinalizeThermal.FlatAppearance.BorderSize = 0;
            btnFinalizeThermal.Click += (s, e) => FinalizeCurrentBill(true);
            pnl.Controls.Add(btnFinalizeThermal);
            y += 42;

            btnFinalizeA4 = new Button
            {
                Text = "Finalize & Print A4 Invoice",
                Location = new Point(10, y),
                Size = new Size(295, 32),
                BackColor = Color.FromArgb(31, 78, 121),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnFinalizeA4.FlatAppearance.BorderSize = 0;
            btnFinalizeA4.Click += (s, e) => FinalizeCurrentBill(false);
            pnl.Controls.Add(btnFinalizeA4);
            y += 38;

            btnSaveDraft = new Button
            {
                Text = "Save Draft Bill",
                Location = new Point(10, y),
                Size = new Size(142, 28),
                BackColor = Color.FromArgb(230, 235, 240),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnSaveDraft.Click += (s, e) => SaveDraftBill();
            pnl.Controls.Add(btnSaveDraft);

            btnClearBill = new Button
            {
                Text = "Clear Bill (Esc)",
                Location = new Point(160, y),
                Size = new Size(145, 28),
                BackColor = Color.FromArgb(255, 235, 235),
                ForeColor = Color.Maroon,
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnClearBill.Click += (s, e) =>
            {
                if (MessageBox.Show("Are you sure you want to clear current items?", "Clear Bill", MessageBoxButtons.YesNo, MessageBoxIcon.Question) == DialogResult.Yes)
                {
                    StartNewBill();
                }
            };
            pnl.Controls.Add(btnClearBill);
        }

        private void LoadCustomers()
        {
            try
            {
                _allCustomers = _customerRepo?.GetAllActive().ToList() ?? new List<Customer>();
                if (!_allCustomers.Any(c => c.Id == 1))
                {
                    _allCustomers.Insert(0, new Customer { Id = 1, Code = "CUST-WALKIN", Name = "Walk-in Customer" });
                }

                cmbCustomer.DisplayMember = "Name";
                cmbCustomer.ValueMember = "Id";
                cmbCustomer.DataSource = _allCustomers;
                cmbCustomer.SelectedIndex = 0;
            }
            catch { }
        }

        public void StartNewBill()
        {
            _currentInvoice = new InvoiceHeader
            {
                InvoiceNumber = _invoiceService.GenerateNextInvoiceNumber(),
                InvoiceDate = DateTime.Now,
                CustomerId = 1,
                CustomerName = "Walk-in Customer",
                Salesperson = "Admin",
                IsInterstate = false,
                Status = "Draft"
            };

            lblInvoiceNumber.Text = $"Bill #: {_currentInvoice.InvoiceNumber}";
            lblInvoiceDate.Text = DateTime.Now.ToString("dd-MMM-yyyy hh:mm tt");
            chkInterstate.Checked = false;
            numBillDiscount.Value = 0;
            numAmountReceived.Value = 0;

            RefreshCartGrid();
            txtBarcode.Focus();
        }

        private void HandleBarcodeScan(string barcode)
        {
            if (string.IsNullOrWhiteSpace(barcode)) return;

            var product = _productService.GetProductByBarcode(barcode) ?? _productService.GetProductByCode(barcode);
            if (product != null)
            {
                AddProductToCart(product, (int)numQty.Value);
                txtBarcode.Clear();
                numQty.Value = 1;
            }
            else
            {
                MessageBox.Show($"Product with barcode or code '{barcode}' not found in catalog.", "Not Found", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                txtBarcode.SelectAll();
            }
        }

        private void HandleSearchTyping(string term)
        {
            if (term.Length < 2)
            {
                lstSearchSuggestions.Visible = false;
                return;
            }

            var filter = new ProductFilter { SearchTerm = term, PageSize = 10, IsActive = true };
            var result = _productService.SearchProducts(filter);

            lstSearchSuggestions.Items.Clear();
            if (result.Items != null && result.Items.Any())
            {
                foreach (var p in result.Items)
                {
                    lstSearchSuggestions.Items.Add(new SearchItemWrapper(p));
                }
                lstSearchSuggestions.BringToFront();
                lstSearchSuggestions.Visible = true;
            }
            else
            {
                lstSearchSuggestions.Visible = false;
            }
        }

        private void SelectSearchedProduct()
        {
            if (lstSearchSuggestions.SelectedItem is SearchItemWrapper item)
            {
                AddProductToCart(item.Product, (int)numQty.Value);
                lstSearchSuggestions.Visible = false;
                txtProductSearch.Clear();
                numQty.Value = 1;
                txtBarcode.Focus();
            }
        }

        private void AddProductToCart(Product p, int qty)
        {
            var existing = _currentInvoice.Items.FirstOrDefault(i => i.ProductId == p.Id);
            if (existing != null)
            {
                // Increment quantity
                existing.Quantity += qty;
            }
            else
            {
                _currentInvoice.Items.Add(new InvoiceItem
                {
                    ProductId = p.Id,
                    ProductCode = p.ProductCode,
                    Barcode = p.Barcode,
                    ProductName = p.NameEn,
                    Unit = p.Unit ?? "PCS",
                    Quantity = qty,
                    Rate = p.SaleRate > 0 ? p.SaleRate : p.Mrp,
                    DiscountPercent = 0,
                    DiscountAmount = 0,
                    TaxRate = p.TaxRate
                });
            }

            RefreshCartGrid();
            RecalculateTotals();
        }

        private void RemoveCartItem(int index)
        {
            if (index >= 0 && index < _currentInvoice.Items.Count)
            {
                _currentInvoice.Items.RemoveAt(index);
                RefreshCartGrid();
                RecalculateTotals();
            }
        }

        private void HandleCartCellEdit(int rowIndex, int colIndex)
        {
            if (rowIndex < 0 || rowIndex >= _currentInvoice.Items.Count) return;

            var item = _currentInvoice.Items[rowIndex];
            var row = gridCart.Rows[rowIndex];

            if (colIndex == gridCart.Columns["colQty"].Index)
            {
                if (decimal.TryParse(row.Cells["colQty"].Value?.ToString(), out decimal q) && q > 0)
                {
                    item.Quantity = q;
                }
            }
            else if (colIndex == gridCart.Columns["colRate"].Index)
            {
                if (decimal.TryParse(row.Cells["colRate"].Value?.ToString(), out decimal r) && r >= 0)
                {
                    item.Rate = r;
                }
            }
            else if (colIndex == gridCart.Columns["colDiscPct"].Index)
            {
                if (decimal.TryParse(row.Cells["colDiscPct"].Value?.ToString(), out decimal d) && d >= 0 && d <= 100)
                {
                    item.DiscountPercent = d;
                }
            }

            RecalculateTotals();
            RefreshCartGridRow(rowIndex);
        }

        private void RefreshCartGrid()
        {
            gridCart.Rows.Clear();
            for (int i = 0; i < _currentInvoice.Items.Count; i++)
            {
                var it = _currentInvoice.Items[i];
                gridCart.Rows.Add(
                    i + 1,
                    it.Barcode,
                    it.ProductName,
                    it.Unit,
                    it.Quantity,
                    it.Rate.ToString("F2"),
                    it.DiscountPercent.ToString("F1"),
                    it.TaxRate.ToString("F1"),
                    it.TaxableAmount.ToString("F2"),
                    it.TaxAmount.ToString("F2"),
                    it.LineTotal.ToString("F2")
                );
            }
        }

        private void RefreshCartGridRow(int index)
        {
            if (index < 0 || index >= _currentInvoice.Items.Count) return;
            var it = _currentInvoice.Items[index];
            var row = gridCart.Rows[index];

            row.Cells["colQty"].Value = it.Quantity;
            row.Cells["colRate"].Value = it.Rate.ToString("F2");
            row.Cells["colDiscPct"].Value = it.DiscountPercent.ToString("F1");
            row.Cells["colTaxable"].Value = it.TaxableAmount.ToString("F2");
            row.Cells["colGst"].Value = it.TaxAmount.ToString("F2");
            row.Cells["colTotal"].Value = it.LineTotal.ToString("F2");
        }

        private void RecalculateTotals()
        {
            _currentInvoice.BillDiscount = numBillDiscount.Value;

            // Setup payments
            _currentInvoice.Payments.Clear();
            string method = cmbPaymentMethod.SelectedItem?.ToString() ?? "Cash";
            decimal paid = numAmountReceived.Value;
            if (paid > 0)
            {
                _currentInvoice.Payments.Add(new InvoicePayment
                {
                    PaymentMethod = method,
                    Amount = paid
                });
            }

            InvoiceService.CalculateInvoice(_currentInvoice);

            lblItemCount.Text = $"{_currentInvoice.TotalItems} items ({_currentInvoice.TotalQty} units)";
            lblGrossAmount.Text = $"₹{_currentInvoice.GrossAmount:F2}";
            lblItemDiscount.Text = $"-₹{_currentInvoice.ItemDiscount:F2}";
            lblTaxableAmount.Text = $"₹{_currentInvoice.TaxableAmount:F2}";

            if (_currentInvoice.IsInterstate)
            {
                lblCgst.Text = "₹0.00 (Interstate)";
                lblSgst.Text = "₹0.00 (Interstate)";
                lblIgst.Text = $"₹{_currentInvoice.IgstAmount:F2}";
            }
            else
            {
                lblCgst.Text = $"₹{_currentInvoice.CgstAmount:F2}";
                lblSgst.Text = $"₹{_currentInvoice.SgstAmount:F2}";
                lblIgst.Text = "₹0.00";
            }

            lblRoundOff.Text = $"₹{_currentInvoice.RoundOff:F2}";
            lblGrandTotal.Text = $"₹{_currentInvoice.GrandTotal:F2}";

            lblChangeToReturn.Text = $"₹{_currentInvoice.CashChange:F2}";
            lblBalanceDue.Text = $"₹{_currentInvoice.BalanceDue:F2}";
        }

        private void FinalizeCurrentBill(bool isThermal)
        {
            if (_currentInvoice.Items.Count == 0)
            {
                MessageBox.Show("Please add at least one product to the cart before finalizing.", "Empty Cart", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            // If cash/card received is 0, prompt user if this is a credit bill or set default payment to grand total
            if (numAmountReceived.Value == 0 && cmbPaymentMethod.SelectedItem?.ToString() != "Credit / Pay Later")
            {
                numAmountReceived.Value = _currentInvoice.GrandTotal;
                RecalculateTotals();
            }

            bool success = _invoiceService.FinalizeInvoice(_currentInvoice, out string error);
            if (!success)
            {
                MessageBox.Show($"Failed to finalize invoice:\n{error}", "Billing Validation Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            // Print invoice preview
            InvoicePrintHelper.PrintInvoice(_currentInvoice, isThermal);

            MessageBox.Show($"Invoice #{_currentInvoice.InvoiceNumber} saved successfully!", "Sale Completed", MessageBoxButtons.OK, MessageBoxIcon.Information);
            StartNewBill();
        }

        private void SaveDraftBill()
        {
            if (_currentInvoice.Items.Count == 0)
            {
                MessageBox.Show("Cart is empty. Cannot save draft.", "Empty Cart", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            var val = _invoiceService.SaveDraft(_currentInvoice);
            if (!val.IsValid)
            {
                MessageBox.Show(string.Join("\n", val.Errors), "Draft Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            MessageBox.Show($"Draft #{_currentInvoice.InvoiceNumber} saved.", "Draft Saved", MessageBoxButtons.OK, MessageBoxIcon.Information);
            StartNewBill();
        }

        private class SearchItemWrapper
        {
            public Product Product { get; }
            public SearchItemWrapper(Product p) => Product = p;
            public override string ToString() => $"{Product.ProductCode} | {Product.NameEn} (₹{Product.SaleRate}) - Stock: {Product.CurrentStock}";
        }
    }
}
